import { z } from "zod";

/** Indicator catalog (D51): one definition for the editor, validation, the engine and Python mode. */
export const IndicatorGroupSchema = z.enum(["trend", "momentum", "volatility", "volume", "levels"]);
export type IndicatorGroup = z.infer<typeof IndicatorGroupSchema>;

export interface IndicatorParam {
  readonly key: string;
  readonly label: string;
  readonly default: number;
  /** Whole number ≥ 1 when true; any number > 0 when false. */
  readonly integer: boolean;
}

export interface IndicatorDef {
  readonly name: string;
  readonly label: string;
  readonly group: IndicatorGroup;
  readonly params: readonly IndicatorParam[];
}

const int = (key: string, label: string, value: number): IndicatorParam => ({
  key,
  label,
  default: value,
  integer: true,
});
const dec = (key: string, label: string, value: number): IndicatorParam => ({
  key,
  label,
  default: value,
  integer: false,
});
const period = (value: number) => int("period", "Period", value);
const fast = int("fast", "Fast", 12);
const slow = int("slow", "Slow", 26);
const signal = (value: number) => int("signal", "Signal", value);
const bollinger = [period(20), dec("stddev", "Std dev", 2)];
const keltner = [
  period(20),
  dec("multiplier", "Multiplier", 2),
  int("atr_period", "ATR period", 10),
];

export const INDICATORS = [
  // Trend
  { name: "sma", label: "SMA", group: "trend", params: [period(20)] },
  { name: "ema", label: "EMA", group: "trend", params: [period(20)] },
  { name: "wma", label: "WMA", group: "trend", params: [period(20)] },
  { name: "macd", label: "MACD line", group: "trend", params: [fast, slow] },
  { name: "macd_signal", label: "MACD signal", group: "trend", params: [fast, slow, signal(9)] },
  { name: "macd_hist", label: "MACD histogram", group: "trend", params: [fast, slow, signal(9)] },
  {
    name: "supertrend",
    label: "SuperTrend",
    group: "trend",
    params: [period(10), dec("multiplier", "Multiplier", 3)],
  },
  { name: "adx", label: "ADX", group: "trend", params: [period(14)] },
  { name: "plus_di", label: "+DI", group: "trend", params: [period(14)] },
  { name: "minus_di", label: "−DI", group: "trend", params: [period(14)] },
  {
    name: "psar",
    label: "Parabolic SAR",
    group: "trend",
    params: [dec("step", "Step", 0.02), dec("max", "Max", 0.2)],
  },
  // Momentum
  { name: "rsi", label: "RSI", group: "momentum", params: [period(14)] },
  {
    name: "stoch_k",
    label: "Stochastic %K",
    group: "momentum",
    params: [period(14), int("smooth", "Smooth", 3)],
  },
  {
    name: "stoch_d",
    label: "Stochastic %D",
    group: "momentum",
    params: [period(14), int("smooth", "Smooth", 3), signal(3)],
  },
  {
    name: "stoch_rsi",
    label: "Stochastic RSI",
    group: "momentum",
    params: [int("rsi_period", "RSI period", 14), period(14)],
  },
  { name: "cci", label: "CCI", group: "momentum", params: [period(20)] },
  { name: "williams_r", label: "Williams %R", group: "momentum", params: [period(14)] },
  { name: "roc", label: "Rate of change %", group: "momentum", params: [period(12)] },
  // Volatility
  { name: "atr", label: "ATR", group: "volatility", params: [period(14)] },
  { name: "bb_upper", label: "Bollinger upper", group: "volatility", params: bollinger },
  { name: "bb_middle", label: "Bollinger middle", group: "volatility", params: bollinger },
  { name: "bb_lower", label: "Bollinger lower", group: "volatility", params: bollinger },
  { name: "keltner_upper", label: "Keltner upper", group: "volatility", params: keltner },
  { name: "keltner_lower", label: "Keltner lower", group: "volatility", params: keltner },
  { name: "donchian_upper", label: "Highest high", group: "volatility", params: [period(20)] },
  { name: "donchian_lower", label: "Lowest low", group: "volatility", params: [period(20)] },
  // Volume
  { name: "vwap", label: "VWAP", group: "volume", params: [] },
  { name: "obv", label: "OBV", group: "volume", params: [] },
  { name: "mfi", label: "MFI", group: "volume", params: [period(14)] },
  { name: "volume_sma", label: "Volume SMA", group: "volume", params: [period(20)] },
  // Levels (previous IST day)
  { name: "prev_day_high", label: "Previous day high", group: "levels", params: [] },
  { name: "prev_day_low", label: "Previous day low", group: "levels", params: [] },
  { name: "prev_day_close", label: "Previous day close", group: "levels", params: [] },
  { name: "pivot", label: "Pivot", group: "levels", params: [] },
  { name: "pivot_r1", label: "Pivot R1", group: "levels", params: [] },
  { name: "pivot_s1", label: "Pivot S1", group: "levels", params: [] },
  { name: "pivot_r2", label: "Pivot R2", group: "levels", params: [] },
  { name: "pivot_s2", label: "Pivot S2", group: "levels", params: [] },
] as const satisfies readonly IndicatorDef[];

export type IndicatorName = (typeof INDICATORS)[number]["name"];
export const IndicatorNameSchema = z.enum(
  INDICATORS.map((i) => i.name) as [IndicatorName, ...IndicatorName[]],
);

const BY_NAME = new Map<string, IndicatorDef>(INDICATORS.map((i) => [i.name, i]));

export function indicatorDef(name: string): IndicatorDef | undefined {
  return BY_NAME.get(name);
}

/** Problems with an indicator's settings (empty = fine). Missing keys are fine: the engine uses defaults. */
export function checkIndicatorParams(name: string, params: Record<string, number>): string[] {
  const def = BY_NAME.get(name);
  if (!def) return [`Unknown indicator '${name}'`];
  const problems: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    const param = def.params.find((p) => p.key === key);
    if (!param) {
      problems.push(`Unknown setting '${key}' for ${def.label}`);
    } else if (param.integer ? !Number.isInteger(value) || value < 1 : !(value > 0)) {
      problems.push(
        `${def.label} ${param.label.toLowerCase()} must be ${param.integer ? "a whole number of at least 1" : "above 0"}`,
      );
    }
  }
  const f = params["fast"] ?? def.params.find((p) => p.key === "fast")?.default;
  const s = params["slow"] ?? def.params.find((p) => p.key === "slow")?.default;
  if (f !== undefined && s !== undefined && f >= s) {
    problems.push(`${def.label} fast must be less than slow`);
  }
  return problems;
}
