import { PrismaClient, Source } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })
const __dirname = dirname(fileURLToPath(import.meta.url))

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
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

// CSV column indices (0-indexed)
// 0=index, 1=rep_new, 2=policy_level, 3=date, 4=organisation, 5=purpose,
// 6=department, 7=Quarter, 8=others_at_the_meeting, 9=source,
// 10=registrant_additional_information, 11=portal_source, 12=RecordId, 13=tag

function buildMeetingData(row: string[]) {
  return {
    host: row[1] || null,
    policyLevel: parseInt(row[2]),
    date: parseDate(row[3]),
    organisation: row[4] || null,
    purpose: row[5] || null,
    department: row[6] || null,
    othersAttending: row[8] || null,
    source: row[9] || null,
    registrantAddInfo: row[10] || null,
    portalSource: parsePortalSource(row[11]),
    externalRecordId: parseInt(row[12]),
  }
}

async function readCsvRows(filePath: string): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const rows: string[][] = []
    let isFirst = true
    const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity })
    rl.on('line', (line) => {
      if (isFirst) { isFirst = false; return }
      if (line.trim()) rows.push(parseCSVLine(line))
    })
    rl.on('close', () => resolve(rows))
    rl.on('error', reject)
  })
}

async function main() {
  console.log('🌱 Seeding database...')

  console.log('📖 Reading CSV...')
  const rows = await readCsvRows(join(__dirname, 'data', 'iw_uk.csv'))
  console.log(`   Found ${rows.length} rows`)

  await prisma.meeting.deleteMany()
  await prisma.tag.deleteMany()
  console.log('🗑️  Cleared existing data')

  // Collect unique tag names and create them
  const tagNames = new Set<string>()
  for (const row of rows) {
    for (const t of parseTags(row[13] ?? '')) tagNames.add(t)
  }
  const tagMap = new Map<string, number>()
  for (const name of tagNames) {
    const tag = await prisma.tag.create({ data: { name } })
    tagMap.set(name, tag.id)
  }
  console.log(`✅ Created ${tagMap.size} tags`)

  const untagged = rows.filter((r) => parseTags(r[13] ?? '').length === 0)
  const tagged = rows.filter((r) => parseTags(r[13] ?? '').length > 0)

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
        const tags = parseTags(row[13] ?? '')
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
