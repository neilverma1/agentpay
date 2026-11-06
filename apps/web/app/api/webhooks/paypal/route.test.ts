// @vitest-environment node
import { POST } from '@/app/api/webhooks/paypal/route';
import { processVerifiedWebhook, verifyPayPalWebhookSignature } from '@/lib/paypal/webhook';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/paypal/webhook', () => ({
  extractPayPalHeaders: vi.fn((headers: Headers) => ({
    authAlgo: headers.get('paypal-auth-algo'),
    certUrl: headers.get('paypal-cert-url'),
    transmissionId: headers.get('paypal-transmission-id'),
    transmissionSig: headers.get('paypal-transmission-sig'),
    transmissionTime: headers.get('paypal-transmission-time'),
  })),
  verifyPayPalWebhookSignature: vi.fn(),
  processVerifiedWebhook: vi.fn(),
}));

describe('POST /api/webhooks/paypal HTTP Route Handler (AC-1, AC-2, AC-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns HTTP 400 when request body is empty', async () => {
    const req = new NextRequest('http://localhost:3000/api/webhooks/paypal', {
      method: 'POST',
      body: '',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Empty request body');
  });

  it('returns HTTP 400 when request body is malformed JSON', async () => {
    const req = new NextRequest('http://localhost:3000/api/webhooks/paypal', {
      method: 'POST',
      body: 'invalid-json{',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Malformed JSON payload');
  });

  it('returns HTTP 400 when signature verification fails (AC-2)', async () => {
    vi.mocked(verifyPayPalWebhookSignature).mockResolvedValue({
      verified: false,
      mode: 'live',
      reason: 'Signature mismatch',
    });

    const req = new NextRequest('http://localhost:3000/api/webhooks/paypal', {
      method: 'POST',
      body: JSON.stringify({ id: 'EV-1', event_type: 'PAYMENT.CAPTURE.COMPLETED' }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('PayPal webhook signature verification failed');
    expect(data.reason).toBe('Signature mismatch');
  });

  it('returns HTTP 200 with duplicate flag on repeated webhook transmission (AC-3)', async () => {
    vi.mocked(verifyPayPalWebhookSignature).mockResolvedValue({
      verified: true,
      mode: 'live',
    });

    vi.mocked(processVerifiedWebhook).mockResolvedValue({
      received: true,
      duplicate: true,
      eventId: 'event-uuid-dup',
      status: 'duplicate',
    });

    const req = new NextRequest('http://localhost:3000/api/webhooks/paypal', {
      method: 'POST',
      body: JSON.stringify({ id: 'EV-1', event_type: 'PAYMENT.CAPTURE.COMPLETED' }),
      headers: {
        'paypal-transmission-id': 'TRANS-DUP',
        'paypal-transmission-sig': 'VALID_SIG',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
    expect(data.duplicate).toBe(true);
    expect(data.eventId).toBe('event-uuid-dup');
  });

  it('returns HTTP 200 and processes event on successful verification (AC-1, AC-4)', async () => {
    vi.mocked(verifyPayPalWebhookSignature).mockResolvedValue({
      verified: true,
      mode: 'live',
    });

    vi.mocked(processVerifiedWebhook).mockResolvedValue({
      received: true,
      duplicate: false,
      eventId: 'event-uuid-ok',
      status: 'processed',
      transactionId: 'tx-ok-1',
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
    });

    const req = new NextRequest('http://localhost:3000/api/webhooks/paypal', {
      method: 'POST',
      body: JSON.stringify({ id: 'EV-OK', event_type: 'PAYMENT.CAPTURE.COMPLETED' }),
      headers: {
        'paypal-transmission-id': 'TRANS-OK-1',
        'paypal-transmission-sig': 'VALID_SIG',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
    expect(data.duplicate).toBe(false);
    expect(data.eventId).toBe('event-uuid-ok');
    expect(data.status).toBe('processed');
    expect(data.transactionId).toBe('tx-ok-1');
  });
});
