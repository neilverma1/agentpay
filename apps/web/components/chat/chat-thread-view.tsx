'use client';

import { EditGuardrailsDialog, type PolicyData } from '@/components/chat/edit-guardrails-dialog';
import { MarkdownContent } from '@/components/chat/markdown-content';
import { PaymentReceiptCard, cleanItemName } from '@/components/chat/payment-receipt-card';
import { PolicyViolationCard } from '@/components/chat/policy-violation-card';
import { PurchaseDeclinedCard } from '@/components/chat/purchase-declined-card';
import { useHeader } from '@/components/layout/header-context';
import { PromptInput } from '@/components/prompt-input';
import { Reasoning, type ReasoningStep } from '@/components/reasoning';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
import { Skeleton } from '@workspace/ui/components/skeleton';
import { cn } from '@workspace/ui/lib/utils';
import {
  AlertTriangle,
  Bot,
  Check,
  Clock,
  Loader2,
  MoreVertical,
  Pencil,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

export interface ChatThreadViewProps {
  threadId: string;
}

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: Array<Record<string, unknown>>;
  createdAt: string;
}

interface ThreadDetails {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  agent: {
    id: string;
    name: string;
    model: string;
    status: string;
  };
}

function formatRuleTrigger(rule: unknown): string {
  if (typeof rule !== 'string' || !rule) {
    return 'Exceeds autonomous spending threshold. Authorization required before PayPal capture.';
  }
  if (rule === 'strict_compliance_non_refundable') {
    return 'Strict Compliance Mode enabled: This final-sale (non-refundable) item requires explicit operator authorization before funds are captured.';
  }
  if (rule === 'require_approval_above_cents') {
    return 'Exceeds autonomous spending threshold. Requires operator authorization before PayPal captures funds.';
  }
  if (rule === 'max_daily_spend_cents') {
    return 'Exceeds daily spending limit. Requires operator authorization to proceed.';
  }
  if (rule === 'single_transaction_limit_cents') {
    return 'Exceeds single transaction limit. Requires operator authorization to proceed.';
  }
  return rule.replace(/_/g, ' ');
}

