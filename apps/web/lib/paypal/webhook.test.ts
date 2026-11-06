import {
  extractPayPalHeaders,
  isValidPayPalCertUrl,
  processVerifiedWebhook,
  verifyPayPalWebhookSignature,
} from '@/lib/paypal/webhook';
import { db } from '@workspace/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@workspace/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(async (cb) => {
      const mockTx = {
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{}]),
          })),
        })),
      };
      return cb(mockTx);
    }),
  },
  eq: vi.fn((col, val) => ({ col, val })),
  sql: vi.fn(),
  transaction: {
    id: 'transaction_id',
    paypalCaptureId: 'paypal_capture_id',
    paypalOrderId: 'paypal_order_id',
    purchaseIntentId: 'purchase_intent_id',
    status: 'status',
    refundedAmountCents: 'refunded_amount_cents',
  },
  purchaseIntent: {
    id: 'purchase_intent_id',
    status: 'status',
  },
  webhookEvent: {
    id: 'webhook_event_id',
    transmissionId: 'transmission_id',
    status: 'status',
  },
}));

vi.mock('@/lib/paypal/client', () => ({
  getPayPalCredentials: vi.fn(() => ({
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    environment: 'sandbox',
  })),
  isPayPalConfigured: vi.fn(() => true),
}));

describe('PayPal Webhook Headers & Domain Validation (AC-1, AC-2)', () => {
  it('extracts all required transmission headers correctly (AC-1)', () => {
    const headers = new Headers({
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-123',
      'paypal-transmission-id': 'TRANS-999',
      'paypal-transmission-sig': 'BASE64_SIG==',
      'paypal-transmission-time': '2026-11-06T12:00:00Z',
    });

    const extracted = extractPayPalHeaders(headers);
    expect(extracted.authAlgo).toBe('SHA256withRSA');
    expect(extracted.certUrl).toBe(
      'https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-123',
    );
    expect(extracted.transmissionId).toBe('TRANS-999');
    expect(extracted.transmissionSig).toBe('BASE64_SIG==');
    expect(extracted.transmissionTime).toBe('2026-11-06T12:00:00Z');
  });

  it('validates genuine PayPal certificate URLs and rejects untrusted hostnames (AC-2)', () => {
    expect(
      isValidPayPalCertUrl('https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-1'),
    ).toBe(true);
    expect(isValidPayPalCertUrl('https://api-m.paypal.com/v1/notifications/certs/CERT-2')).toBe(
      true,
    );
    expect(isValidPayPalCertUrl('https://api.paypal.com/v1/notifications/certs/CERT-3')).toBe(true);

    // Invalid or malicious URLs (SSRF prevention)
    expect(isValidPayPalCertUrl('http://api-m.sandbox.paypal.com/cert')).toBe(false); // Non-HTTPS
    expect(isValidPayPalCertUrl('https://attacker.com/cert')).toBe(false);
    expect(isValidPayPalCertUrl('https://api-m.paypal.com.attacker.com/cert')).toBe(false);
    expect(isValidPayPalCertUrl(null)).toBe(false);
    expect(isValidPayPalCertUrl('not-a-url')).toBe(false);
  });
});

describe('PayPal Webhook Signature Verification (AC-2, AC-8)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it('passes automatically in simulation mode without external network calls (AC-8)', async () => {
    process.env.PAYPAL_SIMULATION = 'true';

    const result = await verifyPayPalWebhookSignature({
      headers: {
        authAlgo: null,
        certUrl: null,
        transmissionId: 'SIM-TRANS-1',
        transmissionSig: null,
        transmissionTime: null,
      },
      rawBody: JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED' }),
    });

    expect(result.verified).toBe(true);
    expect(result.mode).toBe('simulation');
  });

  it('rejects verification when required headers are missing in live mode (AC-1, AC-2)', async () => {
    process.env.PAYPAL_SIMULATION = 'false';

    const result = await verifyPayPalWebhookSignature({
      headers: {
        authAlgo: null,
        certUrl: 'https://api-m.sandbox.paypal.com/cert',
        transmissionId: 'TRANS-1',
        transmissionSig: 'SIG',
        transmissionTime: 'TIME',
      },
      rawBody: JSON.stringify({ id: 'EV-1' }),
    });

    expect(result.verified).toBe(false);
    expect(result.reason).toContain('Missing one or more required');
  });

  it('rejects verification when certUrl fails host verification (AC-2)', async () => {
    process.env.PAYPAL_SIMULATION = 'false';

    const result = await verifyPayPalWebhookSignature({
      headers: {
        authAlgo: 'SHA256withRSA',
        certUrl: 'https://malicious-domain.com/cert',
        transmissionId: 'TRANS-1',
        transmissionSig: 'SIG',
        transmissionTime: 'TIME',
      },
      rawBody: JSON.stringify({ id: 'EV-1' }),
    });

    expect(result.verified).toBe(false);
    expect(result.reason).toContain('Invalid or untrusted PayPal certificate URL');
  });
});

