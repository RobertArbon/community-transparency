import { createFileRoute } from '@tanstack/react-router'
import MeetingsTable  from "@/components/table/table";
import { orpc } from '#/orpc/client';
import { Suspense } from 'react';



export const Route = createFileRoute('/')({ 
  component: Home,  
  loader: {
    handler: async ({ context }) => {
    return context.queryClient.ensureQueryData(orpc.meetings.getNMeetings.queryOptions({
      input: {firstN: 1000}
    }))
  }
}
})

// const DUMMY_DATA: Meeting[] = [
//   {
//     host: 'Rt Hon Dominic Grieve QC',
//     date: new Date(2012, 1, 1),
//     lobbyist: 'Criminal Law Commission',
//     purpose: 'To discuss contempt issues',
//     office: "Attorney General's Office",
//     id: 1,
//   },
//   {
//     host: 'Rt Hon Dominic Grieve QC',
//     date: new Date(2012, 2, 1), 
//     lobbyist: 'Federalist Society',
//     purpose: 'To discuss the EU Court of Human Rights',
//     office: "Attorney General's Office",
//     id: 2,
//   },
//   {
//     host: 'Rt Hon Dominic Grieve QC',
//     date: new Date(2012, 2, 1),
//     lobbyist: 'Magistrates Association',
//     purpose: 'To discuss the magistrates sentencing powers',
//     office: "Attorney General's Office",
//     id: 3,
//   },
//   {
//     host: 'Rt Hon Dominic Grieve QC',
//     date: new Date(2012, 2, 1),
//     lobbyist: 'Bar Council',
//     purpose: 'Regular catch up meeting',
//     office: "Attorney General's Office",
//     id: 4,
//   },
// ]

function Home() {
  const meetings = Route.useLoaderData()

  return (
    <div className="w-full">
      <div className="p-8">
        <h1 className="text-4xl font-bold">Community transparency</h1>
      </div> 
      <Suspense fallback={"Loading data"}>
        <div className="flex justify-center"> 
          <MeetingsTable data={meetings} />
        </div>
      </Suspense>
    </div>
  )
}
