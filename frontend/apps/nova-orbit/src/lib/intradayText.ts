import type { BuyingRule, IntradaySetup } from "@nova/contracts";

/** Setup names in plain words (D84, `docs/INTRADAY-RESEARCH.md` §3). */
export const setupLabel: Record<IntradaySetup["kind"], string> = {
  opening_range_retest: "Opening range retest",
  prev_day_high_retest: "Previous day high retest",
  inside_bar_continuation: "Inside bar continuation",
  vwap_trend_pullback: "VWAP trend pullback",
  failed_breakout_reclaim: "Failed breakout reclaim",
};

/** Buying rule names in plain words (D84, §4). */
export const buyingLabel: Record<BuyingRule["kind"], string> = {
  single: "Single entry",
  average_on_recovery: "Average on recovery",
  add_to_winner: "Add to winner",
};

const bars = (n: number) => `${n} bar${n === 1 ? "" : "s"}`;

/** "opening range retest, 15 min range, retest within 3 bars, 0.1 ATR buffer, target 2R". */
export function describeSetup(setup: IntradaySetup): string {
  const name = setupLabel[setup.kind].toLowerCase().replace("vwap", "VWAP");
  const parts: string[] = [name];
  switch (setup.kind) {
    case "opening_range_retest":
      parts.push(`${setup.rangeMinutes} min range`);
      parts.push(`retest within ${bars(setup.retestBars)}`, `${setup.bufferAtr} ATR buffer`);
      break;
    case "prev_day_high_retest":
      parts.push(`retest within ${bars(setup.retestBars)}`, `${setup.bufferAtr} ATR buffer`);
      break;
    case "inside_bar_continuation":
      parts.push(`breakout within ${bars(setup.expiryBars)}`, `${setup.bufferAtr} ATR buffer`);
      break;
    case "vwap_trend_pullback":
      parts.push(
        `VWAP rising over ${setup.risingBars} 5m bars`,
        `pullback within ${setup.proximityAtr} ATR`,
        `confirm within ${bars(setup.expiryBars)}`,
      );
      break;
    case "failed_breakout_reclaim":
      parts.push(
        `reclaim within ${bars(setup.reclaimBars)}`,
        `at least ${setup.minRewardR}R room`,
        setup.exit === "vwap" ? "exit at VWAP" : "exit at opening range middle",
      );
      return parts.join(", ");
  }
  parts.push(`target ${setup.targetR}R`);
  return parts.join(", ");
}

/** "single entry" or "add to winner, first buy 70%, add after +1R, 1 confirming bar within 5 min". */
export function describeBuying(buying: BuyingRule): string {
  const name = buyingLabel[buying.kind].toLowerCase();
  if (buying.kind === "single") return name;
  const trigger =
    buying.kind === "average_on_recovery"
      ? `add after a ${buying.triggerAtr} ATR fall`
      : `add after +${buying.triggerR}R`;
  const confirm = `${buying.confirmBars} confirming bar${buying.confirmBars === 1 ? "" : "s"}`;
  return `${name}, first buy ${buying.initialPercent}%, ${trigger}, ${confirm} within ${buying.expiryMinutes} min`;
}