export function ChatThreadView({ threadId }: ChatThreadViewProps) {
  const { setTitle, setActions } = useHeader();
  const router = useRouter();
  const [thread, setThread] = React.useState<ThreadDetails | null>(null);
  const [isLoadingThread, setIsLoadingThread] = React.useState(true);
  const [messages, setMessages] = React.useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = React.useState('');
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [streamingMessageId, setStreamingMessageId] = React.useState<string | null>(null);
  const [streamingReasoning, setStreamingReasoning] = React.useState<ReasoningStep[]>([]);
  const [messageDurations, setMessageDurations] = React.useState<Record<string, number>>({});
  const streamStartTimeRef = React.useRef<number | null>(null);
  const [actionCardState, setActionCardState] = React.useState<
    Record<string, 'pending' | 'approved' | 'rejected'>
  >({});
  const [actionCardDetails, setActionCardDetails] = React.useState<
    Record<string, Record<string, unknown>>
  >({});
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);
  const [isGuardrailsOpen, setIsGuardrailsOpen] = React.useState(false);
  const [policy, setPolicy] = React.useState<PolicyData | null>(null);
  const [isDeletingThread, setIsDeletingThread] = React.useState(false);
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState('');
  const [isSavingTitle, setIsSavingTitle] = React.useState(false);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const triggerStreamingRef = React.useRef<(promptToSend: string) => Promise<void>>(undefined);

  // Fetch policy for guardrails and header headroom indicator
  const refreshPolicy = React.useCallback(async () => {
    try {
      const res = await fetch('/api/v1/agent/policy');
      if (res.ok) {
        const data = await res.json();
        if (data?.policy) setPolicy(data.policy);
      }
    } catch {
      // Ignore background policy polling errors
    }
  }, []);

  React.useEffect(() => {
    refreshPolicy();
  }, [refreshPolicy]);

  const latestPurchaseIntentId = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const parts = messages[i]?.parts || [];
      for (const part of parts) {
        if (
          part &&
          typeof part === 'object' &&
          'purchaseIntentId' in part &&
          part.purchaseIntentId
        ) {
          return String(part.purchaseIntentId);
        }
      }
    }
    return null;
  }, [messages]);

  const handleDeleteThread = React.useCallback(async () => {
    if (!window.confirm('Are you sure you want to delete this mission? This cannot be undone.')) {
      return;
    }
    setIsDeletingThread(true);
    try {
      const res = await fetch(`/api/v1/chat/threads/${threadId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete thread');
      toast.success('Mission thread deleted');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('agentpay:threads-updated', {
            detail: { action: 'delete', threadId },
          }),
        );
      }
      router.push('/chat');
    } catch {
      toast.error('Failed to delete mission thread');
      setIsDeletingThread(false);
    }
  }, [threadId, router]);

  const startEditingTitle = React.useCallback(() => {
    if (!thread) return;
    const firstUserMsg = messages.find((m) => m.role === 'user')?.content;
    const current = thread.title.endsWith('...') && firstUserMsg ? firstUserMsg : thread.title;
    setTitleDraft(current);
    setIsEditingTitle(true);
  }, [thread, messages]);

  const handleSaveTitle = React.useCallback(async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || !thread || isSavingTitle) return;
    if (trimmed === thread.title) {
      setIsEditingTitle(false);
      return;
    }

    setIsSavingTitle(true);
    try {
      const res = await fetch(`/api/v1/chat/threads/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to rename mission');
      }

      const data = await res.json();
      setThread((prev) => (prev ? { ...prev, title: data.thread.title } : null));
      setIsEditingTitle(false);
      toast.success('Mission renamed');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('agentpay:threads-updated', {
            detail: { action: 'update', threadId, title: data.thread.title },
          }),
        );
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to rename mission');
    } finally {
      setIsSavingTitle(false);
    }
  }, [titleDraft, thread, threadId, isSavingTitle]);

  React.useEffect(() => {
    const auditUrl = latestPurchaseIntentId ? `/audit?id=${latestPurchaseIntentId}` : '/audit';

    const spentCents = policy?.spentLast24HoursCents ?? 0;
    const spentDollars = (spentCents / 100).toFixed(2);
    const limitDollars = policy ? (policy.maxDailySpendCents / 100).toFixed(2) : '100.00';
    const gateDollars = policy ? (policy.requireApprovalAboveCents / 100).toFixed(2) : '50.00';
    const percentSpent =
      policy && policy.maxDailySpendCents > 0
        ? Math.min(100, Math.round((spentCents / policy.maxDailySpendCents) * 100))
        : 0;

    const statusDotColor =
      percentSpent >= 90 ? 'bg-rose-500' : percentSpent >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

    setActions(
      <div className="flex items-center gap-2">
        {policy && (
          <button
            type="button"
            onClick={() => setIsGuardrailsOpen(true)}
            className="border-border/70 bg-card/80 hover:bg-muted text-muted-foreground hover:text-foreground hidden cursor-pointer items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs tabular-nums shadow-2xs transition-colors sm:inline-flex"
            title="Click to view and configure agent spending guardrails"
          >
            <span className={cn('inline-block size-1.5 shrink-0 rounded-full', statusDotColor)} />
            <span>
              Today: ${spentDollars} / ${limitDollars}
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span className="text-muted-foreground text-[11px]">Gate: &gt;${gateDollars}</span>
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-8"
              aria-label="Mission options"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link href={auditUrl} className="flex cursor-pointer items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-500" />
                <span>View in Audit Ledger</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setIsGuardrailsOpen(true)}
              className="flex cursor-pointer items-center gap-2"
            >
              <SlidersHorizontal className="size-4" />
              <span>Configure Guardrails</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={startEditingTitle}
              className="flex cursor-pointer items-center gap-2"
            >
              <Pencil className="size-4" />
              <span>Rename Mission</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDeleteThread}
              disabled={isDeletingThread}
              className="text-destructive focus:text-destructive flex cursor-pointer items-center gap-2"
            >
              <Trash2 className="size-4" />
              <span>Delete Mission</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>,
    );

    return () => {
      setActions(null);
    };
  }, [
    latestPurchaseIntentId,
    setActions,
    handleDeleteThread,
    isDeletingThread,
    startEditingTitle,
    policy,
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load thread and messages
  React.useEffect(() => {
    let isCancelled = false;
    async function loadData() {
      setIsLoadingThread(true);
      try {
        const res = await fetch(`/api/v1/chat/threads/${threadId}`);
        if (!res.ok) throw new Error('Thread not found');
        const data = await res.json();
        if (isCancelled) return;
        setThread(data.thread);
        setMessages(data.messages || []);

        // Check if there is only a user message and no assistant response yet
        const lastMsg = data.messages?.[data.messages.length - 1];
        if (lastMsg && lastMsg.role === 'user' && data.messages.length === 1) {
          triggerStreamingRef.current?.(lastMsg.content);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!isCancelled) {
          setIsLoadingThread(false);
        }
      }
    }
    loadData();
    return () => {
      isCancelled = true;
    };
  }, [threadId]);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, streamingReasoning, isStreaming]);

  React.useEffect(() => {
    if (isLoadingThread) {
      setTitle(<Skeleton className="h-4 w-48 max-w-[50vw] sm:w-64" />);
      return;
    }

    if (thread?.title) {
      const firstUserMessage = messages.find((m) => m.role === 'user')?.content;
      const displayTitle =
        thread.title.endsWith('...') && firstUserMessage ? firstUserMessage : thread.title;

      if (isEditingTitle) {
        setTitle(
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveTitle();
            }}
            className="flex max-w-[70vw] items-center gap-1 sm:max-w-md"
          >
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
              disabled={isSavingTitle}
              maxLength={255}
              aria-label="Mission title"
              className="bg-muted/80 text-foreground border-input focus:border-primary focus:ring-primary/20 h-7 w-40 min-w-0 flex-1 rounded-md border px-2 text-xs font-medium focus:ring-2 focus:outline-none sm:w-64"
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              disabled={isSavingTitle || !titleDraft.trim()}
              className="size-7 shrink-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
              aria-label="Save title"
              title="Save title"
            >
              <Check className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={isSavingTitle}
              onClick={() => setIsEditingTitle(false)}
              className="text-muted-foreground hover:text-foreground size-7 shrink-0"
              aria-label="Cancel editing"
              title="Cancel"
            >
              <X className="size-3.5" />
            </Button>
          </form>,
        );
      } else {
        setTitle(
          <div className="group flex max-w-[65vw] min-w-0 items-center gap-1.5 sm:max-w-md">
            <span
              className="text-foreground block truncate text-sm font-semibold"
              title={displayTitle}
            >
              {displayTitle}
            </span>
            <button
              type="button"
              onClick={startEditingTitle}
              className="text-muted-foreground/60 hover:text-foreground hover:bg-muted shrink-0 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Rename mission"
              title="Rename mission"
            >
              <Pencil className="size-3.5" />
            </button>
          </div>,
        );
      }
    } else {
      setTitle(null);
    }

    return () => {
      setTitle(null);
    };
  }, [
    isLoadingThread,
    thread?.title,
    messages,
    setTitle,
    isEditingTitle,
    titleDraft,
    isSavingTitle,
    handleSaveTitle,
    startEditingTitle,
  ]);

  const triggerStreamingExecution = async (promptToSend: string) => {
    if (isStreaming) return;
    setIsStreaming(true);
    streamStartTimeRef.current = Date.now();

    const tempAssistantId = `temp-${Date.now()}`;
    setStreamingMessageId(tempAssistantId);

    const initialReasoningStep: ReasoningStep = {
      id: `step-${Date.now()}-0`,
      text: 'Analyzing purchase intent & evaluating spending policy...',
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
    setStreamingReasoning([initialReasoningStep]);

    const initialAssistantMsg: ChatMessageItem = {
      id: tempAssistantId,
      role: 'assistant',
      content: '',
      parts: [],
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, initialAssistantMsg]);

    try {
      const response = await fetch(`/api/v1/chat/${threadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptToSend }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to start execution stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          if (!block.trim()) continue;
          const eventMatch = block.match(/event:\s*(.+)/);
          const dataMatch = block.match(/data:\s*(.+)/);

          if (eventMatch && eventMatch[1] && dataMatch && dataMatch[1]) {
            const eventType = eventMatch[1].trim();
            let parsedData: Record<string, unknown> = {};
            try {
              parsedData = JSON.parse(dataMatch[1].trim());
            } catch {
              continue;
            }

            if (
              eventType === 'thinking' ||
              eventType === 'tool_call' ||
              eventType === 'reasoning_step'
            ) {
              const newStepText =
                (parsedData.thought as string) ||
                (parsedData.toolName as string) ||
                'Evaluating policy...';

              setStreamingReasoning((prev) => {
                // If only placeholder exists and incoming thinking step covers initial analysis, update it smoothly
                if (
                  prev.length === 1 &&
                  prev[0]?.id.endsWith('-0') &&
                  newStepText.toLowerCase().includes('analyzing')
                ) {
                  return [
                    {
                      id: prev[0].id,
                      text: newStepText,
                      timestamp: (parsedData.timestamp as string) || prev[0].timestamp,
                    },
                  ];
                }

                // Avoid duplicate consecutive text entries
                if (prev.length > 0 && prev[prev.length - 1]?.text === newStepText) {
                  return prev;
                }

                return [
                  ...prev,
                  {
                    id: `step-${Date.now()}-${prev.length + 1}`,
                    text: newStepText,
                    timestamp:
                      (parsedData.timestamp as string) ||
                      new Date().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      }),
                  },
                ];
              });
            } else if (eventType === 'text') {
              const textContent = (parsedData.content as string) || '';
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === tempAssistantId ? { ...msg, content: textContent } : msg,
                ),
              );
            } else if (eventType === 'approval_required') {
              const approvalReqId =
                (parsedData.approvalRequestId as string) || `appr-${Date.now()}`;
              setActionCardState((prev) => ({ ...prev, [approvalReqId]: 'pending' }));
              setActionCardDetails((prev) => ({ ...prev, [approvalReqId]: parsedData }));

              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id === tempAssistantId) {
                    const existingParts = msg.parts || [];
                    return {
                      ...msg,
                      parts: [
                        ...existingParts,
                        {
                          type: 'action_card',
                          cardType: 'approval_required',
                          ...parsedData,
                        },
                      ],
                    };
                  }
                  return msg;
                }),
              );
            } else if (eventType === 'payment_completed') {
              refreshPolicy();
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id === tempAssistantId) {
                    const existingParts = msg.parts || [];
                    return {
                      ...msg,
                      parts: [
                        ...existingParts,
                        {
                          type: 'action_card',
                          cardType: 'payment_completed',
                          ...parsedData,
                        },
                      ],
                    };
                  }
                  return msg;
                }),
              );
            } else if (eventType === 'policy_violation') {
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id === tempAssistantId) {
                    const existingParts = msg.parts || [];
                    return {
                      ...msg,
                      parts: [
                        ...existingParts,
                        {
                          type: 'action_card',
                          cardType: 'policy_violation',
                          ...parsedData,
                        },
                      ],
                    };
                  }
                  return msg;
                }),
              );
            }
          }
        }
      }
    } catch (err) {
      console.error('Streaming error', err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempAssistantId
            ? {
                ...msg,
                content: 'Execution encountered an unexpected error. Please try again.',
              }
            : msg,
        ),
      );
    } finally {
      if (streamStartTimeRef.current) {
        const elapsedSeconds = Math.max(
          0.6,
          Math.round((Date.now() - streamStartTimeRef.current) / 100) / 10,
        );
        setMessageDurations((prev) => ({ ...prev, [tempAssistantId]: elapsedSeconds }));
        streamStartTimeRef.current = null;
      }
      setIsStreaming(false);
      setStreamingMessageId(null);
      // Refresh messages and thread from server to keep database state exact
      try {
        const res = await fetch(`/api/v1/chat/threads/${threadId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
          if (data.thread) {
            setThread(data.thread);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('agentpay:threads-updated', {
                  detail: {
                    action: 'update',
                    threadId,
                    status: data.thread.status,
                    title: data.thread.title,
                  },
                }),
              );
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
  };
  triggerStreamingRef.current = triggerStreamingExecution;

  const handleSendPromptText = async (textToSend: string) => {
    if (!textToSend.trim() || isStreaming) return;
    const cleanText = textToSend.trim();
    const newMsg: ChatMessageItem = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: cleanText,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);
    await triggerStreamingExecution(cleanText);
  };

  const handleSendPrompt = async () => {
    if (!inputText.trim() || isStreaming) return;
    const text = inputText;
    setInputText('');
    await handleSendPromptText(text);
  };

  const handleApprove = async (approvalId: string, cardData?: Record<string, unknown>) => {
    setActionLoadingId(approvalId);
    try {
      const res = await fetch(`/api/v1/approvals/${approvalId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          approvalRequestId: (cardData?.approvalRequestId as string) || undefined,
          purchaseIntentId: (cardData?.purchaseIntentId as string) || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const errMsg =
          (errJson.error as string) || (errJson.message as string) || 'Approval decision failed';

        if (
          res.status === 409 ||
          errMsg.includes('already been completed') ||
          errMsg.includes('already decided')
        ) {
          toast.info('Transaction already approved and captured.');
          setActionCardState((prev) => ({ ...prev, [approvalId]: 'approved' }));
          setActionCardDetails((prev) => ({
            ...prev,
            [approvalId]: {
              ...(cardData || {}),
              status: 'completed',
            },
          }));
          return;
        }

        if (res.status === 410 || errMsg.toLowerCase().includes('expired')) {
          toast.error(errMsg);
          setActionCardState((prev) => ({ ...prev, [approvalId]: 'rejected' }));
          setActionCardDetails((prev) => ({
            ...prev,
            [approvalId]: {
              ...(cardData || {}),
              status: 'expired',
              rejectionReason: errMsg,
            },
          }));
          return;
        }

        toast.error(errMsg);
        return;
      }

      const resJson = await res.json();
      const captureResult = (resJson.result || resJson) as Record<string, unknown>;

      toast.success('Payment approved and captured via PayPal Sandbox.');
      refreshPolicy();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('agentpay:threads-updated', {
            detail: { action: 'update', threadId, status: 'completed' },
          }),
        );
      }
      setActionCardState((prev) => ({ ...prev, [approvalId]: 'approved' }));
      setActionCardDetails((prev) => {
        const base = prev[approvalId] || cardData || {};
        return {
          ...prev,
          [approvalId]: {
            ...base,
            ...captureResult,
            paypalCaptureId:
              (captureResult.paypalCaptureId as string) ||
              (resJson.paypalCaptureId as string) ||
              (base.paypalCaptureId as string) ||
              'SANDBOX_CAPTURED',
            status: 'completed',
          },
        };
      });
      refreshPolicy();
    } catch (err) {
      console.error('Approval execution error:', err);
      toast.error('An unexpected error occurred during approval.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDecline = async (approvalId: string, cardData?: Record<string, unknown>) => {
    setActionLoadingId(approvalId);
    try {
      const res = await fetch(`/api/v1/approvals/${approvalId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          approvalRequestId: (cardData?.approvalRequestId as string) || undefined,
          purchaseIntentId: (cardData?.purchaseIntentId as string) || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const errMsg =
          (errJson.error as string) || (errJson.message as string) || 'Decline decision failed';

        if (res.status === 409) {
          setActionCardState((prev) => ({ ...prev, [approvalId]: 'rejected' }));
          return;
        }

        toast.error(errMsg);
        return;
      }

      toast.info('Purchase declined by operator.');
      setActionCardState((prev) => ({ ...prev, [approvalId]: 'rejected' }));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('agentpay:threads-updated', {
            detail: { action: 'update', threadId, status: 'rejected' },
          }),
        );
      }
    } catch (err) {
      console.error('Decline execution error:', err);
      toast.error('An unexpected error occurred while declining.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <EditGuardrailsDialog
        open={isGuardrailsOpen}
        onOpenChange={setIsGuardrailsOpen}
        currentPolicy={policy}
        onPolicyUpdated={(updated) => setPolicy(updated)}
      />

      {/* Message Feed Area */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
          {messages.map((message) => {
            const isUser = message.role === 'user';

            if (isUser) {
              return (
                <div key={message.id} className="flex w-full justify-end gap-3">
                  <div className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-xl">
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full border">
                    <User className="size-4" />
                  </div>
                </div>
              );
            }

            // Extract reasoning steps from message parts or current streaming
            const partsReasoningSteps: ReasoningStep[] = (message.parts || [])
              .filter((p) => p.type === 'reasoning_step')
              .map((p, idx) => ({
                id: (p.id as string) || `part-${idx}`,
                text:
                  (p.thought as string) ||
                  (p.text as string) ||
                  (p.toolName as string) ||
                  'Step executed',
                timestamp: (p.timestamp as string) || undefined,
              }));

            const isCurrentStreamingAssistant =
              isStreaming && (message.id === streamingMessageId || message.id.startsWith('temp-'));

            const messageReasoningSteps: ReasoningStep[] =
              partsReasoningSteps.length > 0
                ? partsReasoningSteps
                : isCurrentStreamingAssistant
                  ? streamingReasoning.length > 0
                    ? streamingReasoning
                    : [
                        {
                          id: 'step-eval-init',
                          text: 'Analyzing purchase intent & evaluating spending policy...',
                          timestamp: new Date().toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          }),
                        },
                      ]
                  : [];

            const actionCards = message.parts?.filter((p) => p.type === 'action_card') || [];

            return (
              <div key={message.id} className="flex w-full items-start gap-3">
                <div className="bg-primary/10 text-primary border-primary/20 flex size-8 shrink-0 items-center justify-center rounded-full border">
                  <Bot className="size-4" />
                </div>

                <div className="min-w-0 flex-1 space-y-4">
                  {/* Reasoning Accordion Drawer */}
                  {messageReasoningSteps.length > 0 && (
                    <Reasoning
                      steps={messageReasoningSteps}
                      defaultOpen={true}
                      duration={messageDurations[message.id]}
                      isStreaming={isStreaming && isCurrentStreamingAssistant}
                      className="border-none bg-transparent shadow-none"
                    />
                  )}

                  {/* Main Text Content */}
                  {message.content && (
                    <div className="bg-card rounded-xl border p-4 text-sm leading-relaxed shadow-xs">
                      <MarkdownContent content={message.content} />
                    </div>
                  )}

                  {/* Interactive Clarification Quick-Replies */}
                  {(() => {
                    const clarificationPart = message.parts?.find(
                      (p) => p.type === 'clarification_request',
                    ) as { options?: Array<{ label: string; prompt: string }> } | undefined;
                    const isLatest =
                      messages.filter((m) => m.role === 'assistant').slice(-1)[0]?.id ===
                      message.id;

                    if (
                      !clarificationPart?.options ||
                      !Array.isArray(clarificationPart.options) ||
                      clarificationPart.options.length === 0
                    ) {
                      return null;
                    }

                    return (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {clarificationPart.options.map((opt, optIdx) => (
                          <Button
                            key={optIdx}
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isStreaming || !isLatest}
                            onClick={() => handleSendPromptText(opt.prompt)}
                            className="border-primary/40 bg-card hover:bg-primary/10 hover:border-primary text-foreground h-auto rounded-full px-3.5 py-1.5 text-xs font-medium shadow-xs transition-all hover:shadow-sm active:scale-[0.98]"
                          >
                            <span className="bg-primary/15 text-primary mr-1.5 flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
                              {optIdx + 1}
                            </span>
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Inline Action Cards (Generative UI) */}
                  {actionCards.map((card, idx) => {
                    const cardType = card.cardType as string;
                    const approvalId =
                      (card.approvalRequestId as string) ||
                      (card.purchaseIntentId as string) ||
                      `card-${idx}`;
                    const currentApprovalState =
                      actionCardState[approvalId] ||
                      (cardType === 'payment_completed' || card.status === 'completed'
                        ? 'approved'
                        : card.status === 'rejected'
                          ? 'rejected'
                          : 'pending');
                    const details = actionCardDetails[approvalId] || card;

                    if (
                      cardType === 'policy_violation' ||
                      details.cardType === 'policy_violation'
                    ) {
                      return <PolicyViolationCard key={approvalId} details={details} />;
                    }

                    if (cardType === 'approval_required' || currentApprovalState === 'pending') {
                      if (currentApprovalState === 'approved') {
                        return (
                          <PaymentReceiptCard
                            key={approvalId}
                            details={details}
                            onRefundSuccess={refreshPolicy}
                          />
                        );
                      }

                      if (currentApprovalState === 'rejected') {
                        return <PurchaseDeclinedCard key={approvalId} details={details} />;
                      }

                      const amountFormatted = `$${((Number(details.amountCents) || 0) / 100).toFixed(2)}`;
                      const itemName = cleanItemName(details.itemDescription);
                      const ruleExplanation = formatRuleTrigger(details.ruleTriggered);
                      const thresholdText = details.thresholdCents
                        ? `$${(Number(details.thresholdCents) / 100).toFixed(2)}`
                        : '$50.00';

                      const cardCreatedAt =
                        (details.createdAt as string) ||
                        (card.createdAt as string) ||
                        (message.createdAt ? new Date(message.createdAt).toISOString() : null);

                      const isExpired =
                        details.status === 'expired' ||
                        card.status === 'expired' ||
                        (typeof cardCreatedAt === 'string' &&
                          Date.now() - new Date(cardCreatedAt).getTime() > 24 * 60 * 60 * 1000);

                      const isStrictCompliance =
                        details.ruleTriggered === 'strict_compliance_non_refundable' ||
                        Boolean(details.requireApprovalForNonRefundable);
                      const isNonRefundable = details.refundable === false;

                      return (
                        <Card
                          key={approvalId}
                          className={cn(
                            'bg-card rounded-xl border shadow-xs',
                            isExpired
                              ? 'border-muted-foreground/30 opacity-80'
                              : 'border-amber-500/40',
                          )}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'gap-1.5 text-xs font-medium',
                                    isExpired
                                      ? 'border-muted-foreground/40 bg-muted/60 text-muted-foreground'
                                      : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
                                  )}
                                >
                                  {isExpired ? (
                                    <Clock className="size-3.5" />
                                  ) : (
                                    <AlertTriangle className="size-3.5" />
                                  )}
                                  <span>
                                    {isExpired ? 'Approval Expired' : 'Approval Required'}
                                  </span>
                                </Badge>
                                {isStrictCompliance && (
                                  <Badge
                                    variant="outline"
                                    className="border-primary/40 bg-primary/10 text-primary gap-1 px-2 py-0.5 text-xs font-medium"
                                  >
                                    <ShieldCheck className="size-3" />
                                    <span>Strict Compliance</span>
                                  </Badge>
                                )}
                                {isNonRefundable && (
                                  <Badge
                                    variant="outline"
                                    className="border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
                                  >
                                    Final Sale
                                  </Badge>
                                )}
                              </div>
                              <span className="text-muted-foreground font-mono text-xs">
                                {isExpired
                                  ? 'Stale quote (> 24h)'
                                  : isStrictCompliance
                                    ? 'Strict Compliance Active'
                                    : `Threshold: ${thresholdText}`}
                              </span>
                            </div>
                            <CardTitle className="text-foreground pt-2 text-base font-semibold tracking-tight">
                              {itemName}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              Merchant:{' '}
                              <span className="text-foreground font-medium">
                                {String(details.merchantName || 'Sandbox Digital Marketplace')}
                              </span>
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3 pb-3">
                            <div className="bg-muted/40 divide-border/60 divide-y rounded-lg border text-xs">
                              <div className="flex items-center justify-between px-3.5 py-2.5">
                                <span className="text-muted-foreground">Payment Gateway</span>
                                <span className="text-foreground font-medium">PayPal Sandbox</span>
                              </div>
                              <div className="flex items-center justify-between px-3.5 py-2.5">
                                <span className="text-muted-foreground">Amount to Authorize</span>
                                <span className="text-foreground font-mono text-base font-bold">
                                  {amountFormatted} USD
                                </span>
                              </div>
                            </div>
                            {Number(details.savingsCents) > 0 && (
                              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
                                <TrendingDown className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <span>
                                  Smart Price Optimization: Saved $
                                  {(Number(details.savingsCents) / 100).toFixed(2)} vs competing
                                  catalog merchants
                                </span>
                              </div>
                            )}
                            {isNonRefundable && (
                              <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                <div className="space-y-0.5">
                                  <p className="font-semibold">Irrevocable Purchase</p>
                                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                                    This item is non-refundable once approved and provisioned.
                                  </p>
                                </div>
                              </div>
                            )}
                            <p className="text-muted-foreground text-xs leading-relaxed">
                              {isExpired
                                ? 'This approval request has expired because it was created over 24 hours ago. Current daily spend and item pricing require a fresh check.'
                                : ruleExplanation}
                            </p>
                          </CardContent>
                          <CardFooter className="flex gap-2.5 border-t pt-3">
                            {isExpired ? (
                              <div className="text-muted-foreground flex w-full items-center justify-center gap-1.5 py-1 text-xs">
                                <Clock className="size-3.5 text-amber-500" />
                                <span>
                                  Approval window expired. Submit a new prompt in chat to
                                  re-evaluate current budget.
                                </span>
                              </div>
                            ) : (
                              <>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="flex-1 gap-1.5 bg-emerald-600 font-medium text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800"
                                  disabled={actionLoadingId === approvalId}
                                  onClick={() => handleApprove(approvalId, card)}
                                >
                                  {actionLoadingId === approvalId ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <ShieldCheck className="size-3.5" />
                                  )}
                                  <span>Approve Payment ({amountFormatted})</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-muted-foreground hover:border-destructive hover:bg-destructive/10 hover:text-destructive flex-1 font-medium"
                                  disabled={actionLoadingId === approvalId}
                                  onClick={() => handleDecline(approvalId, card)}
                                >
                                  <span>Decline</span>
                                </Button>
                              </>
                            )}
                          </CardFooter>
                        </Card>
                      );
                    }

                    if (cardType === 'payment_completed') {
                      return (
                        <PaymentReceiptCard
                          key={approvalId}
                          details={details}
                          onRefundSuccess={refreshPolicy}
                        />
                      );
                    }

                    return null;
                  })}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Bottom Fixed Prompt Bar */}
      <div className="bg-background/80 shrink-0 px-4 pt-2 pb-4 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl">
          <PromptInput
            value={inputText}
            onChange={setInputText}
            onSubmit={handleSendPrompt}
            isLoading={isStreaming}
            onStop={() => setIsStreaming(false)}
            placeholder="Assign next commerce step or ask about budget headroom..."
            hintText="Enter to submit"
            compact
          />
        </div>
      </div>
    </div>
  );
}
