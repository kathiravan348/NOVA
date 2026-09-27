import { describe, expect, it } from "vitest";
import { StrategySpecRotationSchema } from "@nova/contracts";
import { EditorFormSchema, modeDefaults, toSpec, type EditorForm } from "./editorForm";
import { rocTerm } from "./editorFormRotation";

const valid = (): EditorForm => ({ ...modeDefaults("rotation"), name: "Momentum" });

const issuesOf = (form: EditorForm) => {
  const result = EditorFormSchema.safeParse(form);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("rotation form (NOVA-119)", () => {
  it("builds a valid rotation spec from the defaults, without sizing checks", () => {
    const form = valid();
    expect(form.qty).toBe(""); // hidden sizing never blocks a rotation save
    expect(issuesOf(form)).toEqual([]);
    const spec = toSpec(form);
    expect(StrategySpecRotationSchema.parse(spec)).toEqual(spec);
    expect(spec).toMatchObject({
      mode: "rotation",
      segment: "equity_delivery",
      timeframe: "1d",
      rotation: { rebalance: "monthly", hold: 10, keepWithin: 20 },
    });
    expect(spec.mode === "rotation" && spec.rotation).not.toHaveProperty("filter");
  });

  it("refuses keep below hold, 0 or 4 terms, a zero weight and an unfinished filter row", () => {
    expect(issuesOf({ ...valid(), hold: "10", keepWithin: "5" })).toEqual([
      "keepWithin: At least Hold",
    ]);
    expect(issuesOf({ ...valid(), scoreTerms: [] })).toEqual(["scoreTerms: Use 1 to 3 terms"]);
    const four = [rocTerm(), rocTerm(), rocTerm(), rocTerm()];
    expect(issuesOf({ ...valid(), scoreTerms: four })).toEqual(["scoreTerms: Use 1 to 3 terms"]);
    expect(issuesOf({ ...valid(), scoreTerms: [{ ...rocTerm(), weight: "0" }] })).toEqual([
      "scoreTerms.0.weight: A number other than 0",
    ]);
    const form = valid();
    const row = form.filter.conditions[0]!;
    const unfinished = { ...row, right: { ...row.right, params: { period: "" } } };
    expect(
      issuesOf({ ...form, filterOn: true, filter: { ...form.filter, conditions: [unfinished] } }),
    ).toEqual(["filter.conditions.0.right.params.period: Whole number above 0"]);
  });

  it("writes the filter only when it is on, and the default market filter sells everything", () => {
    const form = { ...valid(), filterOn: true, regimeOn: true };
    const spec = toSpec(form);
    expect(spec.mode === "rotation" && spec.rotation.filter?.conditions).toHaveLength(1);
    expect(spec.regime?.whenOff).toBe("exit_all");
  });
});
