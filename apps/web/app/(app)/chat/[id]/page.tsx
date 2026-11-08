import { ChatThreadView } from '@/components/chat/chat-thread-view';
import { generatePageMetadata, pageMetadata } from '@/config/metadata';
import { requireUser } from '@/lib/auth-helpers';
import { chatThread, db, eq } from '@workspace/db';
import type { Metadata } from 'next';
import type { ReactElement } from 'react';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const thread = await db.query.chatThread.findFirst({
      where: eq(chatThread.id, id),
      columns: {
        title: true,
      },
    });

    const title = thread?.title || pageMetadata.chat.title;
    const description = thread?.title
      ? `Autonomous commerce mission: ${thread.title}`
      : pageMetadata.chat.description;

    return generatePageMetadata(title, description, { noindex: true });
  } catch {
    return generatePageMetadata(pageMetadata.chat.title, pageMetadata.chat.description, {
      noindex: true,
    });
  }
}

export default async function ChatThreadPage({ params }: Props): Promise<ReactElement> {
  await requireUser();
  const { id } = await params;

  return (
    <div className="flex h-[calc(100dvh-var(--header-height,3.5rem))] max-h-[calc(100dvh-var(--header-height,3.5rem))] flex-1 flex-col overflow-hidden">
      <ChatThreadView threadId={id} />
    </div>
  );
}
