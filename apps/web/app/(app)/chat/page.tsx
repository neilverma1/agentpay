import { ChatLauncher } from '@/components/chat/chat-launcher';
import { generatePageMetadata, pageMetadata } from '@/config/metadata';
import { requireUser } from '@/lib/auth-helpers';
import type { ReactElement } from 'react';

export const metadata = generatePageMetadata(
  pageMetadata.chat.title,
  pageMetadata.chat.description,
  { noindex: true },
);

export default async function ChatLauncherPage(): Promise<ReactElement> {
  await requireUser();

  return (
    <main className="flex-1 overflow-y-auto">
      <ChatLauncher />
    </main>
  );
}
