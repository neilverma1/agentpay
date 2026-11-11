import {
  ApiError,
  CheckoutPaymentIntent,
  ExperienceContextShippingPreference,
  PaypalPaymentTokenCustomerType,
  PaypalPaymentTokenUsageType,
  VaultTokenRequestType,
} from '@paypal/paypal-server-sdk';
import {
  getOrdersController,
  getPaymentsController,
  getVaultController,
  isPayPalConfigured,
} from './client';

export function centsToCurrencyString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function currencyStringToCents(amountString: string): number {
  const parsed = parseFloat(amountString);
  if (isNaN(parsed)) {
    return 0;
  }
  return Math.round(parsed * 100);
}

export function sanitizeDetails(details: unknown): Record<string, unknown> {
  if (!details) return {};
  if (typeof details !== 'object') return { info: String(details) };
  try {
    return JSON.parse(
      JSON.stringify(details, (_key, val) => {
        if (val instanceof Error) {
          return {
            name: val.name,
            message: val.message,
          };
        }
        return val;
      }),
    );
  } catch {
    return { message: String(details) };
  }
}

export function isSimulationMode(): boolean {
  if (process.env.PAYPAL_SIMULATION === 'true') {
    return true;
  }
  return !isPayPalConfigured() && process.env.NODE_ENV !== 'production';
}

export interface CreateOrderParams {
  purchaseIntentId: string;
  amountCents: number;
  currency?: string;
  itemDescription: string;
  merchantName: string;
  paypalRequestId?: string;
  /** Vaulted PayPal wallet token of the paying user (required outside simulation mode). */
  vaultId?: string;
}

export interface CreateOrderResult {
  orderId: string;
  rawResponse: Record<string, unknown>;
}

export interface CaptureOrderResult {
  captureId: string;
  status: string;
  capturedAmountCents: number;
  rawResponse: Record<string, unknown>;
}

export class PayPalServiceError extends Error {
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = 'PayPalServiceError';
    this.statusCode = statusCode;
    this.details = sanitizeDetails(details);
  }
}

