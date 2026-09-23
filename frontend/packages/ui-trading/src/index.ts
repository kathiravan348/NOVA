export const UI_TRADING_NAME = "@nova/ui-trading";

// Money and Number Formatters
export {
  formatInr,
  formatInrCompact,
  formatPrice,
  formatPercent,
  formatQuantity,
  type FormatInrOptions,
  type FormatPercentOptions,
} from "./format/money";

// Trading Components
export { PriceText, type PriceTextProps } from "./components/PriceText/PriceText";
export { PnLText, type PnLTextProps } from "./components/PnLText/PnLText";
export { PnLCard, type PnLCardProps } from "./components/PnLCard/PnLCard";
export {
  ChargesBreakdown,
  type ChargesBreakdownProps,
} from "./components/ChargesBreakdown/ChargesBreakdown";
export { Meter, type MeterProps } from "./components/Meter/Meter";
export { EquityCurve, type EquityCurveProps } from "./components/EquityCurve/EquityCurve";
export {
  CandlestickChart,
  type CandlestickChartProps,
} from "./components/CandlestickChart/CandlestickChart";
export type { Candle } from "./components/CandlestickChart/types";
export { useThemeColors } from "./lib/useThemeColors";
