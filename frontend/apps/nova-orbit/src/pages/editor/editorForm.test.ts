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

  it("maps empty risk to null and has no universe (D25)", () => {
    const spec = toSpec(validForm());
    expect(spec).not.toHaveProperty("universe");
    expect(spec.risk).toEqual({ stopLossPercent: null, targetPercent: null });
  });

  it("reports invalid fields", () => {
    expect(issuesOf(emptyForm())).toEqual(expect.arrayContaining(["name", "qty"]));
    const bad = validForm();
    bad.sizingType = "percent_equity";
    bad.percent = "120";
    bad.stopLossPercent = "-1";
    bad.entry.conditions[0]!.right = {
      ...bad.entry.conditions[0]!.right,
      params: { period: "2.5" },
    };
    bad.exit.conditions[0]!.left = { ...bad.exit.conditions[0]!.left, kind: "number", value: "x" };
    expect(issuesOf(bad)).toEqual(
      expect.arrayContaining([
        "percent",
        "stopLossPercent",
        "entry.conditions.0.right.params.period",
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
    form.entry.conditions[0]!.right = {
      ...form.entry.conditions[0]!.right,
      params: { period: "" },
    };
    expect(issuesOf(form)).toEqual(["entry.conditions.0.right.params.period"]);
    const python = { ...form, mode: "python" as const };
    expect(issuesOf(python)).toEqual(["code"]);
    const spec = toSpec({ ...python, code: "def on_bar(ctx):\n    return []\n" });
    expect(spec.mode).toBe("python");
    expect(spec).not.toHaveProperty("entry");
  });

  it("loads an old MACD {period} as the catalog defaults and saves {fast, slow} (D51)", () => {
    const [mock] = mockStrategies.filter((m) => m.versions.some((v) => v.spec.mode === "visual"));
    const spec = mock!.versions.find((v) => v.spec.mode === "visual")!.spec;
    if (spec.mode !== "visual") throw new Error("visual spec expected");
    const old = {
      ...spec,
      entry: {
        ...spec.entry,
        conditions: [
          {
            ...spec.entry.conditions[0]!,
            left: { kind: "indicator" as const, name: "macd" as const, params: { period: 20 } },
          },
        ],
      },
    };
    const form = fromSpec("M", "", old);
    expect(form.entry.conditions[0]!.left.params).toEqual({ fast: "12", slow: "26" });
    const saved = toSpec(form);
    expect(saved.mode === "visual" && saved.entry.conditions[0]!.left).toEqual({
      kind: "indicator",
      name: "macd",
      params: { fast: 12, slow: 26 },
    });
  });

  it("checks each catalog setting and fast < slow", () => {
    const form = validForm();
    const right = form.entry.conditions[0]!.right;
    form.entry.conditions[0]!.right = {
      ...right,
      name: "macd_signal",
      params: { fast: "30", slow: "26", signal: "0" },
    };
    expect(issuesOf(form)).toEqual([
      "entry.conditions.0.right.params.signal",
      "entry.conditions.0.right.params.fast",
    ]);
    form.entry.conditions[0]!.right = {
      ...right,
      name: "psar",
      params: { step: "0.5", max: "-1" },
    };
    expect(issuesOf(form)).toEqual(["entry.conditions.0.right.params.max"]);
  });

  it("writes bars ago only when above 0 and checks it", () => {
    const form = validForm();
    form.entry.conditions[0]!.left = {
      ...form.entry.conditions[0]!.left,
      field: "high",
      offset: "1",
    };
    const spec = toSpec(form);
    expect(spec.mode === "visual" && spec.entry.conditions[0]!.left).toEqual({
      kind: "price",
      field: "high",
      offset: 1,
    });
    expect(spec.mode === "visual" && spec.entry.conditions[0]!.right).not.toHaveProperty("offset");
    for (const offset of ["-1", "2.5", "501"]) {
      form.entry.conditions[0]!.left = { ...form.entry.conditions[0]!.left, offset };
      expect(issuesOf(form)).toEqual(["entry.conditions.0.left.offset"]);
    }
  });
});
