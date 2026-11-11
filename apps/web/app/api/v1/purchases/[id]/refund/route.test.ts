// @vitest-environment node
import { POST } from '@/app/api/v1/purchases/[id]/refund/route';
import { requireAuth } from '@/lib/auth-helpers';
import { refundPayPalCapture } from '@/lib/paypal/service';
import { db } from '@workspace/db';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/paypal/service', () => ({
  refundPayPalCapture: vi.fn(),
}));

vi.mock('@workspace/db', () => ({
  db: {
    query: {
      transaction: { findFirst: vi.fn() },
      purchaseIntent: { findFirst: vi.fn() },
      approvalRequest: { findFirst: vi.fn() },
      chatMessage: { findMany: vi.fn() },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue({}),
      })),
    })),
  },
  transaction: {
    id: 'id',
    purchaseIntentId: 'purchase_intent_id',
    paypalCaptureId: 'paypal_capture_id',
    paypalOrderId: 'paypal_order_id',
  },
  purchaseIntent: {
    id: 'id',
  },
  approvalRequest: {
    purchaseIntentId: 'purchase_intent_id',
  },
  chatMessage: {
    id: 'id',
    purchaseIntentId: 'purchase_intent_id',
  },
  eq: vi.fn(),
  or: vi.fn(),
}));

describe('Purchase Refund API (/api/v1/purchases/[id]/refund)', () => {
  const validUuid = '11111111-2222-4333-8444-555555555555';
  const mockSession = { user: { id: 'usr-123' } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      session: null as never,
    });

    const req = new NextRequest(`http://localhost:3000/api/v1/purchases/${validUuid}/refund`, {
      method: 'POST',
    });

    const res = await POST(req, { params: Promise.resolve({ id: validUuid }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when transaction is not found', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      session: mockSession as never,
    });

    vi.mocked(db.query.transaction.findFirst).mockResolvedValue(undefined);

    const req = new NextRequest(`http://localhost:3000/api/v1/purchases/${validUuid}/refund`, {
      method: 'POST',
    });

    const res = await POST(req, { params: Promise.resolve({ id: validUuid }) });
    expect(res.status).toBe(404);
  });

  it('returns 409 Conflict when transaction has already been refunded', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      session: mockSession as never,
    });

    vi.mocked(db.query.transaction.findFirst).mockResolvedValue({
      id: validUuid,
      purchaseIntentId: validUuid,
      paypalCaptureId: 'CAP-ALREADY-REFUNDED',
      amountCents: 5000,
      currency: 'USD',
      status: 'refunded',
      refundedAmountCents: 5000,
    } as never);

    const req = new NextRequest(`http://localhost:3000/api/v1/purchases/${validUuid}/refund`, {
      method: 'POST',
    });

    const res = await POST(req, { params: Promise.resolve({ id: validUuid }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('already been refunded');
  });

  it('returns 400 when purchase is marked as non-refundable (Final Sale)', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      session: mockSession as never,
    });

    vi.mocked(db.query.transaction.findFirst).mockResolvedValue({
      id: validUuid,
      purchaseIntentId: validUuid,
      paypalCaptureId: 'CAP-FINAL-SALE',
      amountCents: 2400,
      currency: 'USD',
      status: 'completed',
      refundedAmountCents: 0,
    } as never);

    vi.mocked(db.query.purchaseIntent.findFirst).mockResolvedValue({
      id: validUuid,
      itemDescription: 'Blue Bottle Coffee Blend',
      reasoningLog: [],
    } as never);

    vi.mocked(db.query.approvalRequest.findFirst).mockResolvedValue({
      id: 'appr-1',
      purchaseIntentId: validUuid,
      triggerDetails: {
        refundable: false,
        refundTerms: 'Perishable food consumable: non-refundable once shipped',
      },
    } as never);

    const req = new NextRequest(`http://localhost:3000/api/v1/purchases/${validUuid}/refund`, {
      method: 'POST',
    });

    const res = await POST(req, { params: Promise.resolve({ id: validUuid }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('non-refundable');
  });

  it('successfully processes refund for refundable transaction via PayPal', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      session: mockSession as never,
    });

    vi.mocked(db.query.transaction.findFirst).mockResolvedValue({
      id: validUuid,
      purchaseIntentId: validUuid,
      paypalCaptureId: 'CAP-12345',
      amountCents: 9999,
      currency: 'USD',
      status: 'completed',
      refundedAmountCents: 0,
    } as never);

    vi.mocked(db.query.purchaseIntent.findFirst).mockResolvedValue({
      id: validUuid,
      itemDescription: 'Logitech MX Master 3S',
      reasoningLog: [],
    } as never);

    vi.mocked(db.query.approvalRequest.findFirst).mockResolvedValue(undefined);
    vi.mocked(db.query.chatMessage.findMany).mockResolvedValue([]);

    vi.mocked(refundPayPalCapture).mockResolvedValue({
      refundId: 'REFUND-999',
      status: 'COMPLETED',
      refundedAmountCents: 9999,
      rawResponse: {},
    });

    const req = new NextRequest(`http://localhost:3000/api/v1/purchases/${validUuid}/refund`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Accidental duplicate' }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: validUuid }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe('refunded');
    expect(body.refundId).toBe('REFUND-999');
    expect(body.refundedAmountCents).toBe(9999);
  });
});
