import { describe, expect, it } from "vitest";
import { mockStrategies } from "@nova/mocks";
import type { StrategySpec } from "@nova/contracts";
import { EditorFormSchema, emptyForm, fromSpec, toSpec, type EditorForm } from "./editorForm";

type EditableSpec = Exclude<StrategySpec, { mode: "rotation" }>;

const turtle = (): EditableSpec => {
  const s = mockStrategies.find((m) => m.id === "stg_004")!;
  const spec = s.versions.find((v) => v.version === s.latestVersion)!.spec;
  if (spec.mode === "rotation") throw new Error("stg_004 is a visual mock");
  return spec;
};

const issuesOf = (form: EditorForm) => {
  const result = EditorFormSchema.safeParse(form);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

/** The spec of a visual or Python form (rotation specs have no sizing or portfolio). */
const ruleSpec = (form: EditorForm) => {
  const spec = toSpec(form);
  if (spec.mode === "rotation") throw new Error("expected a visual or Python spec");
  return spec;
};

describe("D62 editor fields (NOVA-118)", () => {
  it("round-trips the ranked Turtle mock and its multiplier", () => {
    const form = fromSpec("Turtle", "", turtle());
    expect(form.regimeOn && form.rankOn && form.atrOn).toBe(true);
    expect(form.entry.conditions[1]!.right.multiplier).toBe("1.5");
    expect(toSpec(form)).toEqual(turtle());
  });

  it("removes a setting when its field is cleared or switched off", () => {
    const form: EditorForm = {
      ...fromSpec("Turtle", "", turtle()),
      trailingStopPercent: "",
      atrOn: false,
      maxHoldBars: "",
      regimeOn: false,
      rankOn: false,
    };
    const spec = ruleSpec(form);
    expect(spec.risk).toEqual({ stopLossPercent: 10, targetPercent: null });
    expect(spec.portfolio).toEqual({ maxPositions: 10 });
    expect("regime" in spec).toBe(false);
    expect(ruleSpec({ ...form, maxPositions: "" }).portfolio).toBeUndefined();
  });

  it("writes × only when it is neither empty nor 1", () => {
    const form = fromSpec("Turtle", "", turtle());
    const condition = form.entry.conditions[1]!;
    const rightOf = (multiplier: string) => {
      const right = { ...condition.right, multiplier };
      const spec = toSpec({
        ...form,
        entry: { ...form.entry, conditions: [{ ...condition, right }] },
      });
      return spec.mode === "visual" ? spec.entry.conditions[0]!.right : undefined;
    };
    expect(rightOf("")).not.toHaveProperty("multiplier");
    expect(rightOf("1")).not.toHaveProperty("multiplier");
    expect(rightOf("2")).toHaveProperty("multiplier", 2);
  });

  it("reports each out-of-range field", () => {
    const base: EditorForm = { ...emptyForm(), name: "T", qty: "1" };
    expect(
      issuesOf({
        ...base,
        trailingStopPercent: "51",
        atrOn: true,
        atrPeriod: "1.5",
        atrMultiplier: "0",
        maxHoldBars: "5001",
        maxPositions: "0",
      }),
    ).toEqual([
      "trailingStopPercent: Leave empty, or above 0 and at most 50",
      "atrPeriod: Whole number above 0",
      "atrMultiplier: Number above 0",
      "maxHoldBars: Leave empty or a whole number from 1 to 5000",
      "maxPositions: Leave empty or a whole number from 1 to 100",
    ]);
    const ranked = { ...base, maxPositions: "5", rankOn: true };
    expect(issuesOf({ ...ranked, rank: { ...ranked.rank, multiplier: "-2" } })).toEqual([
      "rank.multiplier: Leave empty or above 0",
    ]);
    const regime = { ...base.regime, right: { ...base.regime.right, params: { period: "0" } } };
    expect(issuesOf({ ...base, regimeOn: true, regimeIndex: "", regime })).toEqual([
      "regimeIndex: Choose an index",
      "regime.right.params.period: Whole number above 0",
    ]);
  });
});
