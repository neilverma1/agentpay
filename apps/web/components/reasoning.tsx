'use client';

import { CircleCheckIcon, LoaderCircleIcon, Sparkles } from 'lucide-react';
import * as React from 'react';

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
   Reasoning Context
   ========================================================================= */

export interface ReasoningContextValue {
  open?: boolean;
  setOpen: (open: boolean) => void;
  isStreaming?: boolean;
  duration?: string | number;
  durationMs?: number;
}

const ReasoningContext = React.createContext<ReasoningContextValue | null>(null);

export function useReasoning() {
  const context = React.useContext(ReasoningContext);
  if (!context) {
    throw new Error('useReasoning must be used within a Reasoning component');
  }
  return context;
}

/* ==========================================================================
   Reasoning Subcomponents (from https://ui.shadcn.com/docs/ai-elements/base/reasoning.md)
   ========================================================================== */

export interface ReasoningTriggerProps extends React.ComponentProps<
  typeof TraceCollapsibleTrigger
> {
  title?: string;
  isStreaming?: boolean;
  duration?: string | number;
  durationMs?: number;
  stepCount?: number;
}

export function ReasoningTrigger({
  title,
  isStreaming,
  duration,
  durationMs,
  stepCount,
  className,
  children,
  ...props
}: ReasoningTriggerProps) {
  const context = React.useContext(ReasoningContext);
  const activeStreaming = isStreaming ?? context?.isStreaming ?? false;
  const activeDurationMs = durationMs ?? context?.durationMs;
  const rawDuration = duration ?? context?.duration;

  const displayDuration =
    rawDuration !== undefined
      ? typeof rawDuration === 'number'
        ? `${rawDuration}s`
        : rawDuration
      : activeDurationMs
        ? `${(activeDurationMs / 1000).toFixed(1)}s`
        : undefined;

  let titleText = title;
  if (!titleText) {
    if (activeStreaming) {
      titleText = 'Thinking...';
    } else if (displayDuration) {
      titleText = `Thought for ${displayDuration}`;
    } else if (stepCount && stepCount > 0) {
      titleText = `Thought (${stepCount} step${stepCount === 1 ? '' : 's'})`;
    } else {
      titleText = 'Thought';
    }
  }

  return (
    <TraceCollapsibleTrigger className={className} {...props}>
      {children || (
        <TraceLine status={activeStreaming ? 'running' : undefined}>
          <TraceIcon>
            {activeStreaming ? (
              <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
            ) : (
              <CircleCheckIcon aria-hidden="true" />
            )}
          </TraceIcon>
          <TraceTitle>{titleText}</TraceTitle>
        </TraceLine>
      )}
    </TraceCollapsibleTrigger>
  );
}

export function ReasoningContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TraceCollapsibleContent>) {
  return (
    <TraceCollapsibleContent
      className={cn('bg-transparent whitespace-pre-wrap', className)}
      {...props}
    >
      {children}
    </TraceCollapsibleContent>
  );
}

/* ==========================================================================
   Root Reasoning Component (Supports Trace Collapsible, Compound and Direct Props)
   ========================================================================== */

export interface ReasoningStep {
  id: string;
  text: string;
  timestamp?: string;
}

export interface ReasoningProps extends Omit<React.ComponentProps<typeof Trace>, 'children'> {
  text?: string;
  steps?: ReasoningStep[];
  isStreaming?: boolean;
  duration?: string | number;
  durationMs?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  agentName?: string;
  title?: string;
  children?: React.ReactNode;
}

export function Reasoning({
  text,
  steps,
  isStreaming = false,
  duration,
  durationMs,
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  agentName,
  title,
  children,
  className,
  ...props
}: ReasoningProps) {
  const [internalOpen, setInternalOpen] = React.useState<boolean | undefined>(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const currentOpen = isControlled ? controlledOpen : (internalOpen ?? isStreaming);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const contextValue = React.useMemo(
    () => ({
      open: currentOpen,
      setOpen: handleOpenChange,
      isStreaming,
      duration,
      durationMs,
    }),
    [currentOpen, handleOpenChange, isStreaming, duration, durationMs],
  );

  return (
    <ReasoningContext.Provider value={contextValue}>
      <Trace className={cn('w-full border-none bg-transparent shadow-none', className)} {...props}>
        <TraceCollapsible open={currentOpen} onOpenChange={handleOpenChange}>
          {children || (
            <>
              <ReasoningTrigger
                title={title}
                isStreaming={isStreaming}
                duration={duration}
                durationMs={durationMs}
                stepCount={steps?.length}
              />
              <ReasoningContent>
                {text && <p className="mb-2 text-xs leading-relaxed">{text}</p>}

                {steps && steps.length > 0 && (
                  <ul className="space-y-1.5 text-xs">
                    {steps.map((step, index) => (
                      <li
                        key={step.id || index}
                        className="text-muted-foreground flex items-start gap-2 leading-relaxed"
                      >
                        <span className="bg-primary/20 text-primary mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <span className="text-foreground">{step.text}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {isStreaming && (
                  <div className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
                    <Sparkles aria-hidden="true" className="text-primary size-3 animate-spin" />
                    <span className="italic">Evaluating spending guardrails...</span>
                  </div>
                )}
              </ReasoningContent>
            </>
          )}
        </TraceCollapsible>
      </Trace>
    </ReasoningContext.Provider>
  );
}

export const ReasoningCollapsible = Reasoning;
export type ReasoningCollapsibleProps = ReasoningProps;
