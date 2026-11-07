'use client';

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CreditCardIcon,
  Loader2Icon,
  TerminalIcon,
} from 'lucide-react';
import * as React from 'react';

import { Button } from '@workspace/ui/components/button';
import { CodeBlock, CodeBlockContent } from '@workspace/ui/components/code-block';
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@workspace/ui/components/trace';
import { cn } from '@workspace/ui/lib/utils';

/* ==========================================================================
   AI Elements Tool Types & Utilities (from https://ui.shadcn.com/docs/ai-elements/base/tool.md)
   ========================================================================== */

export type ToolPartState =
  | 'input-streaming'
  | 'input-available'
  | 'approval-requested'
  | 'approval-responded'
  | 'output-available'
  | 'output-error'
  | 'output-denied'
  | 'idle'
  | 'executing'
  | 'approval_required'
  | 'completed'
  | 'failed';

export interface ToolPart {
  type: string;
  toolCallId?: string;
  state: ToolPartState;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorText?: string;
  approval?: {
    id: string;
    approved?: boolean;
  };
}

export function getStatusBadge(state?: string) {
  switch (state) {
    case 'input-streaming':
    case 'input-available':
    case 'executing':
      return { status: 'running' as const, label: 'Running' };
    case 'output-error':
    case 'failed':
      return { status: 'error' as const, label: 'Failed' };
    case 'output-denied':
      return { status: undefined, label: 'Denied' };
    case 'approval-requested':
    case 'approval_required':
      return { status: 'pending' as const, label: 'Needs Approval' };
    case 'output-available':
    case 'completed':
    default:
      return { status: undefined, label: 'Completed' };
  }
}

/* ==========================================================================
   Tool Subcomponents (Trace + CodeBlock pattern)
   ========================================================================== */

export interface ToolHeaderProps extends React.ComponentProps<typeof TraceCollapsibleTrigger> {
  title?: string;
  state?: ToolPartState;
  icon?: React.ReactNode;
}

export function ToolHeader({
  title,
  state = 'input-available',
  icon,
  className,
  children,
  ...props
}: ToolHeaderProps) {
  const isRunning =
    state === 'input-streaming' || state === 'input-available' || state === 'executing';
  const isFailed = state === 'output-error' || state === 'failed';
  const isDenied = state === 'output-denied';

  const status = isRunning ? 'running' : isFailed ? 'error' : undefined;

  const prefix = isRunning ? 'Running' : isFailed ? 'Failed to run' : isDenied ? 'Denied' : 'Ran';

  return (
    <TraceCollapsibleTrigger className={className} {...props}>
      {children || (
        <TraceLine status={status}>
          <TraceIcon>{icon ?? <TerminalIcon aria-hidden="true" />}</TraceIcon>
          <TraceTitle>{title ? `${prefix} ${title}` : prefix}</TraceTitle>
        </TraceLine>
      )}
    </TraceCollapsibleTrigger>
  );
}

export function ToolTitle({ className, ...props }: React.ComponentProps<typeof TraceTitle>) {
  return <TraceTitle className={className} {...props} />;
}

export function ToolDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="tool-description"
      className={cn('text-muted-foreground truncate text-xs', className)}
      {...props}
    />
  );
}

export function ToolContent({
  className,
  ...props
}: React.ComponentProps<typeof TraceCollapsibleContent>) {
  return <TraceCollapsibleContent className={className} {...props} />;
}

export function ToolInput({ data, className }: { data: unknown; className?: string }) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  return (
    <div data-slot="tool-input" className={cn('space-y-1', className)}>
      <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        Input
      </p>
      <CodeBlock size="sm">
        <CodeBlockContent wrap className="max-h-64">
          {text}
        </CodeBlockContent>
      </CodeBlock>
    </div>
  );
}

export function ToolOutput({
  data,
  errorText,
  className,
}: {
  data?: unknown;
  errorText?: string;
  className?: string;
}) {
  const content = errorText ?? (typeof data === 'string' ? data : JSON.stringify(data, null, 2));

  return (
    <div data-slot="tool-output" className={cn('space-y-1', className)}>
      <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        {errorText ? 'Error' : 'Output'}
      </p>
      <CodeBlock size="sm" variant={errorText ? 'destructive' : 'default'}>
        <CodeBlockContent wrap className="max-h-64">
          {content}
        </CodeBlockContent>
      </CodeBlock>
    </div>
  );
}

