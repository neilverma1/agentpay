import { requireAuth } from '@/lib/auth-helpers';
import { agent, chatMessage, chatThread, db, desc, eq } from '@workspace/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const createThreadSchema = z.object({
  prompt: z.string().max(1000).optional(),
  agentId: z.string().uuid().optional(),
  title: z.string().max(255).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { error: authError, session } = await requireAuth(req);
    if (authError || !session?.user) {
      return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 50);

    const threads = await db.query.chatThread.findMany({
      where: eq(chatThread.userId, session.user.id),
      orderBy: [desc(chatThread.updatedAt)],
      limit,
      with: {
        agent: true,
        messages: {
          orderBy: [desc(chatMessage.createdAt)],
          limit: 10,
          with: {
            purchaseIntent: true,
          },
        },
      },
    });

    type ThreadRecord = (typeof threads)[number];

    const formattedThreads = threads.map((thread: ThreadRecord) => {
      let derivedStatus: string = thread.status || 'active';

      if (thread.status !== 'archived') {
        const messages = (thread as { messages?: Array<{
          purchaseIntent?: { status?: string } | null;
          parts?: unknown;
        }> }).messages || [];

        let latestIntentStatus: string | null = null;
        for (const msg of messages) {
          if (msg.purchaseIntent?.status) {
            latestIntentStatus = msg.purchaseIntent.status;
            break;
          }
          if (Array.isArray(msg.parts)) {
            for (const part of msg.parts) {
              if (part && typeof part === 'object') {
                const p = part as Record<string, unknown>;
                if (p.cardType === 'payment_completed' || p.status === 'completed') {
                  latestIntentStatus = 'completed';
                  break;
                }
                if (p.cardType === 'approval_required' || p.status === 'requires_approval') {
                  latestIntentStatus = 'requires_approval';
                  break;
                }
                if (p.cardType === 'policy_violation' || p.status === 'rejected') {
                  latestIntentStatus = 'rejected';
                  break;
                }
                if (p.status === 'failed') {
                  latestIntentStatus = 'failed';
                  break;
                }
              }
            }
            if (latestIntentStatus) break;
          }
        }

        if (latestIntentStatus) {
          if (latestIntentStatus === 'requires_approval') {
            derivedStatus = 'pending_approval';
          } else if (latestIntentStatus === 'completed') {
            derivedStatus = 'completed';
          } else if (latestIntentStatus === 'rejected') {
            derivedStatus = 'rejected';
          } else if (latestIntentStatus === 'failed') {
            derivedStatus = 'failed';
          } else if (
            latestIntentStatus === 'executing_payment' ||
            latestIntentStatus === 'evaluating_policy' ||
            latestIntentStatus === 'approved' ||
            latestIntentStatus === 'pending'
          ) {
            derivedStatus = 'active';
          }
        } else if (messages.length > 0) {
          derivedStatus = 'settled';
        }
      }

      return {
        id: thread.id,
        title: thread.title,
        status: derivedStatus,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        agent: thread.agent,
      };
    });

    return NextResponse.json({ threads: formattedThreads });
  } catch (error) {
    console.error('Error fetching chat threads:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error: authError, session } = await requireAuth(req);
    if (authError || !session?.user) {
      return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const validated = createThreadSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: validated.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { prompt, title } = validated.data;
    let agentId = validated.data.agentId;

    if (!agentId) {
      const defaultAgent = await db.query.agent.findFirst({
        where: eq(agent.userId, session.user.id),
      });
      if (defaultAgent) {
        agentId = defaultAgent.id;
      } else {
        const anyAgent = await db.query.agent.findFirst();
        if (anyAgent) {
          agentId = anyAgent.id;
        } else {
          const [createdAgent] = await db
            .insert(agent)
            .values({
              userId: session.user.id,
              name: 'Primary Commerce Agent',
              description: 'Autonomous financial agent with spending guardrails',
              model: 'gemini-2.5-flash',
              status: 'active',
            })
            .returning();
          if (!createdAgent) {
            return NextResponse.json({ error: 'Failed to create default agent' }, { status: 500 });
          }
          agentId = createdAgent.id;
        }
      }
    }

    const derivedTitle =
      title?.trim() ||
      (prompt?.trim() ? prompt.trim().slice(0, 160).trim() : 'New Commerce Mission');

    const [newThread] = await db
      .insert(chatThread)
      .values({
        userId: session.user.id,
        agentId,
        title: derivedTitle,
        status: 'active',
      })
      .returning();

    if (!newThread) {
      return NextResponse.json({ error: 'Failed to create mission thread' }, { status: 500 });
    }

    let initialMessage = null;
    if (prompt && prompt.trim()) {
      const [msg] = await db
        .insert(chatMessage)
        .values({
          threadId: newThread.id,
          role: 'user',
          content: prompt.trim(),
          parts: [],
        })
        .returning();
      initialMessage = msg;
    }

    return NextResponse.json({ thread: newThread, initialMessage }, { status: 201 });
  } catch (error) {
    console.error('Error creating chat thread:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
