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
export { LiveStockCard, type LiveStockCardProps } from "./components/LiveStockCard/LiveStockCard";
export { StrategyCard, type StrategyCardProps } from "./components/StrategyCard/StrategyCard";
export {
  StrategyStatsList,
  type StrategyStatsListProps,
} from "./components/StrategyCard/StrategyStatsList";
export { useThemeColors } from "./lib/useThemeColors";
export {
  UnavailableDataTable,
  type UnavailableDataTableProps,
} from "./components/UnavailableDataTable/UnavailableDataTable";
export {
  TradeTimeline,
  type TradeTimelineClock,
  type TradeTimelineProps,
} from "./components/TradeTimeline/TradeTimeline";
export { heldTime } from "./components/TradeTimeline/heldTime";
