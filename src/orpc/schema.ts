import { z } from 'zod'

export const TodoSchema = z.object({
  id: z.number().int().min(1),
  name: z.string(),
})

export const MeetingSchema = z.object({
  id: z.int(), 
  host: z.string().nullable(),
  office: z.string().nullable(),
  purpose: z.string().nullable(),
  lobbyist: z.string().nullable(),
  date: z.date() 
})

export const MeetingsListSchema = z.array(MeetingSchema);
export type MeetingsList = z.infer<typeof MeetingsListSchema>; 
export type Meeting = z.infer<typeof MeetingSchema>;

export const MeetingsPageRequestSchema = z.object({
  startIdx: z.int().default(1), 
  pageSize: z.int().default(5)
})