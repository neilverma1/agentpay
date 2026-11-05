import { requireAuth } from '@/lib/auth-helpers';
import { getPresignedUploadUrlSchema } from '@workspace/contracts';
import { generateStorageKey, StorageService } from '@workspace/storage';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { error } = await requireAuth(req);
    if (error) return error;

    const body = await req.json();
    const parsed = getPresignedUploadUrlSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid upload parameters', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { filename, contentType, folder } = parsed.data;

    const storage = new StorageService();
    await storage.ensureBucketExists();

    const key = generateStorageKey(folder, filename);

    const presigned = await storage.getUploadPresignedUrl({
      key,
      contentType,
    });

    return NextResponse.json(presigned);
  } catch (err: unknown) {
    console.error('Error generating presigned upload URL:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
