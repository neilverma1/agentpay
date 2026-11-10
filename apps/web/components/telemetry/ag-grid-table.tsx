'use client';

import { TelemetryDetailDrawer } from '@/components/telemetry/telemetry-detail-drawer';
import useIsMounted from '@/hooks/useIsMounted';
import type { TelemetryItem } from '@/lib/agent/telemetry';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import {
  Select,
  SelectContent,
  SelectOption,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip';
import {
  AllCommunityModule,
  colorSchemeDark,
  colorSchemeLight,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  type IDoesFilterPassParams,
  type RowClickedEvent,
} from 'ag-grid-community';
import { AgGridReact, useGridFilter, type CustomFilterProps } from 'ag-grid-react';
import {
  AlertCircleIcon,
  BotIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  ListFilterIcon,
  SearchIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  TagIcon,
  XCircleIcon,
  XIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

// Register AG Grid Community modules once
ModuleRegistry.registerModules([AllCommunityModule]);

// Custom AgentPay Dark Theme matching shadcn semantic design tokens
export const agentPayDarkTheme = themeQuartz.withPart(colorSchemeDark).withParams({
  fontFamily: 'var(--font-sans), sans-serif',
  backgroundColor: 'var(--card)',
  foregroundColor: 'var(--card-foreground)',
  headerBackgroundColor: 'var(--muted)',
  headerTextColor: 'var(--muted-foreground)',
  borderColor: 'var(--border)',
  headerRowBorder: { style: 'solid', width: 1, color: 'var(--border)' },
  rowBorder: { style: 'solid', width: 1, color: 'var(--border)' },
  oddRowBackgroundColor: 'var(--card)',
  rowHoverColor: 'var(--accent)',
  selectedRowBackgroundColor: 'var(--muted)',
  accentColor: 'var(--primary)',
  borderRadius: 0,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  inputBorder: { style: 'solid', width: 1, color: 'var(--input)' },
  inputBackgroundColor: 'var(--background)',
  inputTextColor: 'var(--foreground)',
  menuBackgroundColor: 'var(--popover)',
  menuTextColor: 'var(--popover-foreground)',
  menuBorder: { style: 'solid', width: 1, color: 'var(--border)' },
  fontSize: 13,
});

// Custom AgentPay Light Theme matching shadcn semantic design tokens
export const agentPayLightTheme = themeQuartz.withPart(colorSchemeLight).withParams({
  fontFamily: 'var(--font-sans), sans-serif',
  backgroundColor: 'var(--card)',
  foregroundColor: 'var(--card-foreground)',
  headerBackgroundColor: 'var(--muted)',
  headerTextColor: 'var(--muted-foreground)',
  borderColor: 'var(--border)',
  headerRowBorder: { style: 'solid', width: 1, color: 'var(--border)' },
  rowBorder: { style: 'solid', width: 1, color: 'var(--border)' },
  oddRowBackgroundColor: 'var(--card)',
  rowHoverColor: 'var(--accent)',
  selectedRowBackgroundColor: 'var(--muted)',
  accentColor: 'var(--primary)',
  borderRadius: 0,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  inputBorder: { style: 'solid', width: 1, color: 'var(--input)' },
  inputBackgroundColor: 'var(--background)',
  inputTextColor: 'var(--foreground)',
  menuBackgroundColor: 'var(--popover)',
  menuTextColor: 'var(--popover-foreground)',
  menuBorder: { style: 'solid', width: 1, color: 'var(--border)' },
  fontSize: 13,
});

// Backward compatible alias
export const agentPayTheme = agentPayDarkTheme;

export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses', icon: ListFilterIcon, iconColor: 'text-muted-foreground' },
  { value: 'completed', label: 'Completed', icon: CheckCircle2Icon, iconColor: 'text-emerald-500' },
  {
    value: 'requires_approval',
    label: 'Needs Approval',
    icon: AlertCircleIcon,
    iconColor: 'text-amber-500',
  },
  { value: 'failed', label: 'Failed / Rejected', icon: XCircleIcon, iconColor: 'text-red-500' },
  { value: 'pending', label: 'Pending', icon: ClockIcon, iconColor: 'text-muted-foreground' },
] as const;

export function StatusColumnFilter({
  model,
  onModelChange,
}: CustomFilterProps<TelemetryItem, unknown, string>) {
  const currentVal = model || 'all';

  const doesFilterPass = React.useCallback(
    (params: IDoesFilterPassParams<TelemetryItem>) => {
      const item = params.node.data;
      if (!item || !model || model === 'all') return true;
      if (model === 'failed') return item.status === 'failed' || item.status === 'rejected';
      return item.status === model;
    },
    [model],
  );

  useGridFilter({
    doesFilterPass,
  });

  return (
    <div className="bg-popover text-popover-foreground border-border min-w-48 rounded-md p-1.5 shadow-md">
      <div className="text-muted-foreground px-2 py-1 text-[10px] font-semibold tracking-wider uppercase">
        Filter by Status
      </div>
      <div className="flex flex-col gap-0.5">
        {STATUS_FILTER_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = currentVal === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onModelChange(opt.value === 'all' ? null : opt.value);
              }}
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                isSelected
                  ? 'bg-accent text-accent-foreground font-semibold'
                  : 'hover:bg-muted text-foreground'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`size-3.5 ${opt.iconColor}`} />
                <span>{opt.label}</span>
              </div>
              {isSelected && <CheckIcon className="text-primary size-3.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface AgGridAuditTableProps {
  data: TelemetryItem[];
}

export function AgGridAuditTable({ data }: AgGridAuditTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { resolvedTheme } = useTheme();
  const isMounted = useIsMounted();

  const isDark = !isMounted || resolvedTheme === 'dark';
  const activeGridTheme = isDark ? agentPayDarkTheme : agentPayLightTheme;

  const urlId = searchParams?.get('id') ?? null;
  const urlTab = searchParams?.get('tab') ?? null;

  const [gridApi, setGridApi] = React.useState<GridApi<TelemetryItem> | null>(null);
  const [quickFilter, setQuickFilter] = React.useState('');
  const [selectedStatus, setSelectedStatus] = React.useState<string>('all');

  // Non-scrollable mobile pagination state
  const [currentPage, setCurrentPage] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [totalRows, setTotalRows] = React.useState(data.length);

  const [selectedItem, setSelectedItem] = React.useState<TelemetryItem | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<string>(
    urlTab && ['overview', 'trace', 'payloads'].includes(urlTab) ? urlTab : 'overview',
  );

  // Sync drawer state with URL search params
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

  const handleInspect = React.useCallback(
    (item: TelemetryItem) => {
      setSelectedItem(item);
      setDrawerOpen(true);
      updateQueryParams(
        {
          id: item.id,
          tab: activeTab !== 'overview' ? activeTab : null,
        },
        'push',
      );
    },
    [activeTab, updateQueryParams],
  );

  const handleDrawerOpenChange = React.useCallback(
    (open: boolean) => {
      setDrawerOpen(open);
      if (!open) {
        setSelectedItem(null);
        updateQueryParams({ id: null, tab: null }, 'replace');
      }
    },
    [updateQueryParams],
  );

  const handleTabChange = React.useCallback(
    (newTab: string) => {
      setActiveTab(newTab);
      updateQueryParams({ tab: newTab }, 'replace');
    },
    [updateQueryParams],
  );

  const updatePaginationState = React.useCallback((api: GridApi<TelemetryItem>) => {
    setCurrentPage(api.paginationGetCurrentPage());
    setTotalPages(Math.max(api.paginationGetTotalPages(), 1));
    setPageSize(api.paginationGetPageSize());
    setTotalRows(api.paginationGetRowCount());
  }, []);

  const onGridReady = (params: GridReadyEvent<TelemetryItem>) => {
    setGridApi(params.api);
    if (quickFilter) {
      params.api.setGridOption('quickFilterText', quickFilter);
    }
    updatePaginationState(params.api);
  };

  const onPaginationChanged = React.useCallback(() => {
    if (gridApi) {
      updatePaginationState(gridApi);
    }
  }, [gridApi, updatePaginationState]);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    if (gridApi) {
      gridApi.setGridOption('paginationPageSize', newSize);
    }
  };

  const handleQuickFilterChange = (text: string) => {
    setQuickFilter(text);
    if (gridApi) {
      gridApi.setGridOption('quickFilterText', text);
    }
  };

  const onFilterChanged = React.useCallback(() => {
    if (gridApi) {
      const statusModel = gridApi.getColumnFilterModel<string>('status');
      setSelectedStatus(statusModel ?? 'all');
      updatePaginationState(gridApi);
    }
  }, [gridApi, updatePaginationState]);

  const handleReset = async () => {
    handleQuickFilterChange('');
    setSelectedStatus('all');
    if (gridApi) {
      await gridApi.setColumnFilterModel('status', null);
      gridApi.onFilterChanged();
    }
  };

  const handleExportCsv = () => {
    if (gridApi) {
      gridApi.exportDataAsCsv({
        fileName: `agentpay-telemetry-${new Date().toISOString().slice(0, 10)}.csv`,
      });
    }
  };

  // Filter items by status before passing to rowData
  const rowData = React.useMemo(() => {
    if (selectedStatus === 'all') return data;
    if (selectedStatus === 'failed') {
      return data.filter((item) => item.status === 'failed' || item.status === 'rejected');
    }
    return data.filter((item) => item.status === selectedStatus);
  }, [data, selectedStatus]);

  // Next / Previous navigation inside Drawer
  const selectedIndex = selectedItem ? rowData.findIndex((r) => r.id === selectedItem.id) : -1;
  const hasPrevious = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < rowData.length - 1;

  const handlePrevious = React.useCallback(() => {
    if (selectedIndex > 0) {
      const prev = rowData[selectedIndex - 1]!;
      setSelectedItem(prev);
      updateQueryParams({ id: prev.id }, 'replace');
    }
  }, [selectedIndex, rowData, updateQueryParams]);

  const handleNext = React.useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < rowData.length - 1) {
      const next = rowData[selectedIndex + 1]!;
      setSelectedItem(next);
      updateQueryParams({ id: next.id }, 'replace');
    }
  }, [selectedIndex, rowData, updateQueryParams]);

  // Column Definitions
  const colDefs = React.useMemo<ColDef<TelemetryItem>[]>(
    () => [
      {
        field: 'createdAt',
        headerName: 'Timestamp',
        width: 170,
        sort: 'desc',
        cellRenderer: (params: ICellRendererParams<TelemetryItem>) => {
          if (!params.value) return null;
          const date = new Date(params.value as string);
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
            <div className="text-muted-foreground flex h-full items-center text-xs">
              <span className="text-foreground font-medium">{formattedDate}</span>,&nbsp;
              {formattedTime}
            </div>
          );
        },
      },
      {
        field: 'merchantName',
        headerName: 'Merchant',
        width: 180,
        cellRenderer: (params: ICellRendererParams<TelemetryItem>) => {
          const item = params.data;
          if (!item) return null;
          const category = item.merchantCategory?.replace(/_/g, ' ') || 'Uncategorized';
          return (
            <div className="flex h-full items-center">
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-foreground block max-w-full cursor-help truncate text-sm font-semibold">
                      {item.merchantName}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs font-normal">
                    <div className="flex items-center gap-1.5">
                      <TagIcon className="text-primary size-3.5 shrink-0" />
                      <span className="capitalize">{category}</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        },
      },
      {
        field: 'itemDescription',
        headerName: 'Purchase Item',
        flex: 1,
        minWidth: 200,
        cellRenderer: (params: ICellRendererParams<TelemetryItem>) => {
          const item = params.data;
          if (!item) return null;
          return (
            <div className="flex h-full items-center">
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
                        <BotIcon className="text-primary size-3.5 shrink-0" />
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
            </div>
          );
        },
      },
      {
        field: 'amountCents',
        headerName: 'Amount',
        width: 130,
        comparator: (valueA: number, valueB: number) => valueA - valueB,
        cellRenderer: (params: ICellRendererParams<TelemetryItem>) => {
          const cents = (params.value as number) || 0;
          const formatted = (cents / 100).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
          });
          return (
            <div className="text-foreground flex h-full items-center justify-end font-mono text-sm font-bold">
              {formatted}
            </div>
          );
        },
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 190,
        filter: StatusColumnFilter,
        cellRenderer: (params: ICellRendererParams<TelemetryItem>) => {
          const item = params.data;
          if (!item) return null;
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
            <div className="flex h-full items-center justify-between gap-2">
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
              <ChevronRightIcon className="text-muted-foreground/30 size-4 shrink-0 transition-colors" />
            </div>
          );
        },
      },
    ],
    [],
  );

  const defaultColDef = React.useMemo<ColDef>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
    }),
    [],
  );

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {/* AG Grid Top Controls Toolbar */}
      <div className="flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Quick Search Input */}
          <div className="relative w-full sm:max-w-xs md:max-w-sm">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              placeholder="Filter by merchant, item, prompt..."
              value={quickFilter}
              onChange={(e) => handleQuickFilterChange(e.target.value)}
              className="border-accent h-8 w-full pl-8 text-xs"
            />
            {quickFilter && (
              <button
                type="button"
                onClick={() => handleQuickFilterChange('')}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
              >
                <XIcon className="size-3" />
              </button>
            )}
          </div>

          {/* Reset Filters Button */}
          {(quickFilter || selectedStatus !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
            >
              <XIcon className="mr-1 size-3" />
              Reset
            </Button>
          )}
        </div>

        {/* Toolbar Right: Export CSV */}
        <div className="flex items-center gap-2">
          {/* CSV Export Button (AG Grid Native Power) */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="text-foreground border-border bg-background hover:bg-muted h-8 gap-1.5 text-xs"
          >
            <DownloadIcon className="text-muted-foreground size-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Main AG Grid Container with Custom Theme */}
      <div className="bg-card border-border w-full overflow-hidden rounded-lg border shadow-xs">
        <div style={{ height: 480, width: '100%' }}>
          <AgGridReact<TelemetryItem>
            theme={activeGridTheme}
            rowData={rowData}
            columnDefs={colDefs}
            defaultColDef={defaultColDef}
            pagination={true}
            paginationPageSize={pageSize}
            paginationPageSizeSelector={[10, 20, 50]}
            suppressPaginationPanel={true}
            onPaginationChanged={onPaginationChanged}
            onFilterChanged={onFilterChanged}
            rowClass="cursor-pointer"
            onGridReady={onGridReady}
            onRowClicked={(event: RowClickedEvent<TelemetryItem>) => {
              if (event.data) {
                handleInspect(event.data);
              }
            }}
            animateRows={true}
            domLayout="normal"
          />
        </div>

        {/* Responsive, Non-Scrollable Mobile Pagination Bar */}
        <div className="bg-muted/10 border-border flex flex-col justify-between gap-3 border-t px-4 py-2.5 sm:flex-row sm:items-center">
          <div className="flex w-full items-center justify-between sm:w-auto sm:justify-start">
            <span className="text-muted-foreground font-mono text-xs">
              Showing {totalRows} of {data.length} records
            </span>
          </div>

          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground hidden text-xs md:inline">Rows per page</span>
              <Select
                value={`${pageSize}`}
                onValueChange={(value) => handlePageSizeChange(Number(value))}
              >
                <SelectTrigger className="bg-background h-7 w-16 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 50].map((size) => (
                    <SelectOption key={size} value={`${size}`}>
                      {size}
                    </SelectOption>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <span className="text-muted-foreground font-mono text-xs">
              Page {currentPage + 1} of {Math.max(totalPages, 1)}
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="size-7 p-0"
                onClick={() => gridApi?.paginationGoToPreviousPage()}
                disabled={currentPage <= 0}
                aria-label="Previous page"
              >
                <ChevronLeftIcon className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="size-7 p-0"
                onClick={() => gridApi?.paginationGoToNextPage()}
                disabled={currentPage >= totalPages - 1}
                aria-label="Next page"
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
        totalCount={rowData.length}
      />
    </div>
  );
}
