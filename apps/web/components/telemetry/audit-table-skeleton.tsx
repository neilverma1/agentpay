import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Select, SelectTrigger, SelectValue } from '@workspace/ui/components/select';
import { Skeleton } from '@workspace/ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { ArrowUpDownIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from 'lucide-react';

interface AuditTableSkeletonProps {
  rowCount?: number;
}

const ROW_ITEM_WIDTHS = [
  'w-3/4',
  'w-1/2',
  'w-2/3',
  'w-4/5',
  'w-3/5',
  'w-2/3',
  'w-3/4',
  'w-4/5',
  'w-1/2',
  'w-3/5',
];

export function AuditTableSkeleton({ rowCount = 10 }: AuditTableSkeletonProps) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {/* Table Filter Toolbar Skeleton */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Search input placeholder */}
        <div className="relative w-full sm:max-w-xs sm:flex-1 md:max-w-sm">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search merchants, items, prompts..."
            disabled
            className="bg-background h-8 w-full pl-8 text-xs opacity-70"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date & Time filter button skeleton */}
          <Skeleton className="h-8 w-24 rounded-md" />

          {/* Status select dropdown skeleton */}
          <Skeleton className="h-8 w-38 rounded-md sm:w-44" />
        </div>
      </div>

      {/* Main Table Container with Exact Column Widths & Embedded Pagination */}
      <div className="bg-card w-full min-w-0 overflow-hidden rounded-lg border shadow-xs">
        <Table className="w-full min-w-210 table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-muted-foreground h-9 w-40 px-3 text-xs font-semibold">
                <div className="-ml-3 inline-flex h-8 items-center px-3 text-xs font-semibold">
                  Timestamp
                  <ArrowUpDownIcon className="text-muted-foreground ml-1.5 size-3" />
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground h-9 w-42.5 px-3 text-xs font-semibold">
                Merchant
              </TableHead>
              <TableHead className="text-muted-foreground h-9 min-w-50 px-3 text-xs font-semibold">
                Purchase Item
              </TableHead>
              <TableHead className="text-muted-foreground h-9 w-27.5 px-3 text-right text-xs font-semibold">
                <div className="text-right">
                  <span className="inline-flex h-8 items-center text-xs font-semibold">
                    Amount
                    <ArrowUpDownIcon className="text-muted-foreground ml-1 size-3" />
                  </span>
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground h-9 w-50 px-3 text-xs font-semibold">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rowCount }).map((_, idx) => (
              <TableRow key={idx} className="h-10 border-b">
                {/* Timestamp cell */}
                <TableCell className="w-40 px-3 py-2.5">
                  <Skeleton className="h-4 w-28" />
                </TableCell>

                {/* Merchant cell */}
                <TableCell className="w-42.5 px-3 py-2.5">
                  <Skeleton className="h-4 w-28" />
                </TableCell>

                {/* Purchase Item cell */}
                <TableCell className="min-w-50 px-3 py-2.5">
                  <Skeleton
                    className={`h-4 max-w-sm ${ROW_ITEM_WIDTHS[idx % ROW_ITEM_WIDTHS.length]}`}
                  />
                </TableCell>

                {/* Amount cell */}
                <TableCell className="w-27.5 px-3 py-2.5 text-right">
                  <Skeleton className="ml-auto h-4 w-14" />
                </TableCell>

                {/* Status cell */}
                <TableCell className="w-50 px-3 py-2.5">
                  <Skeleton className="h-5 w-24 rounded-full" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Real Pagination UI matching Data Table layout inside the card */}
        <div className="bg-muted/10 flex flex-col justify-between gap-3 border-t px-4 py-2.5 sm:flex-row sm:items-center">
          <div className="flex w-full items-center justify-between sm:w-auto sm:justify-start">
            <span className="text-muted-foreground font-mono text-xs">
              <Skeleton className="h-4 w-36" />
            </span>
          </div>

          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground hidden text-xs md:inline">Rows per page</span>
              <Select disabled value="10">
                <SelectTrigger className="bg-background h-7 w-16 text-xs opacity-70">
                  <SelectValue placeholder="10" />
                </SelectTrigger>
              </Select>
            </div>

            <span className="text-muted-foreground font-mono text-xs">Page 1 of 1</span>

            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="size-7 p-0" disabled>
                <ChevronLeftIcon className="size-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="size-7 p-0" disabled>
                <ChevronRightIcon className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
