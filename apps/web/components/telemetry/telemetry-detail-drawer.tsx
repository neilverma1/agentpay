'use client';

import type { TelemetryItem } from '@workspace/agent';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@workspace/ui/components/alert';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@workspace/ui/components/code-block';
import { CopyButton, CopyableChip } from '@workspace/ui/components/copy-button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@workspace/ui/components/empty';
import { Kbd } from '@workspace/ui/components/kbd';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@workspace/ui/components/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip';
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceTitle,
} from '@workspace/ui/components/trace';
import { cn } from '@workspace/ui/lib/utils';
import { formatDate, formatDistanceToNow } from '@workspace/utils';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BotIcon,
  BrainIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  FileJsonIcon,
  LayoutDashboardIcon,
  Loader2Icon,
  RotateCcwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  StoreIcon,
  TagIcon,
  TerminalIcon,
  UserIcon,
  WrenchIcon,
  XCircleIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

export interface TelemetryDetailDrawerProps {
  item: TelemetryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  currentIndex?: number;
  totalCount?: number;
}

export function TelemetryDetailDrawer({
  item,
  open,
  onOpenChange,
  activeTab: controlledActiveTab,
  onTabChange: controlledOnTabChange,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  currentIndex,
  totalCount,
}: TelemetryDetailDrawerProps) {
  const [internalTab, setInternalTab] = useState<string>('overview');
  const activeTab = controlledActiveTab ?? internalTab;

  const handleTabChange = (tab: string) => {
    if (controlledOnTabChange) {
      controlledOnTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  // Keyboard navigation for Previous / Next transactions (ArrowLeft/k, ArrowRight/j)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if ((e.key === 'ArrowLeft' || e.key === 'k') && hasPrevious && onPrevious) {
        e.preventDefault();
        onPrevious();
      } else if ((e.key === 'ArrowRight' || e.key === 'j') && hasNext && onNext) {
        e.preventDefault();
        onNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, hasPrevious, hasNext, onPrevious, onNext]);

  if (!item) return null;

  const formattedAmount = (item.amountCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: item.currency || 'USD',
  });

  const createdDate = new Date(item.createdAt);
  const formattedFullDate = isNaN(createdDate.getTime())
    ? item.createdAt
    : formatDate(createdDate, 'PP · p');
  const relativeDate = isNaN(createdDate.getTime())
    ? ''
    : formatDistanceToNow(createdDate, { addSuffix: true });

  const isSimulatedOrder =
    !item.paypalOrderId ||
    item.paypalOrderId.startsWith('SIMULATED-') ||
    item.paypalOrderId === 'SANDBOX_CAPTURED';

  const isSimulatedCapture =
    !item.paypalCaptureId ||
    item.paypalCaptureId.startsWith('SIMULATED-') ||
    item.paypalCaptureId === 'SANDBOX_CAPTURED';

  const isRefunded = item.transactionStatus === 'refunded';

  const renderStatusBadge = (status: string) => {
    if (isRefunded) {
      return (
        <Badge className="inline-flex items-center gap-1.5 border-amber-500/30 bg-amber-500/15 text-xs font-medium text-amber-700 dark:text-amber-400">
          <RotateCcwIcon className="size-3.5 shrink-0" />
          Refunded via PayPal
        </Badge>
      );
    }
    switch (status) {
      case 'completed':
        return (
          <Badge className="inline-flex items-center gap-1.5 border-emerald-500/30 bg-emerald-500/15 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2Icon className="size-3.5 shrink-0" />
            Completed
          </Badge>
        );
      case 'requires_approval':
        return (
          <Badge className="inline-flex items-center gap-1.5 border-amber-500/30 bg-amber-500/15 text-xs font-medium text-amber-600 dark:text-amber-400">
            <AlertCircleIcon className="size-3.5 shrink-0" />
            Needs Approval
          </Badge>
        );
      case 'rejected':
      case 'failed':
        return (
          <Badge
            variant="destructive"
            className="inline-flex items-center gap-1.5 text-xs font-medium capitalize"
          >
            <XCircleIcon className="size-3.5 shrink-0" />
            {status}
          </Badge>
        );
      case 'executing_payment':
        return (
          <Badge
            variant="secondary"
            className="inline-flex items-center gap-1.5 border-blue-500/30 bg-blue-500/10 text-xs font-medium text-blue-600 dark:text-blue-400"
          >
            <Loader2Icon className="size-3.5 shrink-0 animate-spin" />
            Executing Payment
          </Badge>
        );
      case 'pending':
        return (
          <Badge
            variant="secondary"
            className="inline-flex items-center gap-1.5 border-amber-500/30 bg-amber-500/10 text-xs font-medium text-amber-600 dark:text-amber-400"
          >
            <ClockIcon className="size-3.5 shrink-0" />
            Evaluating Policy
          </Badge>
        );
      default:
        return (
          <Badge
            variant="secondary"
            className="inline-flex items-center gap-1.5 text-xs font-medium capitalize"
          >
            <ClockIcon className="size-3.5 shrink-0" />
            {status.replace(/_/g, ' ')}
          </Badge>
        );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl"
      >
        {/* Navigation & Header */}
        <SheetHeader className="bg-background/95 z-10 shrink-0 gap-2 border-b px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-10">
            {/* Row Navigation (Previous / Next) */}
            <div className="flex items-center gap-1">
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="size-7 p-0"
                      disabled={!hasPrevious}
                      onClick={onPrevious}
                      aria-label="Previous transaction (ArrowLeft or k)"
                    >
                      <ChevronLeftIcon className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="flex items-center gap-1.5 text-xs">
                    <span>Previous record</span>
                    <Kbd className="size-5 p-0">
                      <ArrowLeftIcon className="text-foreground size-3" />
                    </Kbd>
                    <span className="text-muted-foreground/70 text-[11px]">or</span>
                    <Kbd className="text-foreground size-5 p-0">K</Kbd>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="size-7 p-0"
                      disabled={!hasNext}
                      onClick={onNext}
                      aria-label="Next transaction (ArrowRight or j)"
                    >
                      <ChevronRightIcon className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="flex items-center gap-1.5 text-xs">
                    <span>Next record</span>
                    <Kbd className="size-5 p-0">
                      <ArrowRightIcon className="text-foreground size-3" />
                    </Kbd>
                    <span className="text-muted-foreground/70 text-[11px]">or</span>
                    <Kbd className="text-foreground size-5 p-0">J</Kbd>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {currentIndex && totalCount ? (
                <span className="text-muted-foreground ml-1.5 font-mono text-xs tabular-nums">
                  {currentIndex} of {totalCount}
                </span>
              ) : null}
            </div>

            {/* Quick Actions & Status Badge */}
            <div className="flex items-center gap-2">
              <CopyableChip
                value={item.id}
                displayValue={`ID: ${item.id.slice(0, 8)}...`}
                tooltip="Click to copy full Intent ID"
              />
              {renderStatusBadge(item.status)}
            </div>
          </div>

          {/* Title & Metadata */}
          <div className="flex flex-col gap-1 pt-1">
            <SheetTitle className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
              {item.itemDescription}
            </SheetTitle>
            <SheetDescription className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
              <span className="text-foreground flex items-center gap-1.5 font-medium">
                <StoreIcon className="text-muted-foreground size-3.5 shrink-0" />
                {item.merchantName}
              </span>

              <Badge
                variant="secondary"
                className="gap-1 px-2 py-0.5 text-[11px] font-normal capitalize"
              >
                <TagIcon className="text-muted-foreground size-3" />
                {item.merchantCategory?.replace(/_/g, ' ') || 'Uncategorized'}
              </Badge>

              <span className="flex items-center gap-1.5 tabular-nums">
                <CalendarClockIcon className="text-muted-foreground size-3.5 shrink-0" />
                <span>{formattedFullDate}</span>
                {relativeDate && <span className="text-muted-foreground/70">({relativeDate})</span>}
              </span>
            </SheetDescription>
          </div>
        </SheetHeader>

        {/* Scrollable Content Body with Padding */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col gap-5">
            <TabsList className="bg-muted/70 grid h-9 w-full grid-cols-3 p-1">
              <TabsTrigger
                value="overview"
                className="group/tab data-[state=active]:bg-background data-[state=active]:text-foreground gap-1.5 px-2 text-xs font-medium transition-all data-[state=active]:font-semibold data-[state=active]:shadow-xs"
              >
                <LayoutDashboardIcon className="text-muted-foreground size-3.5 shrink-0 transition-colors group-data-[state=active]/tab:text-blue-600 dark:group-data-[state=active]/tab:text-blue-400" />
                <span className="truncate">Overview</span>
              </TabsTrigger>
              <TabsTrigger
                value="trace"
                aria-label="Reasoning Trace"
                className="group/tab data-[state=active]:bg-background data-[state=active]:text-foreground gap-1.5 px-2 text-xs font-medium transition-all data-[state=active]:font-semibold data-[state=active]:shadow-xs"
              >
                <BotIcon className="text-muted-foreground size-3.5 shrink-0 transition-colors group-data-[state=active]/tab:text-purple-600 dark:group-data-[state=active]/tab:text-purple-400" />
                <span className="truncate">
                  <span className="hidden sm:inline">Reasoning </span>Trace
                </span>
                {item.reasoningLog.length > 0 && (
                  <span className="bg-muted-foreground/15 text-muted-foreground ml-0.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold transition-colors group-data-[state=active]/tab:bg-purple-500/15 group-data-[state=active]/tab:text-purple-600 dark:group-data-[state=active]/tab:text-purple-400">
                    {item.reasoningLog.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="payloads"
                aria-label="Payloads & Ledger"
                className="group/tab data-[state=active]:bg-background data-[state=active]:text-foreground gap-1.5 px-2 text-xs font-medium transition-all data-[state=active]:font-semibold data-[state=active]:shadow-xs"
              >
                <TerminalIcon className="text-muted-foreground size-3.5 shrink-0 transition-colors group-data-[state=active]/tab:text-emerald-600 dark:group-data-[state=active]/tab:text-emerald-400" />
                <span className="truncate">
                  Payloads<span className="hidden sm:inline"> & Ledger</span>
                </span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW */}
            <TabsContent value="overview" className="flex flex-col gap-5">
              {/* Sleek Financial Metric Banner */}
              <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                    Transaction Amount
                  </span>
                  <span className="text-foreground font-mono text-2xl font-bold tabular-nums">
                    {formattedAmount}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleTabChange('trace')}
                    className="hover:bg-muted text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
                  >
                    <BotIcon className="size-3.5 text-purple-500" />
                    <span>{item.reasoningStepCount} Reasoning Steps</span>
                    <ChevronRightIcon className="size-3" />
                  </button>
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="border-border/80 bg-background/50 text-muted-foreground cursor-default gap-1.5 px-2.5 py-1 text-xs font-normal"
                        >
                          <CreditCardIcon className="size-3.5 text-blue-500" />
                          <span>PayPal Sandbox</span>
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        Simulated payment environment powered by PayPal Developer Sandbox
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* Operator Prompt Callout with Copy Action */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                    <UserIcon className="text-muted-foreground size-3.5" />
                    Original Operator Prompt
                  </span>
                  <CopyButton
                    value={item.prompt}
                    label="Copy prompt"
                    tooltip="Copy operator prompt"
                    className="h-6 px-2 text-xs"
                  />
                </div>
                <div className="bg-muted/20 text-foreground rounded-lg border p-3.5 text-sm italic shadow-2xs">
                  &ldquo;{item.prompt}&rdquo;
                </div>
              </div>

              {/* Rejection / Failure Banner */}
              {item.rejectionReason && (
                <Alert variant="destructive">
                  <AlertCircleIcon className="size-4" />
                  <AlertTitle>Policy Violation & Rejection</AlertTitle>
                  <AlertDescription>{item.rejectionReason}</AlertDescription>
                </Alert>
              )}

              {/* Guardrail Policy Breakdown */}
              {item.ruleTriggered ? (
                <div className="flex flex-col gap-2">
                  <span className="text-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                    <ShieldAlertIcon className="size-4 text-amber-500" />
                    Guardrail Policy Evaluation
                  </span>
                  <div className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-amber-800 dark:text-amber-300">
                        Rule Triggered: {item.ruleTriggered.replace(/_/g, ' ')}
                      </span>
                      {item.approvalStatus && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/40 font-mono text-xs uppercase"
                        >
                          Approval: {item.approvalStatus}
                        </Badge>
                      )}
                    </div>

                    {item.approvalRequestId && (
                      <div className="flex items-center justify-between border-t border-amber-500/20 pt-2 text-xs">
                        <span className="font-medium text-amber-800/80 dark:text-amber-300/80">
                          Approval Request ID:
                        </span>
                        <CopyableChip
                          value={item.approvalRequestId}
                          displayValue={`${item.approvalRequestId.slice(0, 8)}...`}
                          tooltip="Click to copy Approval Request ID"
                        />
                      </div>
                    )}

                    {item.triggerDetails && Object.keys(item.triggerDetails).length > 0 && (
                      <div className="flex flex-col gap-1.5 border-t border-amber-500/20 pt-2.5">
                        <span className="text-[11px] font-semibold tracking-wider text-amber-900/80 uppercase dark:text-amber-200/80">
                          Trigger Parameters
                        </span>
                        <CodeBlock size="sm" className="bg-background/80">
                          <CodeBlockActions>
                            <CodeBlockCopyButton
                              value={JSON.stringify(item.triggerDetails, null, 2)}
                            />
                          </CodeBlockActions>
                          <CodeBlockContent className="max-h-48 text-xs">
                            {JSON.stringify(item.triggerDetails, null, 2)}
                          </CodeBlockContent>
                        </CodeBlock>
                      </div>
                    )}
                  </div>
                </div>
              ) : item.status === 'completed' ? (
                <Alert variant="success">
                  <ShieldCheckIcon className="size-4" />
                  <AlertTitle>Autonomous Execution Approved</AlertTitle>
                  <AlertDescription>
                    All transaction criteria satisfied automated spending limit rules and category
                    guardrails.
                  </AlertDescription>
                </Alert>
              ) : null}

              {/* PayPal Ledger Identifiers */}
              <div className="flex flex-col gap-2">
                <span className="text-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <CreditCardIcon className="size-4 text-blue-500" />
                  PayPal Ledger Identifiers
                </span>
                <div className="bg-card divide-border divide-y rounded-lg border text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span className="text-muted-foreground text-xs font-medium">
                      PayPal Order ID
                    </span>
                    <div className="flex items-center gap-1.5">
                      {item.paypalOrderId ? (
                        <>
                          <CopyableChip
                            value={item.paypalOrderId}
                            tooltip="Click to copy Order ID"
                          />
                          {!isSimulatedOrder ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-7 p-0"
                              asChild
                              title="Open PayPal Sandbox Activity"
                            >
                              <a
                                href={`https://www.sandbox.paypal.com/activity/payment/${item.paypalOrderId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLinkIcon className="text-muted-foreground size-3.5" />
                              </a>
                            </Button>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-border text-muted-foreground/80 font-mono text-[10px]"
                              title="Simulated via local sandbox fallback"
                            >
                              Simulated
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground font-mono text-xs">None</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span className="text-muted-foreground text-xs font-medium">
                      PayPal Capture ID
                    </span>
                    <div className="flex items-center gap-1.5">
                      {item.paypalCaptureId ? (
                        <>
                          <CopyableChip
                            value={item.paypalCaptureId}
                            tooltip="Click to copy Capture ID"
                          />
                          {!isSimulatedCapture ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-7 p-0"
                              asChild
                              title="Open PayPal Sandbox Activity"
                            >
                              <a
                                href={`https://www.sandbox.paypal.com/activity/payment/${item.paypalCaptureId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLinkIcon className="text-muted-foreground size-3.5" />
                              </a>
                            </Button>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-border text-muted-foreground/80 font-mono text-[10px]"
                              title="Simulated via local sandbox fallback"
                            >
                              Simulated
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground font-mono text-xs">None</span>
                      )}
                    </div>
                  </div>

                  {item.transactionStatus && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-muted-foreground text-xs font-medium">
                        Ledger Settlement
                      </span>
                      <Badge
                        variant={item.transactionStatus === 'refunded' ? 'outline' : 'secondary'}
                        className={`font-mono text-xs capitalize ${
                          item.transactionStatus === 'refunded'
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                            : ''
                        }`}
                      >
                        {item.transactionStatus === 'refunded'
                          ? 'Reversed (Refunded)'
                          : item.transactionStatus}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: REASONING TRACE */}
            <TabsContent value="trace" className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <BotIcon className="size-4 text-purple-500" />
                  Step-by-Step Autonomous Reasoning Pipeline
                </span>
                <span className="text-muted-foreground font-mono text-xs">
                  {item.reasoningLog.length} {item.reasoningLog.length === 1 ? 'step' : 'steps'}
                </span>
              </div>

              {item.reasoningLog.length === 0 ? (
                <Empty className="rounded-lg border py-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <BotIcon />
                    </EmptyMedia>
                    <EmptyTitle>No reasoning trace recorded</EmptyTitle>
                    <EmptyDescription>
                      This transaction completed without capturing intermediate reasoning steps.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="flex flex-col gap-4">
                  {item.reasoningLog.map((step, idx) => {
                    const stepNum = (step.step as number) || idx + 1;
                    const toolName = (step.toolName as string) || 'evaluateIntent';
                    const thought = (step.thought as string) || '';
                    const input = step.input as Record<string, unknown> | undefined;
                    const output = step.output as Record<string, unknown> | undefined;
                    const stepDate = step.timestamp ? new Date(step.timestamp as string) : null;
                    const stepTime =
                      stepDate && !isNaN(stepDate.getTime())
                        ? formatDate(stepDate, 'h:mm:ss a')
                        : null;

                    const isLastStep = idx === item.reasoningLog.length - 1;
                    const isViolationStep =
                      (item.rejectionReason && isLastStep) ||
                      (item.ruleTriggered && toolName.toLowerCase().includes('policy'));

                    return (
                      <div
                        key={idx}
                        className={cn(
                          'bg-card/60 flex flex-col overflow-hidden rounded-xl border shadow-2xs transition-colors',
                          isViolationStep && 'border-amber-500/40 bg-amber-500/5',
                        )}
                      >
                        {/* Step Header */}
                        <div className="bg-muted/20 flex flex-col gap-1.5 border-b px-3.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-2.5">
                          {/* Row 1 on mobile, Left on desktop: Step + Tool Name + (Status on desktop) */}
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="shrink-0 px-1.5 py-0.5 font-mono text-[10px] font-semibold sm:text-[11px]"
                            >
                              Step {stepNum}
                            </Badge>
                            <span className="text-foreground flex items-center gap-1.5 font-mono text-xs font-semibold sm:text-sm">
                              <WrenchIcon className="text-muted-foreground size-3.5 shrink-0" />
                              <span>{toolName}</span>
                            </span>
                            {/* Desktop Status Badge */}
                            <div className="hidden sm:block">
                              {isViolationStep ? (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 border-amber-500/40 bg-amber-500/10 font-mono text-[10px] font-semibold text-amber-700 uppercase dark:text-amber-400"
                                >
                                  Policy Flagged
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 border-emerald-500/30 bg-emerald-500/10 font-mono text-[10px] font-semibold text-emerald-600 uppercase dark:text-emerald-400"
                                >
                                  Executed
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Row 2 on mobile, Right on desktop: Status on mobile + Timestamp */}
                          <div className="flex items-center justify-between gap-2 sm:justify-end">
                            <div className="sm:hidden">
                              {isViolationStep ? (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 border-amber-500/40 bg-amber-500/10 font-mono text-[10px] font-semibold text-amber-700 uppercase dark:text-amber-400"
                                >
                                  Policy Flagged
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 border-emerald-500/30 bg-emerald-500/10 font-mono text-[10px] font-semibold text-emerald-600 uppercase dark:text-emerald-400"
                                >
                                  Executed
                                </Badge>
                              )}
                            </div>
                            {stepTime && (
                              <span className="text-muted-foreground font-mono text-[11px] whitespace-nowrap tabular-nums sm:text-xs">
                                {stepTime}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Content Body with Padding */}
                        <div className="flex flex-col gap-3 p-4">
                          {/* AI Elements Trace Tree */}
                          <Trace className="gap-2.5">
                            {/* 1. Agent Rationale (Reasoning Collapsible) */}
                            {thought && (
                              <TraceCollapsible defaultOpen={true}>
                                <TraceCollapsibleTrigger className="hover:text-foreground text-foreground/90 text-xs font-medium">
                                  <TraceIcon>
                                    <BrainIcon className="size-3.5 text-purple-500" />
                                  </TraceIcon>
                                  <TraceTitle>Agent Rationale</TraceTitle>
                                </TraceCollapsibleTrigger>
                                <TraceCollapsibleContent className="text-foreground text-xs leading-relaxed">
                                  <div
                                    className={cn(
                                      'rounded-md border p-3 text-xs leading-relaxed',
                                      isViolationStep
                                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                                        : 'border-border/60 text-foreground bg-transparent',
                                    )}
                                  >
                                    {thought}
                                  </div>
                                </TraceCollapsibleContent>
                              </TraceCollapsible>
                            )}

                            {/* 2. Tool Arguments */}
                            {input && Object.keys(input).length > 0 && (
                              <TraceCollapsible defaultOpen={false}>
                                <TraceCollapsibleTrigger className="text-xs">
                                  <TraceIcon>
                                    <TerminalIcon className="size-3.5 text-blue-500" />
                                  </TraceIcon>
                                  <TraceTitle className="font-mono">
                                    Tool Arguments ({Object.keys(input).length})
                                  </TraceTitle>
                                </TraceCollapsibleTrigger>
                                <TraceCollapsibleContent>
                                  <CodeBlock size="sm" className="mt-1">
                                    <CodeBlockActions>
                                      <CodeBlockCopyButton value={JSON.stringify(input, null, 2)} />
                                    </CodeBlockActions>
                                    <CodeBlockContent className="max-h-48 text-xs">
                                      {JSON.stringify(input, null, 2)}
                                    </CodeBlockContent>
                                  </CodeBlock>
                                </TraceCollapsibleContent>
                              </TraceCollapsible>
                            )}

                            {/* 3. Tool Execution Result */}
                            {output && Object.keys(output).length > 0 && (
                              <TraceCollapsible defaultOpen={false}>
                                <TraceCollapsibleTrigger className="text-xs">
                                  <TraceIcon>
                                    {isViolationStep ? (
                                      <AlertCircleIcon className="text-destructive size-3.5" />
                                    ) : (
                                      <CheckCircle2Icon className="size-3.5 text-emerald-500" />
                                    )}
                                  </TraceIcon>
                                  <TraceTitle className="font-mono">
                                    Tool Execution Result
                                  </TraceTitle>
                                </TraceCollapsibleTrigger>
                                <TraceCollapsibleContent>
                                  <CodeBlock size="sm" className="mt-1">
                                    <CodeBlockActions>
                                      <CodeBlockCopyButton
                                        value={JSON.stringify(output, null, 2)}
                                      />
                                    </CodeBlockActions>
                                    <CodeBlockContent className="max-h-48 text-xs">
                                      {JSON.stringify(output, null, 2)}
                                    </CodeBlockContent>
                                  </CodeBlock>
                                </TraceCollapsibleContent>
                              </TraceCollapsible>
                            )}
                          </Trace>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* TAB 3: PAYLOADS & LEDGER */}
            <TabsContent value="payloads" className="flex flex-col gap-5">
              {/* Raw PayPal Gateway Payload */}
              <div className="flex flex-col gap-2">
                <span className="text-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <CreditCardIcon className="size-4 text-blue-500" />
                  PayPal Gateway API Response
                </span>

                {item.rawPaypalResponse ? (
                  <CodeBlock size="sm">
                    <CodeBlockHeader>
                      <CodeBlockTitle>Response Body</CodeBlockTitle>
                      <CodeBlockActions>
                        <CodeBlockCopyButton
                          value={JSON.stringify(item.rawPaypalResponse, null, 2)}
                        />
                      </CodeBlockActions>
                    </CodeBlockHeader>
                    <CodeBlockContent className="max-h-64 text-xs">
                      {JSON.stringify(item.rawPaypalResponse, null, 2)}
                    </CodeBlockContent>
                  </CodeBlock>
                ) : (
                  <Empty className="border">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <CreditCardIcon />
                      </EmptyMedia>
                      <EmptyTitle>No gateway payload</EmptyTitle>
                      <EmptyDescription>
                        No PayPal API response body recorded for this transaction.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>

              {/* Policy Trigger JSON */}
              {item.triggerDetails && (
                <div className="flex flex-col gap-2">
                  <span className="text-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                    <ShieldAlertIcon className="size-4 text-amber-500" />
                    Guardrail Trigger AST
                  </span>
                  <CodeBlock size="sm">
                    <CodeBlockHeader>
                      <CodeBlockTitle>Trigger AST</CodeBlockTitle>
                      <CodeBlockActions>
                        <CodeBlockCopyButton value={JSON.stringify(item.triggerDetails, null, 2)} />
                      </CodeBlockActions>
                    </CodeBlockHeader>
                    <CodeBlockContent className="max-h-64 text-xs">
                      {JSON.stringify(item.triggerDetails, null, 2)}
                    </CodeBlockContent>
                  </CodeBlock>
                </div>
              )}

              {/* Complete Audit Record Export */}
              <Alert className="flex flex-col gap-2.5 sm:grid sm:has-data-[slot=alert-action]:pr-38">
                <FileJsonIcon className="text-muted-foreground size-4 shrink-0" />
                <AlertTitle>Export Complete Audit Record</AlertTitle>
                <AlertDescription>
                  Copies the entire telemetry JSON object including all timestamps and relational
                  IDs.
                </AlertDescription>
                <AlertAction className="static mt-1 sm:absolute sm:top-2.5 sm:right-2.5">
                  <CopyButton
                    value={JSON.stringify(item, null, 2)}
                    label="Copy Full Record"
                    tooltip="Copy entire audit record JSON"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                  />
                </AlertAction>
              </Alert>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