export async function createPayPalOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  if (isSimulationMode()) {
    const simulatedOrderId = `SIMULATED-ORDER-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    return {
      orderId: simulatedOrderId,
      rawResponse: {
        id: simulatedOrderId,
        status: 'CREATED',
        mode: 'simulated_sandbox',
        intent: 'CAPTURE',
        purchase_units: [
          {
            custom_id: params.purchaseIntentId,
            description: params.itemDescription,
            amount: {
              currency_code: params.currency ?? 'USD',
              value: centsToCurrencyString(params.amountCents),
            },
          },
        ],
      },
    };
  }

  if (!isPayPalConfigured()) {
    throw new PayPalServiceError(
      'PayPal Sandbox credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env.local, or set PAYPAL_SIMULATION=true.',
      422,
      { code: 'MISSING_PAYPAL_CREDENTIALS' },
    );
  }

  if (!params.vaultId) {
    throw new PayPalServiceError(
      'No PayPal account linked. Please [link your PayPal account in Settings](/settings/general#paypal) so the agent can pay on your behalf.',
      422,
      { code: 'MISSING_PAYPAL_VAULT' },
    );
  }

  const controller = getOrdersController();
  const currency = params.currency ?? 'USD';
  const amountValue = centsToCurrencyString(params.amountCents);

  try {
    const response = await controller.createOrder({
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [
          {
            customId: params.purchaseIntentId,
            description: params.itemDescription,
            amount: {
              currencyCode: currency,
              value: amountValue,
            },
          },
        ],
        // Autonomous approval: the user's vaulted PayPal wallet authorizes the order, so
        // no redirect to the 'approve' link is needed.
        paymentSource: { paypal: { vaultId: params.vaultId } },
      },
      prefer: 'return=representation',
      paypalRequestId: params.paypalRequestId || params.purchaseIntentId,
    });

    const result = response.result;
    if (!result.id) {
      throw new PayPalServiceError(
        'PayPal order creation succeeded but no order identifier was returned.',
        502,
        result,
      );
    }

    return {
      orderId: result.id,
      rawResponse: sanitizeDetails(result),
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw new PayPalServiceError(
        `PayPal order creation failed: ${describeApiError(error)}`,
        error.statusCode || 502,
        error.result ?? error.body,
      );
    }
    if (error instanceof PayPalServiceError) {
      throw error;
    }
    throw new PayPalServiceError(
      error instanceof Error ? error.message : 'Unknown PayPal error during order creation',
      500,
      error,
    );
  }
}

function describeApiError(error: ApiError): string {
  const body: unknown = error.result ?? error.body;
  let parsed: unknown = body;
  if (typeof body === 'string') {
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = undefined;
    }
  }
  if (typeof parsed === 'object' && parsed !== null) {
    const record = parsed as { name?: unknown; message?: unknown; details?: unknown };
    const parts: string[] = [];
    if (typeof record.name === 'string') parts.push(record.name);
    if (Array.isArray(record.details)) {
      for (const detail of record.details) {
        if (typeof detail === 'object' && detail !== null) {
          const d = detail as { issue?: unknown; description?: unknown };
          if (typeof d.issue === 'string') parts.push(d.issue);
          if (typeof d.description === 'string') parts.push(d.description);
        }
      }
    } else if (typeof record.message === 'string') {
      parts.push(record.message);
    }
    if (parts.length > 0) return `${parts.join(' - ')} (HTTP ${error.statusCode})`;
  }
  return `${error.message || 'API error'} (HTTP ${error.statusCode})`;
}

export async function capturePayPalOrder(
  orderId: string,
  expectedAmountCents?: number,
  paypalRequestId?: string,
): Promise<CaptureOrderResult> {
  if (isSimulationMode() || orderId.startsWith('SIMULATED-ORDER-')) {
    const simulatedCaptureId = `SIMULATED-CAPTURE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const amountCents = expectedAmountCents ?? 1000;
    return {
      captureId: simulatedCaptureId,
      status: 'COMPLETED',
      capturedAmountCents: amountCents,
      rawResponse: {
        id: simulatedCaptureId,
        status: 'COMPLETED',
        mode: 'simulated_sandbox',
        order_id: orderId,
        amount: {
          currency_code: 'USD',
          value: centsToCurrencyString(amountCents),
        },
      },
    };
  }

  const controller = getOrdersController();

  try {
    let result;
    try {
      const response = await controller.captureOrder({
        id: orderId,
        prefer: 'return=representation',
        paypalRequestId: paypalRequestId || `capture-${orderId}`,
      });
      result = response.result;
    } catch (captureError) {
      // Orders paid with a vaulted wallet are captured on creation; read the order back instead.
      if (
        captureError instanceof ApiError &&
        JSON.stringify(captureError.result ?? captureError.body ?? '').includes(
          'ORDER_ALREADY_CAPTURED',
        )
      ) {
        result = (await controller.getOrder({ id: orderId })).result;
      } else {
        throw captureError;
      }
    }

    const capture = result.purchaseUnits?.[0]?.payments?.captures?.[0];

    if (!capture?.id) {
      throw new PayPalServiceError(
        'PayPal order capture completed without returning a capture identifier.',
        502,
        result,
      );
    }

    const capturedValue = capture.amount?.value ? currencyStringToCents(capture.amount.value) : 0;

    return {
      captureId: capture.id,
      status: capture.status || result.status || 'COMPLETED',
      capturedAmountCents: capturedValue,
      rawResponse: sanitizeDetails(result),
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw new PayPalServiceError(
        `PayPal order capture failed: ${describeApiError(error)}`,
        error.statusCode || 422,
        error.result ?? error.body,
      );
    }
    if (error instanceof PayPalServiceError) {
      throw error;
    }
    throw new PayPalServiceError(
      error instanceof Error ? error.message : 'Unknown PayPal error during order capture',
      500,
      error,
    );
  }
}

export interface VaultSetupResult {
  setupTokenId: string;
  approveUrl: string;
}

export interface VaultedWallet {
  vaultId: string;
  paypalCustomerId?: string;
  payerEmail?: string;
}

