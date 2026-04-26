import { PrismaClient, Source } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })
const __dirname = dirname(fileURLToPath(import.meta.url))

interface RawRecord {
  rep_new: string | null
  policy_level: number
  date: string
  organisation: string | null
  purpose: string | null
  department: string | null
  Quarter: string
  others_at_the_meeting: string | null
  source: string | null
  registrant_additional_information: string | null
  portal_source: string
  RecordId: number
  tag: string | null
}

function parseDate(s: string): Date {
  const [day, month, year] = s.split('/')
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
}

function parsePortalSource(s: string): Source {
  if (s === 'UK Government') return Source.UK_Government
  if (s.toLowerCase() === 'scottish lobbying register') return Source.Scottish_Lobbying_Register
  throw new Error(`Unknown portal_source: "${s}"`)
}

function parseTags(s: string): string[] {
  return s
    .split(', ')
    .map((t) => t.trim())
    .filter((t) => t && t !== 'None')
}

function buildMeetingData(record: RawRecord) {
  return {
    host: record.rep_new || null,
    policyLevel: record.policy_level,
    date: parseDate(record.date),
    organisation: record.organisation || null,
    purpose: record.purpose || null,
    department: record.department || null,
    othersAttending: record.others_at_the_meeting || null,
    source: record.source || null,
    registrantAddInfo: record.registrant_additional_information || null,
    portalSource: parsePortalSource(record.portal_source),
    externalRecordId: record.RecordId,
  }
}

function readJsonRecords(filePath: string): RawRecord[] {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as RawRecord[]
}

async function main() {
  console.log('🌱 Seeding database...')

  console.log('📖 Reading JSON...')
  const rows = readJsonRecords(join(__dirname, 'data', 'iw_uk.json'))
  console.log(`   Found ${rows.length} rows`)

  await prisma.meeting.deleteMany()
  await prisma.tag.deleteMany()
  console.log('🗑️  Cleared existing data')

  // Collect unique tag names and create them
  const tagNames = new Set<string>()
  for (const row of rows) {
    for (const t of parseTags(row.tag ?? '')) tagNames.add(t)
  }
  const tagMap = new Map<string, number>()
  for (const name of tagNames) {
    const tag = await prisma.tag.create({ data: { name } })
    tagMap.set(name, tag.id)
  }
  console.log(`✅ Created ${tagMap.size} tags`)

  const untagged = rows.filter((r) => parseTags(r.tag ?? '').length === 0)
  const tagged = rows.filter((r) => parseTags(r.tag ?? '').length > 0)
  // Bulk-insert untagged meetings
  const BULK_BATCH = 5000
  for (let i = 0; i < untagged.length; i += BULK_BATCH) {
    await prisma.meeting.createMany({ data: untagged.slice(i, i + BULK_BATCH).map(buildMeetingData) })
    console.log(`   Untagged: ${Math.min(i + BULK_BATCH, untagged.length)}/${untagged.length}`)
  }

  // Create tagged meetings individually (to connect tags)
  const TAG_BATCH = 100
  for (let i = 0; i < tagged.length; i += TAG_BATCH) {
    const batch = tagged.slice(i, i + TAG_BATCH)
    await Promise.all(
      batch.map((row) => {
        const tags = parseTags(row.tag ?? '')
        return prisma.meeting.create({
          data: {
            ...buildMeetingData(row),
            tags: { connect: tags.map((t) => ({ id: tagMap.get(t)! })) },
          },
        })
      }),
    )
    if ((i + TAG_BATCH) % 5000 === 0 || i + TAG_BATCH >= tagged.length) {
      console.log(`   Tagged: ${Math.min(i + TAG_BATCH, tagged.length)}/${tagged.length}`)
    }
  }

  console.log(`✅ Seeded ${rows.length} meetings (${untagged.length} untagged, ${tagged.length} tagged)`)
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
