import {
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  VaultController,
} from '@paypal/paypal-server-sdk';

let cachedClient: Client | null = null;
let cachedOrdersController: OrdersController | null = null;
let cachedPaymentsController: PaymentsController | null = null;

export function getPayPalCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
  const environment =
    process.env.PAYPAL_ENVIRONMENT === 'production' ? Environment.Production : Environment.Sandbox;

  return {
    clientId,
    clientSecret,
    environment,
  };
}

export function isPayPalConfigured(): boolean {
  const { clientId, clientSecret } = getPayPalCredentials();
  return Boolean(
    clientId && clientSecret && !clientId.includes('your-') && !clientSecret.includes('your-'),
  );
}

export function getPayPalClient(): Client {
  if (cachedClient) {
    return cachedClient;
  }

  const { clientId, clientSecret, environment } = getPayPalCredentials();

  cachedClient = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: clientId,
      oAuthClientSecret: clientSecret,
    },
    environment,
    timeout: 10000,
  });

  return cachedClient;
}

export function getVaultController(): VaultController {
  return new VaultController(getPayPalClient());
}

export function getOrdersController(): OrdersController {
  if (cachedOrdersController) {
    return cachedOrdersController;
  }

  const client = getPayPalClient();
  cachedOrdersController = new OrdersController(client);
  return cachedOrdersController;
}

export function getPaymentsController(): PaymentsController {
  if (cachedPaymentsController) {
    return cachedPaymentsController;
  }

  const client = getPayPalClient();
  cachedPaymentsController = new PaymentsController(client);
  return cachedPaymentsController;
}
