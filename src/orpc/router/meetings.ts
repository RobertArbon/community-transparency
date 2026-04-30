import { os } from '@orpc/server'
import { prisma } from '#/db'
import { MeetingsListSchema } from '../schema'
import { z } from "zod";

export const getNMeetings = os
  .input(z.object({
    firstN: z.int().min(1).default(10_000)
  }))
  .output(MeetingsListSchema)
  .handler(async ({input}) => {
    const meetingsList  = await prisma.meeting.findMany({
      take: input.firstN,
      select: {
        externalRecordId: true, 
        host: true, 
        department: true,
        purpose: true, 
        organisation: true, 
        date: true
      },
      orderBy: {
        externalRecordId: "asc"
      }
    });

    return meetingsList.map((meeting) => { 
      return {
        id: meeting.externalRecordId, 
        office: meeting.department,
        lobbyist: meeting.organisation, 
        ...meeting}
    });
  })