/** Starts the one-time "Link PayPal" flow; the user must open `approveUrl` to consent. */
export async function createVaultSetupToken(params: {
  returnUrl: string;
  cancelUrl: string;
}): Promise<VaultSetupResult> {
  if (!isPayPalConfigured()) {
    throw new PayPalServiceError(
      'PayPal Sandbox credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env.local.',
      422,
      { code: 'MISSING_PAYPAL_CREDENTIALS' },
    );
  }

  try {
    const response = await getVaultController().createSetupToken({
      body: {
        paymentSource: {
          paypal: {
            description: 'AgentPay Autonomous Wallet Authorization',
            usageType: PaypalPaymentTokenUsageType.Merchant,
            customerType: PaypalPaymentTokenCustomerType.Consumer,
            experienceContext: {
              brandName: 'AgentPay',
              shippingPreference: ExperienceContextShippingPreference.NoShipping,
              returnUrl: params.returnUrl,
              cancelUrl: params.cancelUrl,
            },
          },
        },
      },
    });

    const approveUrl = response.result.links?.find((link) => link.rel === 'approve')?.href;
    if (!response.result.id || !approveUrl) {
      throw new PayPalServiceError(
        'PayPal vault setup succeeded but returned no approval link.',
        502,
        response.result,
      );
    }
    return { setupTokenId: response.result.id, approveUrl };
  } catch (error) {
    if (error instanceof ApiError) {
      throw new PayPalServiceError(
        `PayPal vault setup failed: ${describeApiError(error)}`,
        error.statusCode || 422,
        error.result ?? error.body,
      );
    }
    if (error instanceof PayPalServiceError) throw error;
    throw new PayPalServiceError(
      error instanceof Error ? error.message : 'Unknown PayPal error during vault setup',
      500,
      error,
    );
  }
}

/** Exchanges an approved setup token for a permanent vaulted payment token. */
export async function createVaultPaymentToken(setupTokenId: string): Promise<VaultedWallet> {
  try {
    const response = await getVaultController().createPaymentToken({
      body: {
        paymentSource: {
          token: { id: setupTokenId, type: VaultTokenRequestType.SetupToken },
        },
      },
    });

    if (!response.result.id) {
      throw new PayPalServiceError(
        'PayPal vault approval succeeded but no payment token was returned.',
        502,
        response.result,
      );
    }
    return {
      vaultId: response.result.id,
      paypalCustomerId: response.result.customer?.id,
      payerEmail: response.result.paymentSource?.paypal?.emailAddress,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw new PayPalServiceError(
        `PayPal vault token exchange failed: ${describeApiError(error)}`,
        error.statusCode || 422,
        error.result ?? error.body,
      );
    }
    if (error instanceof PayPalServiceError) throw error;
    throw new PayPalServiceError(
      error instanceof Error ? error.message : 'Unknown PayPal error during vault token exchange',
      500,
      error,
    );
  }
}

export interface RefundCaptureResult {
  refundId: string;
  status: string;
  refundedAmountCents: number;
  rawResponse: Record<string, unknown>;
}

export async function refundPayPalCapture(
  captureId: string,
  amountCents?: number,
  currency = 'USD',
  reason?: string,
): Promise<RefundCaptureResult> {
  if (isSimulationMode() || captureId.startsWith('SIMULATED-')) {
    const simulatedRefundId = `SIMULATED-REFUND-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const refundedCents = amountCents ?? 0;
    return {
      refundId: simulatedRefundId,
      status: 'COMPLETED',
      refundedAmountCents: refundedCents,
      rawResponse: {
        id: simulatedRefundId,
        status: 'COMPLETED',
        mode: 'simulated_sandbox',
        capture_id: captureId,
        amount: {
          currency_code: currency,
          value: centsToCurrencyString(refundedCents),
        },
      },
    };
  }

  const controller = getPaymentsController();

  try {
    const response = await controller.refundCapturedPayment({
      captureId,
      paypalRequestId: `refund-${captureId}-${Date.now()}`,
      body: amountCents
        ? {
            amount: {
              value: centsToCurrencyString(amountCents),
              currencyCode: currency,
            },
            noteToPayer: reason || 'Refund issued via AgentPay',
          }
        : undefined,
    });

    const result = response.result;
    const refundedValue = result.amount?.value
      ? currencyStringToCents(result.amount.value)
      : (amountCents ?? 0);

    return {
      refundId: result.id || `REFUND-${Date.now()}`,
      status: result.status || 'COMPLETED',
      refundedAmountCents: refundedValue,
      rawResponse: sanitizeDetails(result),
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw new PayPalServiceError(
        `PayPal capture refund failed: ${describeApiError(error)}`,
        error.statusCode || 422,
        error.result ?? error.body,
      );
    }
    if (error instanceof PayPalServiceError) {
      throw error;
    }
    throw new PayPalServiceError(
      error instanceof Error ? error.message : 'Unknown PayPal error during refund',
      500,
      error,
    );
  }
}