describe('Webhook Processing, Replay Defense, and State Sync (AC-3, AC-4, AC-5, AC-6, AC-7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects duplicate transmission and returns duplicate status without modifying state (AC-3)', async () => {
    const mockExistingEvent = {
      id: 'existing-event-uuid',
      transmissionId: 'DUP-TRANS-123',
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      status: 'processed',
    };

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockExistingEvent]),
        }),
      }),
    } as unknown as ReturnType<typeof db.select>);

    const result = await processVerifiedWebhook({
      transmissionId: 'DUP-TRANS-123',
      payload: {
        id: 'EV-1',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource_type: 'capture',
      },
      rawHeaders: {},
    });

    expect(result.duplicate).toBe(true);
    expect(result.status).toBe('duplicate');
    expect(result.eventId).toBe('existing-event-uuid');
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('processes PAYMENT.CAPTURE.COMPLETED and transitions transaction and intent to completed (AC-4, AC-7)', async () => {
    // 1. Replay check: empty (not a duplicate)
    // 2. Transaction resolution: found transaction
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // Replay query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as unknown as ReturnType<typeof db.select>;
      }
      // Transaction lookup query by capture id
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'tx-123',
                paypalCaptureId: 'CAP-777',
                purchaseIntentId: 'pi-123',
                status: 'pending_capture',
                refundedAmountCents: 0,
              },
            ]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>;
    });

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'event-uuid-1',
            transmissionId: 'TRANS-NEW-1',
            status: 'received',
          },
        ]),
      }),
    } as unknown as ReturnType<typeof db.insert>);

    const result = await processVerifiedWebhook({
      transmissionId: 'TRANS-NEW-1',
      payload: {
        id: 'EV-1',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource_type: 'capture',
        resource: {
          id: 'CAP-777',
          status: 'COMPLETED',
          create_time: '2026-11-06T15:00:00Z',
        },
      },
      rawHeaders: {},
    });

    expect(result.duplicate).toBe(false);
    expect(result.status).toBe('processed');
    expect(result.transactionId).toBe('tx-123');
    expect(db.transaction).toHaveBeenCalled();
  });

  it('processes PAYMENT.CAPTURE.DENIED and transitions transaction and intent to failed (AC-5)', async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as unknown as ReturnType<typeof db.select>;
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'tx-456',
                paypalCaptureId: 'CAP-DENIED-1',
                purchaseIntentId: 'pi-456',
                status: 'pending_capture',
                refundedAmountCents: 0,
              },
            ]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>;
    });

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'event-uuid-2',
            transmissionId: 'TRANS-DENY-1',
            status: 'received',
          },
        ]),
      }),
    } as unknown as ReturnType<typeof db.insert>);

    const result = await processVerifiedWebhook({
      transmissionId: 'TRANS-DENY-1',
      payload: {
        id: 'EV-DENIED',
        event_type: 'PAYMENT.CAPTURE.DENIED',
        resource_type: 'capture',
        resource: {
          id: 'CAP-DENIED-1',
          status: 'DENIED',
          status_details: {
            reason: 'INSUFFICIENT_FUNDS',
          },
        },
      },
      rawHeaders: {},
    });

    expect(result.status).toBe('processed');
    expect(result.transactionId).toBe('tx-456');
    expect(db.transaction).toHaveBeenCalled();
  });

  it('processes PAYMENT.CAPTURE.REFUNDED and updates transaction status and refunded amount (AC-6)', async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as unknown as ReturnType<typeof db.select>;
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'tx-789',
                paypalCaptureId: 'CAP-REFUND-1',
                purchaseIntentId: 'pi-789',
                status: 'completed',
                refundedAmountCents: 0,
              },
            ]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>;
    });

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'event-uuid-3',
            transmissionId: 'TRANS-REFUND-1',
            status: 'received',
          },
        ]),
      }),
    } as unknown as ReturnType<typeof db.insert>);

    const result = await processVerifiedWebhook({
      transmissionId: 'TRANS-REFUND-1',
      payload: {
        id: 'EV-REFUND',
        event_type: 'PAYMENT.CAPTURE.REFUNDED',
        resource_type: 'capture',
        resource: {
          id: 'CAP-REFUND-1',
          status: 'COMPLETED',
          amount: {
            currency_code: 'USD',
            value: '25.00',
          },
        },
      },
      rawHeaders: {},
    });

    expect(result.status).toBe('processed');
    expect(result.transactionId).toBe('tx-789');
    expect(db.transaction).toHaveBeenCalled();
  });

  it('marks unmatched transactions as ignored and returns status ignored (AC-7)', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]), // No matching records anywhere
        }),
      }),
    } as unknown as ReturnType<typeof db.select>);

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'event-uuid-4',
            transmissionId: 'TRANS-UNMATCHED-1',
            status: 'received',
          },
        ]),
      }),
    } as unknown as ReturnType<typeof db.insert>);

    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{}]),
      }),
    } as unknown as ReturnType<typeof db.update>);

    const result = await processVerifiedWebhook({
      transmissionId: 'TRANS-UNMATCHED-1',
      payload: {
        id: 'EV-UNMATCHED',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource_type: 'capture',
        resource: {
          id: 'NON_EXISTENT_ID',
        },
      },
      rawHeaders: {},
    });

    expect(result.status).toBe('ignored');
    expect(result.message).toContain('no matching transaction found');
  });

  it('preserves terminal state when delayed capture arrives after refund (AC-4, AC-6)', async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as unknown as ReturnType<typeof db.select>;
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'tx-terminal',
                paypalCaptureId: 'CAP-TERMINAL',
                purchaseIntentId: 'pi-terminal',
                status: 'refunded', // already refunded!
                refundedAmountCents: 1000,
              },
            ]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>;
    });

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'event-uuid-terminal',
            transmissionId: 'TRANS-TERMINAL',
            status: 'received',
          },
        ]),
      }),
    } as unknown as ReturnType<typeof db.insert>);

    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{}]),
      }),
    } as unknown as ReturnType<typeof db.update>);

    const result = await processVerifiedWebhook({
      transmissionId: 'TRANS-TERMINAL',
      payload: {
        id: 'EV-DELAYED',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource_type: 'capture',
        resource: {
          id: 'CAP-TERMINAL',
        },
      },
      rawHeaders: {},
    });

    expect(result.status).toBe('ignored');
    expect(result.message).toContain('terminal state refunded');
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
