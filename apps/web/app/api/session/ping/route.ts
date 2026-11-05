import { requireAuth } from '@/lib/auth-helpers';
import { db, eq, session as sessionTable } from '@workspace/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireAuth(req);
    if (error) return error;

    await db
      .update(sessionTable)
      .set({ updatedAt: new Date() })
      .where(eq(sessionTable.id, session.session.id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
