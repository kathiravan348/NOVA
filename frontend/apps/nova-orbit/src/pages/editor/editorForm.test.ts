import { describe, expect, it } from "vitest";
import { mockStrategies } from "@nova/mocks";
import { EditorFormSchema, emptyForm, fromSpec, toSpec, type EditorForm } from "./editorForm";

const issuesOf = (form: EditorForm) => {
  const result = EditorFormSchema.safeParse(form);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
};

const validForm = (): EditorForm => ({
  ...emptyForm(),
  name: "Test",
  symbols: "reliance, tcs ,",
  qty: "10",
});

describe("editorForm", () => {
  it("round-trips every mock spec, visual and python", () => {
    const all = mockStrategies.flatMap((s) => s.versions.map((v) => ({ s, spec: v.spec })));
    expect(all.some(({ spec }) => spec.mode === "python")).toBe(true);
    for (const { s, spec } of all) {
      const form = fromSpec(s.name, s.description, spec);
      expect(issuesOf(form)).toEqual([]);
      expect(toSpec(form)).toEqual(spec);
    }
  });

  it("builds each sizing type", () => {
    const base = validForm();
    expect(toSpec(base).sizing).toEqual({ type: "fixed_qty", qty: 10 });
    expect(toSpec({ ...base, sizingType: "fixed_amount", amountRupees: "25000.5" }).sizing).toEqual(
      { type: "fixed_amount", amountPaise: 25_000_50 },
    );
    expect(toSpec({ ...base, sizingType: "percent_equity", percent: "12.5" }).sizing).toEqual({
      type: "percent_equity",
      percent: 12.5,
    });
  });

  it("cleans symbols and maps empty risk to null", () => {
    const spec = toSpec(validForm());
    expect(spec.universe).toEqual({ type: "symbols", symbols: ["RELIANCE", "TCS"] });
    expect(spec.risk).toEqual({ stopLossPercent: null, targetPercent: null });
  });

  it("reports invalid fields", () => {
    expect(issuesOf(emptyForm())).toEqual(expect.arrayContaining(["name", "symbols", "qty"]));
    const bad = validForm();
    bad.sizingType = "percent_equity";
    bad.percent = "120";
    bad.stopLossPercent = "-1";
    bad.entry.conditions[0]!.right = { ...bad.entry.conditions[0]!.right, period: "2.5" };
    bad.exit.conditions[0]!.left = { ...bad.exit.conditions[0]!.left, kind: "number", value: "x" };
    expect(issuesOf(bad)).toEqual(
      expect.arrayContaining([
        "percent",
        "stopLossPercent",
        "entry.conditions.0.right.period",
        "exit.conditions.0.left.value",
      ]),
    );
  });

  it("drops the period for VWAP", () => {
    const form = validForm();
    form.entry.conditions[0]!.right = { ...form.entry.conditions[0]!.right, name: "vwap" };
    const spec = toSpec(form);
    expect(spec.mode === "visual" && spec.entry.conditions[0]!.right).toEqual({
      kind: "indicator",
      name: "vwap",
      params: {},
    });
  });

  it("requires code only in python mode and skips rule checks there", () => {
    const form = validForm();
    form.entry.conditions[0]!.right = { ...form.entry.conditions[0]!.right, period: "" };
    expect(issuesOf(form)).toEqual(["entry.conditions.0.right.period"]);
    const python = { ...form, mode: "python" as const };
    expect(issuesOf(python)).toEqual(["code"]);
    const spec = toSpec({ ...python, code: "def on_bar(ctx):\n    return []\n" });
    expect(spec.mode).toBe("python");
    expect(spec).not.toHaveProperty("entry");
  });
});
