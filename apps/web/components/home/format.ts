const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats integer cents as USD with exactly two decimals, e.g. 7450 -> "$74.50". */
export function formatUsd(cents: number): string {
  return usd.format(cents / 100);
}

/** Turns a policy category id into readable text, e.g. "crypto_exchange" -> "crypto exchange". */
export function formatCategory(category: string): string {
  return category.replaceAll('_', ' ');
}
