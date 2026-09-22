const MINUS = "\u2212";

export interface FormatInrOptions {
  decimals?: number;
  signed?: boolean;
}

export function formatInr(paise: number, options: FormatInrOptions = {}): string {
  const { decimals = 2, signed = false } = options;

  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);

  let rupees: number;
  if (decimals === 0) {
    rupees = Math.round(absPaise / 100);
  } else {
    rupees = absPaise / 100;
  }

  // Check if rounded rupee value is strictly zero
  const isZero = rupees === 0 || Number(rupees.toFixed(decimals)) === 0;

  const formattedNumber = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(rupees);

  let prefix: string;
  if (isNegative && !isZero) {
    prefix = `${MINUS}₹`;
  } else if (signed && paise > 0 && !isZero) {
    prefix = "+₹";
  } else {
    prefix = "₹";
  }

  return `${prefix}${formattedNumber}`;
}

export function formatPrice(paise: number): string {
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = absPaise / 100;
  const isZero = rupees === 0 || Number(rupees.toFixed(2)) === 0;

  const formattedNumber = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);

  const prefix = isNegative && !isZero ? MINUS : "";
  return `${prefix}${formattedNumber}`;
}

export interface FormatPercentOptions {
  decimals?: number;
  signed?: boolean;
}

export function formatPercent(value: number, options: FormatPercentOptions = {}): string {
  const { decimals = 2, signed = false } = options;

  const isNegative = value < 0;
  const absValue = Math.abs(value);
  const isZero = absValue === 0 || Number(absValue.toFixed(decimals)) === 0;

  const formattedNumber = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(absValue);

  let prefix = "";
  if (isNegative && !isZero) {
    prefix = MINUS;
  } else if (signed && value > 0 && !isZero) {
    prefix = "+";
  }

  return `${prefix}${formattedNumber}%`;
}

export function formatQuantity(n: number): string {
  const isNegative = n < 0;
  const absN = Math.abs(n);
  const formatted = new Intl.NumberFormat("en-IN").format(absN);
  const prefix = isNegative && absN !== 0 ? MINUS : "";
  return `${prefix}${formatted}`;
}