/* ==========================================================================
   Root Tool Component (Trace Collapsible wrapper with PayPal extension support)
   ========================================================================== */

export type ToolState = ToolPartState;

export interface ToolProps extends Omit<React.ComponentProps<typeof Trace>, 'children'> {
  toolName?: string;
  state?: ToolPartState;
  args?: Record<string, unknown>;
  result?: unknown;
  errorText?: string;
  amount?: number;
  currency?: string;
  merchant?: string;
  onApprove?: () => void;
  onDecline?: () => void;
  isSubmitting?: boolean;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}

export function Tool({
  toolName,
  state = 'input-available',
  args,
  result,
  errorText,
  amount,
  currency = 'USD',
  merchant,
  onApprove,
  onDecline,
  isSubmitting = false,
  defaultOpen,
  children,
  className,
  ...props
}: ToolProps) {
  const isFailed = state === 'output-error' || state === 'failed';
  const isApprovalRequired = state === 'approval-requested' || state === 'approval_required';

  const isFinancialAction =
    toolName?.includes('paypal') ||
    toolName?.includes('order') ||
    toolName?.includes('payment') ||
    amount !== undefined;

  const formattedAmount =
    amount !== undefined
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
        }).format(amount)
      : undefined;

  return (
    <Trace className={cn('w-full', className)} {...props}>
      <TraceCollapsible defaultOpen={defaultOpen ?? (isFailed || isApprovalRequired)}>
        {children || (
          <>
            <ToolHeader
              title={toolName}
              state={state}
              icon={
                isFinancialAction ? (
                  <CreditCardIcon
                    aria-hidden="true"
                    className="text-spend-captured-subtle-foreground size-4"
                  />
                ) : (
                  <TerminalIcon aria-hidden="true" className="size-4" />
                )
              }
            />

            <ToolContent>
              <div className="space-y-3 pt-1">
                {/* Optional Financial Summary Header */}
                {(formattedAmount || merchant) && (
                  <div className="border-border/60 bg-muted/40 flex items-center justify-between rounded-lg border p-2.5 text-xs">
                    {merchant && (
                      <span className="text-muted-foreground">
                        Vendor: <strong className="text-foreground">{merchant}</strong>
                      </span>
                    )}
                    {formattedAmount && (
                      <span className="text-foreground font-mono font-semibold tabular-nums">
                        {formattedAmount}
                      </span>
                    )}
                  </div>
                )}

                {/* Inline approval prompt when required */}
                {isApprovalRequired && (
                  <div className="space-y-2 rounded-lg border border-(--spend-pending)/50 bg-(--spend-pending-subtle)/30 p-3 text-xs">
                    <div className="text-spend-pending-foreground flex items-center gap-1.5 font-medium">
                      <AlertTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
                      <span>Payment Authorization Required</span>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      {onDecline && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isSubmitting}
                          onClick={onDecline}
                          className="h-7 text-xs"
                        >
                          Deny
                        </Button>
                      )}
                      {onApprove && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={isSubmitting}
                          onClick={onApprove}
                          className="bg-spend-captured h-7 text-xs text-white shadow-xs hover:bg-(--spend-captured)/90"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2Icon
                                className="mr-1 size-3 animate-spin"
                                aria-hidden="true"
                              />
                              <span>Authorizing...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2Icon className="mr-1 size-3" aria-hidden="true" />
                              <span>Approve</span>
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Input Parameters Code Block */}
                {args && <ToolInput data={args} />}

                {/* Output Result / Error Code Block */}
                {(result !== undefined || errorText) && (
                  <ToolOutput data={result} errorText={errorText} />
                )}
              </div>
            </ToolContent>
          </>
        )}
      </TraceCollapsible>
    </Trace>
  );
}

// Aliases for backwards compatibility
export const ToolExecutionCard = Tool;
export type ToolExecutionCardProps = ToolProps;
export type ToolExecutionState = ToolState;
