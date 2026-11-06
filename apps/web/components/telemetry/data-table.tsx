'use client';

import { DateTimeFilter, type DateTimeFilterValue } from '@/components/telemetry/date-time-filter';
import { TelemetryDetailDrawer } from '@/components/telemetry/telemetry-detail-drawer';
import type { TelemetryItem } from '@/lib/agent/telemetry';
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type RowData,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@workspace/ui/components/empty';
import { Input } from '@workspace/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip';
import { cn } from '@workspace/ui/lib/utils';
import {
  AlertCircleIcon,
  ArrowUpDownIcon,
  BotIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  InboxIcon,
  ListFilterIcon,
  SearchIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  TagIcon,
  XCircleIcon,
  XIcon,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
  }
}

interface DataTableProps {
  data: TelemetryItem[];
}

export function AuditDataTable({ data }: DataTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlId = searchParams?.get('id') ?? null;
  const urlTab = searchParams?.get('tab') ?? null;

  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [selectedStatus, setSelectedStatus] = React.useState<string>('all');
  const [dateTimeFilter, setDateTimeFilter] = React.useState<DateTimeFilterValue | null>(null);

  const [selectedItem, setSelectedItem] = React.useState<TelemetryItem | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<string>(
    urlTab && ['overview', 'trace', 'payloads'].includes(urlTab) ? urlTab : 'overview',
  );

  // Sync state from URL search params (e.g., initial page load, deep links, or browser back/forward)
  React.useEffect(() => {
    if (urlId) {
      const match = data.find((item) => item.id === urlId);
      if (match) {
        setSelectedItem(match);
        setDrawerOpen(true);
      }
    } else {
      setDrawerOpen(false);
      setSelectedItem(null);
    }
  }, [urlId, data]);

  React.useEffect(() => {
    if (urlTab && ['overview', 'trace', 'payloads'].includes(urlTab)) {
      setActiveTab(urlTab);
    } else if (!urlTab) {
      setActiveTab('overview');
    }
  }, [urlTab]);

  // Helper to update query parameters while preserving any other existing search params
  const updateQueryParams = React.useCallback(
    (
      updates: { id?: string | null; tab?: string | null },
      method: 'push' | 'replace' = 'replace',
    ) => {
      const current = searchParams ? searchParams.toString() : '';
      const params = new URLSearchParams(current);

      if (updates.id !== undefined) {
        if (updates.id) {
          params.set('id', updates.id);
        } else {
          params.delete('id');
        }
      }

      if (updates.tab !== undefined) {
        if (updates.tab && updates.tab !== 'overview') {
          params.set('tab', updates.tab);
        } else {
          params.delete('tab');
        }
      }

      const queryString = params.toString();
      const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;
      if (method === 'push') {
        router.push(targetUrl, { scroll: false });
      } else {
        router.replace(targetUrl, { scroll: false });
      }
    },
    [router, pathname, searchParams],
  );

  const handleInspect = (item: TelemetryItem) => {
    setSelectedItem(item);
    setDrawerOpen(true);
    // Push new history entry on row click so browser "Back" closes the drawer
    updateQueryParams(
      {
        id: item.id,
        tab: activeTab !== 'overview' ? activeTab : null,
      },
      'push',
    );
  };

  const handleDrawerOpenChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      setSelectedItem(null);
      // Clean up URL query parameters when drawer closes
      updateQueryParams({ id: null, tab: null }, 'replace');
    }
  };

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    // Replace URL query param on tab switch to avoid back-button pollution
    updateQueryParams({ tab: newTab }, 'replace');
  };

  // Filter data by Timestamp filter and Status filter
  const filteredData = React.useMemo(() => {
    return data.filter((item) => {
      // 1. Status Filter
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'failed') {
          if (item.status !== 'failed' && item.status !== 'rejected') return false;
        } else if (item.status !== selectedStatus) {
          return false;
        }
      }

      // 2. Date Time Filter
      if (dateTimeFilter) {
        const itemDate = new Date(item.createdAt);
        const filterDate = dateTimeFilter.date;

        if (dateTimeFilter.mode === 'after') {
          if (itemDate.getTime() < filterDate.getTime()) return false;
        } else if (dateTimeFilter.mode === 'before') {
          if (itemDate.getTime() > filterDate.getTime()) return false;
        } else if (dateTimeFilter.mode === 'same_day') {
          if (
            itemDate.getFullYear() !== filterDate.getFullYear() ||
            itemDate.getMonth() !== filterDate.getMonth() ||
            itemDate.getDate() !== filterDate.getDate()
          ) {
            return false;
          }
        }
      }

      // 3. Text search
      if (globalFilter.trim()) {
        const search = globalFilter.toLowerCase();
        const matchesDescription = item.itemDescription.toLowerCase().includes(search);
        const matchesMerchant = item.merchantName.toLowerCase().includes(search);
        const matchesPrompt = item.prompt.toLowerCase().includes(search);
        const matchesCapture = item.paypalCaptureId?.toLowerCase().includes(search);

        if (!matchesDescription && !matchesMerchant && !matchesPrompt && !matchesCapture) {
          return false;
        }
      }

      return true;
    });
  }, [data, selectedStatus, dateTimeFilter, globalFilter]);

  const columns = React.useMemo<ColumnDef<TelemetryItem>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        meta: { className: 'w-[160px]' },
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground data-[state=open]:bg-accent -ml-3 h-8 text-xs font-semibold"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Timestamp
              <ArrowUpDownIcon className="text-muted-foreground ml-1.5 size-3" />
            </Button>
          );
        },
        cell: ({ row }) => {
          const date = new Date(row.getValue('createdAt'));
          const formattedDate = date.toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          const formattedTime = date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          return (
            <span className="text-muted-foreground block text-xs whitespace-nowrap">
              <span className="text-foreground font-medium">{formattedDate}</span>, {formattedTime}
            </span>
          );
        },
      },
      {
        accessorKey: 'merchantName',
        meta: { className: 'w-[170px]' },
        header: 'Merchant',
        cell: ({ row }) => {
          const item = row.original;
          const category = item.merchantCategory?.replace(/_/g, ' ') || 'Uncategorized';
          return (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-foreground block max-w-full cursor-help truncate text-sm font-semibold">
                    {item.merchantName}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs font-normal">
                  <div className="flex items-center gap-1.5">
                    <TagIcon className="size-3.5 shrink-0 text-blue-500" />
                    <span className="capitalize">{category}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        accessorKey: 'itemDescription',
        meta: { className: 'min-w-[200px]' },
        header: 'Purchase Item',
        cell: ({ row }) => {
          const item = row.original;
          return (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-foreground block max-w-full cursor-help truncate text-sm font-medium">
                    {item.itemDescription}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-lg text-xs text-wrap">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <BotIcon className="size-3.5 shrink-0 text-purple-500" />
                      <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                        Operator Prompt
                      </span>
                    </div>
                    <p className="text-foreground leading-normal text-wrap italic">
                      &ldquo;{item.prompt}&rdquo;
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        accessorKey: 'amountCents',
        meta: { className: 'w-[110px] text-right' },
        header: ({ column }) => {
          return (
            <div className="text-right">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground h-8 text-xs font-semibold"
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              >
                Amount
                <ArrowUpDownIcon className="text-muted-foreground ml-1 size-3" />
              </Button>
            </div>
          );
        },
        cell: ({ row }) => {
          const amount = row.original.amountCents;
          const currency = row.original.currency || 'USD';
          const formatted = (amount / 100).toLocaleString('en-US', {
            style: 'currency',
            currency,
          });
          return (
            <div className="text-foreground text-right font-mono text-sm font-bold tabular-nums">
              {formatted}
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        meta: { className: 'w-[200px]' },
        header: 'Status',
        cell: ({ row }) => {
          const item = row.original;
          const status = item.status;
          const rule = item.ruleTriggered;
          const rejection = item.rejectionReason;

          let tooltipText = 'Evaluated against agent policies';
          if (rejection) {
            tooltipText = `Policy Rejection: ${rejection}`;
          } else if (rule) {
            const friendlyRule = rule.replace(/_/g, ' ');
            tooltipText = `Guardrail Triggered: ${friendlyRule}`;
          } else if (status === 'completed') {
            tooltipText = 'Policy: Within auto-approval limits';
          } else if (status === 'pending') {
            tooltipText = 'Processing payment transaction';
          }

          return (
            <div className="flex items-center justify-between gap-2">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-flex cursor-help">
                      {status === 'completed' && (
                        <Badge className="inline-flex items-center gap-1.5 border-emerald-500/30 bg-emerald-500/15 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2Icon className="size-3.5 shrink-0" />
                          Completed
                        </Badge>
                      )}
                      {status === 'requires_approval' && (
                        <Badge className="inline-flex items-center gap-1.5 border-amber-500/30 bg-amber-500/15 text-xs font-medium text-amber-600 dark:text-amber-400">
                          <AlertCircleIcon className="size-3.5 shrink-0" />
                          Needs Approval
                        </Badge>
                      )}
                      {(status === 'rejected' || status === 'failed') && (
                        <Badge
                          variant="destructive"
                          className="inline-flex items-center gap-1.5 text-xs font-medium capitalize"
                        >
                          <XCircleIcon className="size-3.5 shrink-0" />
                          {status}
                        </Badge>
                      )}
                      {status !== 'completed' &&
                        status !== 'requires_approval' &&
                        status !== 'rejected' &&
                        status !== 'failed' && (
                          <Badge
                            variant="secondary"
                            className="inline-flex items-center gap-1.5 text-xs font-medium capitalize"
                          >
                            <ClockIcon className="size-3.5 shrink-0" />
                            {status.replace(/_/g, ' ')}
                          </Badge>
                        )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs font-normal">
                    <div className="flex items-center gap-1.5">
                      {status === 'completed' && (
                        <ShieldCheckIcon className="size-3.5 shrink-0 text-emerald-500" />
                      )}
                      {status === 'requires_approval' && (
                        <ShieldAlertIcon className="size-3.5 shrink-0 text-amber-500" />
                      )}
                      {(status === 'rejected' || status === 'failed') && (
                        <ShieldAlertIcon className="text-destructive size-3.5 shrink-0" />
                      )}
                      <span className="font-medium">{tooltipText}</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <ChevronRightIcon className="text-muted-foreground/30 group-hover:text-foreground size-4 shrink-0 transition-colors" />
            </div>
          );
        },
      },
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table useReactTable is supported at runtime
  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const hasActiveFilters =
    globalFilter !== '' || selectedStatus !== 'all' || dateTimeFilter !== null;

  const handleResetFilters = () => {
    setGlobalFilter('');
    setSelectedStatus('all');
    setDateTimeFilter(null);
  };

  const rows = table.getRowModel().rows;
  const selectedIndex = selectedItem
    ? rows.findIndex((r) => r.original.id === selectedItem.id)
    : -1;
  const hasPrevious = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < rows.length - 1;

  const handlePrevious = React.useCallback(() => {
    if (selectedIndex > 0) {
      const prev = rows[selectedIndex - 1]!.original;
      setSelectedItem(prev);
      updateQueryParams({ id: prev.id }, 'replace');
    }
  }, [selectedIndex, rows, updateQueryParams]);

  const handleNext = React.useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < rows.length - 1) {
      const next = rows[selectedIndex + 1]!.original;
      setSelectedItem(next);
      updateQueryParams({ id: next.id }, 'replace');
    }
  }, [selectedIndex, rows, updateQueryParams]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {/* Table Filter Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative w-full sm:max-w-xs sm:flex-1 md:max-w-sm">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search merchants, items, prompts..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="bg-background h-8 w-full pl-8 text-xs"
          />
          {globalFilter && (
            <button
              type="button"
              onClick={() => setGlobalFilter('')}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
            >
              <XIcon className="size-3" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date & Time Picker Filter in Timestamp column */}
          <DateTimeFilter value={dateTimeFilter} onChange={setDateTimeFilter} />

          {/* Status select dropdown */}
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="bg-background w-38 text-xs sm:w-44">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="all">
                <span className="flex items-center gap-1.5">
                  <ListFilterIcon className="text-muted-foreground size-3.5 shrink-0" />
                  <span>All Statuses</span>
                </span>
              </SelectItem>
              <SelectItem value="completed">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2Icon className="size-3.5 shrink-0 text-emerald-500" />
                  <span>Completed</span>
                </span>
              </SelectItem>
              <SelectItem value="requires_approval">
                <span className="flex items-center gap-1.5">
                  <AlertCircleIcon className="size-3.5 shrink-0 text-amber-500" />
                  <span>Needs Approval</span>
                </span>
              </SelectItem>
              <SelectItem value="failed">
                <span className="flex items-center gap-1.5">
                  <XCircleIcon className="text-destructive size-3.5 shrink-0" />
                  <span>Failed / Rejected</span>
                </span>
              </SelectItem>
              <SelectItem value="pending">
                <span className="flex items-center gap-1.5">
                  <ClockIcon className="text-muted-foreground size-3.5 shrink-0" />
                  <span>Pending</span>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
            >
              <XIcon className="mr-1 size-3" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-card w-full min-w-0 overflow-hidden rounded-lg border shadow-xs">
        <Table className="w-full min-w-210 table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      'text-muted-foreground h-9 px-3 text-xs font-semibold',
                      header.column.columnDef.meta?.className,
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => handleInspect(row.original)}
                  className="group hover:bg-muted/40 cursor-pointer transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn('px-3 py-2.5', cell.column.columnDef.meta?.className)}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-44 p-0 text-center">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <InboxIcon className="text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyTitle>No matching telemetry records</EmptyTitle>
                      <EmptyDescription>
                        Try adjusting your date and time or status filter criteria
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination Bar */}
        <div className="bg-muted/10 flex flex-col justify-between gap-3 border-t px-4 py-2.5 sm:flex-row sm:items-center">
          <div className="flex w-full items-center justify-between sm:w-auto sm:justify-start">
            <span className="text-muted-foreground font-mono text-xs">
              Showing {filteredData.length} of {data.length} records
            </span>
          </div>

          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground hidden text-xs md:inline">Rows per page</span>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger className="bg-background h-7 w-16 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <span className="text-muted-foreground font-mono text-xs">
              Page {table.getState().pagination.pageIndex + 1} of{' '}
              {Math.max(table.getPageCount(), 1)}
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="size-7 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeftIcon className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="size-7 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRightIcon className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-out Reasoning & Payloads Drawer */}
      <TelemetryDetailDrawer
        item={selectedItem}
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onPrevious={handlePrevious}
        onNext={handleNext}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        currentIndex={selectedIndex >= 0 ? selectedIndex + 1 : undefined}
        totalCount={rows.length}
      />
    </div>
  );
}
