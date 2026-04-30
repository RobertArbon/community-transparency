import { createColumnHelper } from "@tanstack/react-table";
import type { Meeting } from "#/orpc/schema";

const columnHelper = createColumnHelper<Meeting>()


export const columns = [
  columnHelper.accessor("id", {
    cell: (info) => info.getValue(),
  }), 
  columnHelper.accessor("host", {
    cell: (info) => <span>{info.getValue()}</span>,
    header: () => <h3>Host</h3> 
  }), 
  columnHelper.accessor("office", {
    cell: (info) => <span>{info.getValue()}</span>,
    header: () => <h3>Office</h3> 
  }), 
  columnHelper.accessor("purpose", {
    cell: (info) => <span>{info.getValue()}</span>,
    header: () => <h3>Purpose</h3> 
  }), 
  columnHelper.accessor("lobbyist", {
    cell: (info) => <span>{info.getValue()}</span>,
    header: () => <h3>Lobbyist</h3> 
  }), 
  columnHelper.accessor("date", {
    cell: (info) => <span>{info.getValue().toISOString()}</span>,
    header: () => <h3>date</h3> 
  }), 
]