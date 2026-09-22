import { describe, expect, it } from "vitest";
import {
  ExchangeSchema,
  IdSchema,
  IsoDateSchema,
  NonNegPaiseSchema,
  PaiseSchema,
  SegmentSchema,
  SideSchema,
  TimeframeSchema,
  UtcDateTimeSchema,
} from "./common";

describe("common schemas", () => {
  it("validates IdSchema", () => {
    expect(IdSchema.safeParse("user-1").success).toBe(true);
    expect(IdSchema.safeParse("").success).toBe(false);
  });

  it("validates UtcDateTimeSchema", () => {
    expect(UtcDateTimeSchema.safeParse("2026-09-22T10:00:00Z").success).toBe(true);
    // Non-UTC timezone offset rejected
    expect(UtcDateTimeSchema.safeParse("2026-09-22T10:00:00+05:30").success).toBe(false);
    expect(UtcDateTimeSchema.safeParse("invalid-datetime").success).toBe(false);
  });

  it("validates IsoDateSchema", () => {
    expect(IsoDateSchema.safeParse("2026-09-22").success).toBe(true);
    expect(IsoDateSchema.safeParse("2026-02-31").success).toBe(false);
    expect(IsoDateSchema.safeParse("22-09-2026").success).toBe(false);
  });

  it("validates PaiseSchema", () => {
    expect(PaiseSchema.safeParse(161890).success).toBe(true);
    expect(PaiseSchema.safeParse(-500).success).toBe(true);
    expect(PaiseSchema.safeParse(12.34).success).toBe(false);
  });

  it("validates NonNegPaiseSchema", () => {
    expect(NonNegPaiseSchema.safeParse(0).success).toBe(true);
    expect(NonNegPaiseSchema.safeParse(100).success).toBe(true);
    expect(NonNegPaiseSchema.safeParse(-1).success).toBe(false);
    expect(NonNegPaiseSchema.safeParse(1.5).success).toBe(false);
  });

  it("validates SegmentSchema", () => {
    expect(SegmentSchema.safeParse("equity_delivery").success).toBe(true);
    expect(SegmentSchema.safeParse("crypto").success).toBe(false);
  });

  it("validates ExchangeSchema", () => {
    expect(ExchangeSchema.safeParse("NSE").success).toBe(true);
    expect(ExchangeSchema.safeParse("BSE").success).toBe(false);
  });

  it("validates TimeframeSchema", () => {
    expect(TimeframeSchema.safeParse("15m").success).toBe(true);
    expect(TimeframeSchema.safeParse("2h").success).toBe(false);
  });

  it("validates SideSchema", () => {
    expect(SideSchema.safeParse("buy").success).toBe(true);
    expect(SideSchema.safeParse("hold").success).toBe(false);
  });
});
