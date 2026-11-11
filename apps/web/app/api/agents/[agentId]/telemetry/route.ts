import { requireAuth } from '@/lib/auth-helpers';
import { getAgentTelemetry, TelemetryServiceError } from '@workspace/agent';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, props: { params: Promise<{ agentId: string }> }) {
  const { error: authError, session } = await requireAuth(req);
  if (authError || !session?.user) {
    return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { agentId } = await props.params;
  const searchParams = req.nextUrl.searchParams;
  const cursor = searchParams.get('cursor');
  const status = searchParams.get('status');
  const limitStr = searchParams.get('limit');
  const limit = limitStr ? parseInt(limitStr, 10) : 50;

  try {
    const data = await getAgentTelemetry({
      agentId,
      userId: session.user.id,
      cursor,
      status,
      limit,
    });

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    if (error instanceof TelemetryServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    const message = error instanceof Error ? error.message : 'Failed to retrieve agent telemetry';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
