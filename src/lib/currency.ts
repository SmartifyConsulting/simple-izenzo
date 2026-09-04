/** Country → home currency, with a static approximate USD exchange rate.
 * Rates are illustrative, not live market data. */
const COUNTRY_CURRENCY: Record<string, { code: string; symbol: string; usdRate: number }> = {
  "south africa": { code: "ZAR", symbol: "R", usdRate: 18.5 },
  "united states": { code: "USD", symbol: "$", usdRate: 1 },
  usa: { code: "USD", symbol: "$", usdRate: 1 },
  "united kingdom": { code: "GBP", symbol: "£", usdRate: 0.79 },
  uk: { code: "GBP", symbol: "£", usdRate: 0.79 },
  germany: { code: "EUR", symbol: "€", usdRate: 0.92 },
  france: { code: "EUR", symbol: "€", usdRate: 0.92 },
  netherlands: { code: "EUR", symbol: "€", usdRate: 0.92 },
  ireland: { code: "EUR", symbol: "€", usdRate: 0.92 },
  spain: { code: "EUR", symbol: "€", usdRate: 0.92 },
  italy: { code: "EUR", symbol: "€", usdRate: 0.92 },
  nigeria: { code: "NGN", symbol: "₦", usdRate: 1550 },
  kenya: { code: "KES", symbol: "KSh", usdRate: 129 },
  botswana: { code: "BWP", symbol: "P", usdRate: 13.6 },
  namibia: { code: "NAD", symbol: "N$", usdRate: 18.5 },
  zambia: { code: "ZMW", symbol: "K", usdRate: 26 },
  zimbabwe: { code: "ZWL", symbol: "Z$", usdRate: 26000 },
  australia: { code: "AUD", symbol: "A$", usdRate: 1.52 },
  canada: { code: "CAD", symbol: "C$", usdRate: 1.37 },
  india: { code: "INR", symbol: "₹", usdRate: 83.5 },
  china: { code: "CNY", symbol: "¥", usdRate: 7.2 },
  japan: { code: "JPY", symbol: "¥", usdRate: 150 },
  brazil: { code: "BRL", symbol: "R$", usdRate: 5.1 },
  uae: { code: "AED", symbol: "د.إ", usdRate: 3.67 },
  "united arab emirates": { code: "AED", symbol: "د.إ", usdRate: 3.67 },
};

export function homeCurrencyFor(country: string | null | undefined) {
  if (!country) return null;
  return COUNTRY_CURRENCY[country.trim().toLowerCase()] ?? null;
}

export function formatHomeCurrency(usdAmount: number, country: string | null | undefined) {
  const currency = homeCurrencyFor(country);
  if (!currency) return null;
  const converted = usdAmount * currency.usdRate;
  const formatted = converted.toLocaleString("en", { maximumFractionDigits: 0 });
  return { ...currency, amount: converted, formatted: `${currency.symbol} ${formatted}` };
}
