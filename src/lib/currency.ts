// Este archivo contiene la configuración y utilidades para el manejo de monedas en la aplicación

export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

// Lista de monedas disponibles en la aplicación
export const availableCurrencies: Currency[] = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "DOP", name: "Dominican Peso", symbol: "RD$" },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
];

// Moneda predeterminada
export const defaultCurrency: Currency = availableCurrencies[0]; // USD

// Función para formatear valores monetarios según la moneda seleccionada
export function formatCurrency(
  amount: number,
  currencyCode: string = "USD"
): string {
  const currency =
    availableCurrencies.find((c) => c.code === currencyCode) || defaultCurrency;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Función para obtener solo el símbolo de una moneda
export function getCurrencySymbol(currencyCode: string = "USD"): string {
  const currency =
    availableCurrencies.find((c) => c.code === currencyCode) || defaultCurrency;
  return currency.symbol;
}
