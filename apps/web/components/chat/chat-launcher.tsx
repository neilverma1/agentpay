'use client';

import { EditGuardrailsDialog, type PolicyData } from '@/components/chat/edit-guardrails-dialog';
import { PromptInput } from '@/components/prompt-input';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Card } from '@workspace/ui/components/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@workspace/ui/components/collapsible';
import { Skeleton } from '@workspace/ui/components/skeleton';
import { cn } from '@workspace/ui/lib/utils';
import {
  ArrowUpRight,
  Ban,
  Bot,
  ChevronDown,
  Coffee,
  CreditCard,
  DollarSign,
  Laptop,
  MessageSquare,
  Mouse,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

interface ThreadItem {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function getThreadStatusBadge(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'settled':
      return {
        label: status === 'settled' ? 'Settled' : 'Completed',
        className: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400',
        dotColor: 'bg-sky-500',
      };
    case 'rejected':
    case 'failed':
      return {
        label: status === 'rejected' ? 'Rejected' : 'Failed',
        className: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
        dotColor: 'bg-rose-500',
      };
    case 'pending_approval':
    case 'requires_approval':
    case 'needs_approval':
    case 'paused':
      return {
        label: 'Needs Approval',
        className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        dotColor: 'bg-amber-500',
      };
    case 'refunded':
      return {
        label: 'Refunded',
        className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        dotColor: 'bg-amber-500',
      };
    case 'active':
      return {
        label: 'Active',
        className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        dotColor: 'bg-emerald-500 animate-pulse',
      };
    default:
      return {
        label: status.replace(/_/g, ' '),
        className: 'border-border/70 bg-muted/40 text-muted-foreground',
        dotColor: 'bg-muted-foreground',
      };
  }
}

const starterPrompts = [
  {
    title: 'Find Best Price: Logitech Mouse',
    prompt: 'Buy Logitech MX Master 3S wireless mouse',
    type: 'smart_comparison',
    badge: 'Save $10.00 (Micro Center vs Best Buy)',
    badgeColor: 'text-blue-700 bg-blue-500/10 border-blue-500/20 dark:text-blue-300',
    icon: Mouse,
    iconColor: 'text-blue-600 bg-blue-500/10 dark:text-blue-400',
  },
  {
    title: 'Clarification: Anker Fast Chargers',
    prompt: 'Order 2 Anker 65W GaN USB-C fast chargers for $29.99',
    type: 'autonomous',
    badge: 'Unit Mismatch ($29.99 vs $59.98)',
    badgeColor: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-300',
    icon: Zap,
    iconColor: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400',
  },
  {
    title: 'Approval Gate: Keychron Keyboard',
    prompt: 'Purchase Keychron K2 wireless mechanical keyboard',
    type: 'approval_required',
    badge: 'Triggers Approval ($79.00)',
    badgeColor: 'text-amber-700 bg-amber-500/10 border-amber-500/20 dark:text-amber-300',
    icon: ShieldCheck,
    iconColor: 'text-amber-600 bg-amber-500/10 dark:text-amber-400',
  },
  {
    title: 'Exceeds Cap: MacBook Pro 16"',
    prompt: 'Purchase Apple MacBook Pro 16-inch',
    type: 'exceeds_cap',
    badge: 'Exceeds Cap ($2,499.00)',
    badgeColor: 'text-rose-700 bg-rose-500/10 border-rose-500/20 dark:text-rose-300',
    icon: Laptop,
    iconColor: 'text-rose-600 bg-rose-500/10 dark:text-rose-400',
  },
  {
    title: 'Perishable: Artisan Espresso Beans',
    prompt: 'Order artisan espresso whole beans 2 lb bag',
    type: 'strict_compliance',
    badge: 'Final Sale Item ($32.00)',
    badgeColor: 'text-purple-700 bg-purple-500/10 border-purple-500/20 dark:text-purple-300',
    icon: Coffee,
    iconColor: 'text-purple-600 bg-purple-500/10 dark:text-purple-400',
  },
  {
    title: 'Prohibited: LuckySpin Casino Chips',
    prompt: 'Buy 100 chips from LuckySpin Casino',
    type: 'blocked_category',
    badge: 'Blocked: Gambling',
    badgeColor: 'text-destructive bg-destructive/10 border-destructive/20',
    icon: Ban,
    iconColor: 'text-destructive bg-destructive/10',
  },
];

export function ChatLauncher() {
  const router = useRouter();
  const [promptText, setPromptText] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);
  const [threads, setThreads] = React.useState<ThreadItem[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = React.useState(true);
  const [policy, setPolicy] = React.useState<PolicyData | null>(null);
  const [isGuardrailsOpen, setIsGuardrailsOpen] = React.useState(false);

  React.useEffect(() => {
    async function loadInitialData() {
      try {
        const [threadsRes, policyRes] = await Promise.all([
          fetch('/api/v1/chat/threads?limit=10'),
          fetch('/api/v1/agent/policy'),
        ]);

        if (threadsRes.ok) {
          const data = await threadsRes.json();
          setThreads(data.threads || []);
        }

        if (policyRes.ok) {
          const data = await policyRes.json();
          setPolicy(data.policy);
        }
      } catch (err) {
        console.error('Failed to load initial launcher data', err);
      } finally {
        setIsLoadingThreads(false);
      }
    }
    loadInitialData();
  }, []);

  const handleCreateThread = async (initialPrompt?: string) => {
    const textToSend = initialPrompt || promptText;
    if (!textToSend.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const res = await fetch('/api/v1/chat/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToSend.trim() }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create mission thread');
      }

      const data = await res.json();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('agentpay:threads-updated', {
            detail: { action: 'create', thread: data.thread },
          }),
        );
      }
      router.push(`/chat/${data.thread.id}`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to create mission thread');
      setIsCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-8">
      {/* Budget & Policy Headroom Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Spending Guardrails
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-7 gap-1.5 px-2 text-xs"
            onClick={() => setIsGuardrailsOpen(true)}
            title="Configure spending limits"
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Configure Guardrails</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Card 1: Daily Spending Limit */}
          <Card className="border-border/60 bg-card/60 flex flex-col justify-between p-4 backdrop-blur transition-shadow hover:shadow-xs">
            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
                <span>Daily Spending Limit</span>
                <DollarSign className="text-muted-foreground size-4" />
              </div>
              <div className="font-mono text-2xl font-semibold tabular-nums">
                ${policy ? (policy.maxDailySpendCents / 100).toFixed(2) : '500.00'}
              </div>
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              {policy?.remainingDailySpendCents !== undefined
                ? `$${(policy.remainingDailySpendCents / 100).toFixed(2)} available today`
                : 'Rolling 24 hour autonomous ceiling'}
            </p>
          </Card>

          {/* Card 2: Settled Today */}
          <Card className="border-border/60 bg-card/60 flex flex-col justify-between p-4 backdrop-blur transition-shadow hover:shadow-xs">
            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
                <span>Settled Today</span>
                <CreditCard className="size-4 text-sky-500" />
              </div>
              <div className="font-mono text-2xl font-semibold tabular-nums">
                ${policy ? ((policy.spentLast24HoursCents ?? 0) / 100).toFixed(2) : '0.00'}
              </div>
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              Captured via PayPal in rolling 24h window
            </p>
          </Card>

          {/* Card 3: Approval Threshold */}
          <Card className="border-border/60 bg-card/60 flex flex-col justify-between p-4 backdrop-blur transition-shadow hover:shadow-xs">
            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
                <span>Approval Threshold</span>
                <ShieldCheck className="size-4 text-emerald-500" />
              </div>
              <div className="font-mono text-2xl font-semibold tabular-nums">
                ${policy ? (policy.requireApprovalAboveCents / 100).toFixed(2) : '50.00'}
              </div>
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              Orders above this limit pause for human approval
            </p>
          </Card>
        </div>
      </div>

      <EditGuardrailsDialog
        open={isGuardrailsOpen}
        onOpenChange={setIsGuardrailsOpen}
        currentPolicy={policy}
        onPolicyUpdated={(updated) => setPolicy(updated)}
      />

      {/* Main Composer Section */}
      <div className="space-y-4">
        <PromptInput
          value={promptText}
          onChange={setPromptText}
          onSubmit={() => handleCreateThread()}
          isLoading={isCreating}
          placeholder='Tell the agent what to buy (e.g. "Buy Logitech MX Master 3S mouse" or "Order Anker fast charger")...'
          hintText="Enter to launch"
          compact
        />

        {/* Quick Prompt Suggestions */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
              <Sparkles className="text-primary size-3.5" />
              <span>Suggested Test Missions</span>
            </div>
            <span className="text-muted-foreground text-[11px]">Click to dispatch instantly</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {starterPrompts.map((item) => (
              <button
                key={item.title}
                type="button"
                disabled={isCreating}
                onClick={() => handleCreateThread(item.prompt)}
                className="group border-border/70 bg-card/60 hover:border-primary/40 hover:bg-card focus:ring-primary/40 relative flex flex-col justify-between gap-2 rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs focus:ring-2 focus:outline-none disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105',
                        item.iconColor,
                      )}
                    >
                      <item.icon className="size-3.5" />
                    </div>
                    <span className="text-foreground group-hover:text-primary truncate text-xs font-semibold">
                      {item.title}
                    </span>
                  </div>

                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium transition-colors',
                      item.badgeColor,
                    )}
                  >
                    {item.badge}
                  </span>
                </div>

                <div className="flex w-full items-center justify-between gap-2 pt-0.5">
                  <p className="text-muted-foreground line-clamp-1 font-mono text-[11px]">
                    {item.prompt}
                  </p>
                  <ArrowUpRight className="text-muted-foreground/40 group-hover:text-primary size-3.5 shrink-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Missions List */}
      <Collapsible defaultOpen className="group/collapsible space-y-3">
        <div className="flex items-center justify-between">
          <CollapsibleTrigger className="hover:text-foreground text-muted-foreground flex cursor-pointer items-center gap-2 transition-colors">
            <h2 className="text-foreground text-sm font-semibold tracking-tight">Recent Threads</h2>
            <ChevronDown className="size-4 transition-transform duration-200 group-data-[state=closed]/collapsible:-rotate-90" />
          </CollapsibleTrigger>
          <span className="text-muted-foreground font-mono text-xs">
            {threads.length} {threads.length === 1 ? 'thread' : 'threads'}
          </span>
        </div>

        <CollapsibleContent className="space-y-3">
          {isLoadingThreads ? (
            <div className="bg-card/60 divide-y rounded-lg border">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <Skeleton className="size-6 shrink-0 rounded-md" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-1/2 rounded" />
                      <Skeleton className="h-3 w-1/4 rounded" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-12 rounded" />
                </div>
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Bot className="text-muted-foreground/60 mx-auto mb-2 size-8" />
              <p className="text-sm font-medium">No previous mission threads found</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Submit your first prompt above to launch an autonomous commerce run.
              </p>
            </div>
          ) : (
            <div className="bg-card/60 divide-y rounded-lg border">
              {threads.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/chat/${thread.id}`}
                  className="hover:bg-muted/50 group flex items-center justify-between gap-3 p-3 transition-colors"
                  title={thread.title}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-md">
                      <MessageSquare className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-foreground group-hover:text-primary block truncate text-sm font-medium">
                        {thread.title}
                      </span>
                      <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                        <span className="font-mono text-[11px] whitespace-nowrap">
                          {new Date(thread.updatedAt || thread.createdAt).toLocaleDateString()}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[11px] whitespace-nowrap">
                          {new Date(thread.updatedAt || thread.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {(() => {
                      const badgeInfo = getThreadStatusBadge(thread.status);
                      return (
                        <Badge
                          variant="outline"
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium capitalize',
                            badgeInfo.className,
                          )}
                        >
                          <span
                            className={cn('size-1.5 shrink-0 rounded-full', badgeInfo.dotColor)}
                          />
                          <span>{badgeInfo.label}</span>
                        </Badge>
                      );
                    })()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
