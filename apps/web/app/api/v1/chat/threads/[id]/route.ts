import { requireAuth } from '@/lib/auth-helpers';
import { and, asc, chatMessage, chatThread, db, eq, inArray, purchaseIntent } from '@workspace/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updateThreadSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').max(255),
});

export async function GET(
  req: NextRequest,
  context?: { params?: Promise<{ id?: string }> | { id?: string } },
) {
  try {
    const { error: authError, session } = await requireAuth(req);
    if (authError || !session?.user) {
      return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await context?.params;
    const threadId = resolvedParams?.id;
    if (!threadId) {
      return NextResponse.json({ error: 'Thread identifier is required' }, { status: 400 });
    }

    const thread = await db.query.chatThread.findFirst({
      where: and(eq(chatThread.id, threadId), eq(chatThread.userId, session.user.id)),
      with: {
        agent: true,
        messages: {
          orderBy: [asc(chatMessage.createdAt)],
        },
      },
    });

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    if (thread.title.endsWith('...')) {
      const firstUserMsg = thread.messages.find((m) => m.role === 'user');
      if (firstUserMsg?.content) {
        const fullTitle = firstUserMsg.content.slice(0, 160).trim();
        await db.update(chatThread).set({ title: fullTitle }).where(eq(chatThread.id, thread.id));
        thread.title = fullTitle;
      }
    }

    const intentIds = new Set<string>();
    for (const msg of thread.messages) {
      if (msg.purchaseIntentId) intentIds.add(msg.purchaseIntentId);
      if (Array.isArray(msg.parts)) {
        for (const p of msg.parts) {
          if (
            p &&
            typeof p === 'object' &&
            'purchaseIntentId' in p &&
            typeof p.purchaseIntentId === 'string'
          ) {
            intentIds.add(p.purchaseIntentId);
          }
        }
      }
    }

    let hydratedMessages = thread.messages;
    if (intentIds.size > 0) {
      const intents = await db.query.purchaseIntent.findMany({
        where: inArray(purchaseIntent.id, Array.from(intentIds)),
        with: {
          transaction: true,
        },
      });
      const intentMap = new Map(intents.map((i) => [i.id, i]));

      hydratedMessages = thread.messages.map((msg) => {
        if (!Array.isArray(msg.parts)) return msg;

        const updatedParts = (msg.parts as Array<Record<string, unknown>>).map((part) => {
          if (!part || part.type !== 'action_card') return part;

          const linkedIntentId =
            (part.purchaseIntentId as string) || (msg.purchaseIntentId as string);
          if (!linkedIntentId) return part;

          const matchedIntent = intentMap.get(linkedIntentId);
          if (!matchedIntent) return part;

          if (matchedIntent.status === 'completed') {
            const completedTx = matchedIntent.transaction;
            const isRefunded = completedTx?.status === 'refunded';
            return {
              ...part,
              cardType: 'payment_completed',
              status: isRefunded ? 'refunded' : 'completed',
              refundedAmountCents: completedTx?.refundedAmountCents,
              paypalCaptureId:
                completedTx?.paypalCaptureId ||
                (part.paypalCaptureId as string) ||
                'SANDBOX_CAPTURED',
              paypalOrderId:
                completedTx?.paypalOrderId || (part.paypalOrderId as string) || undefined,
              amountCents:
                completedTx?.amountCents || matchedIntent.estimatedAmountCents || part.amountCents,
            };
          }

          if (matchedIntent.status === 'rejected') {
            return {
              ...part,
              status: 'rejected',
              rejectionReason:
                matchedIntent.rejectionReason || (part.rejectionReason as string) || undefined,
            };
          }

          return part;
        });

        return {
          ...msg,
          parts: updatedParts,
        };
      });
    }

    return NextResponse.json({ thread, messages: hydratedMessages });
  } catch (error) {
    console.error('Error fetching chat thread:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context?: { params?: Promise<{ id?: string }> | { id?: string } },
) {
  try {
    const { error: authError, session } = await requireAuth(req);
    if (authError || !session?.user) {
      return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await context?.params;
    const threadId = resolvedParams?.id;
    if (!threadId) {
      return NextResponse.json({ error: 'Thread identifier is required' }, { status: 400 });
    }

    const thread = await db.query.chatThread.findFirst({
      where: and(eq(chatThread.id, threadId), eq(chatThread.userId, session.user.id)),
    });

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    await db.delete(chatThread).where(eq(chatThread.id, threadId));

    return NextResponse.json({ status: 'deleted', id: threadId });
  } catch (error) {
    console.error('Error deleting chat thread:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context?: { params?: Promise<{ id?: string }> | { id?: string } },
) {
  try {
    const { error: authError, session } = await requireAuth(req);
    if (authError || !session?.user) {
      return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await context?.params;
    const threadId = resolvedParams?.id;
    if (!threadId) {
      return NextResponse.json({ error: 'Thread identifier is required' }, { status: 400 });
    }

    const rawBody = await req.json().catch(() => ({}));
    const validated = updateThreadSchema.safeParse(rawBody);
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: validated.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const existingThread = await db.query.chatThread.findFirst({
      where: and(eq(chatThread.id, threadId), eq(chatThread.userId, session.user.id)),
    });

    if (!existingThread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    const [updatedThread] = await db
      .update(chatThread)
      .set({
        title: validated.data.title,
        updatedAt: new Date(),
      })
      .where(eq(chatThread.id, threadId))
      .returning();

    return NextResponse.json({ thread: updatedThread });
  } catch (error) {
    console.error('Error updating chat thread:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
