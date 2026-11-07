import { ChatThreadView } from '@/components/chat/chat-thread-view';
import { generatePageMetadata, pageMetadata } from '@/config/metadata';
import { requireUser } from '@/lib/auth-helpers';
import type { ReactElement } from 'react';

export const metadata = generatePageMetadata(
  pageMetadata.chat.title,
  pageMetadata.chat.description,
  { noindex: true },
);

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  await requireUser();
  const { id } = await params;

  return (
    <div className="flex h-[calc(100dvh-var(--header-height,3.5rem))] max-h-[calc(100dvh-var(--header-height,3.5rem))] flex-1 flex-col overflow-hidden">
      <ChatThreadView threadId={id} />
    </div>
  );
}
