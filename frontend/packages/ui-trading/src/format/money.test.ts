import { describe, expect, it } from "vitest";
import { formatInr, formatPercent, formatPrice, formatQuantity } from "./money";

describe("money formatters", () => {
  describe("formatInr", () => {
    it("formats paise to Indian-grouped rupee string with default 2 decimals", () => {
      expect(formatInr(50000000)).toBe("₹5,00,000.00");
    });

    it("formats paise with 0 decimals rounded half away from zero", () => {
      expect(formatInr(50000000, { decimals: 0 })).toBe("₹5,00,000");
      expect(formatInr(50000049, { decimals: 0 })).toBe("₹5,00,000");
      expect(formatInr(50000050, { decimals: 0 })).toBe("₹5,00,001");
    });

    it("includes explicit positive sign when signed is true", () => {
      expect(formatInr(9824400, { signed: true })).toBe("+₹98,244.00");
    });

    it("always formats negative values with real minus sign even when signed is false", () => {
      expect(formatInr(-1423600)).toBe("−₹14,236.00");
      expect(formatInr(-1423600, { signed: true })).toBe("−₹14,236.00");
    });

    it("formats zero without signs", () => {
      expect(formatInr(0)).toBe("₹0.00");
      expect(formatInr(0, { signed: true })).toBe("₹0.00");
      expect(formatInr(0, { decimals: 0 })).toBe("₹0");
    });

    it("formats crore values with correct Indian comma grouping", () => {
      expect(formatInr(1234567890)).toBe("₹1,23,45,678.90");
    });

    it("formats 1-paise values correctly", () => {
      expect(formatInr(1)).toBe("₹0.01");
      expect(formatInr(-1)).toBe("−₹0.01");
    });
  });

  describe("formatPrice", () => {
    it("formats paise as price with 2 decimals and no currency symbol", () => {
      expect(formatPrice(161890)).toBe("1,618.90");
      expect(formatPrice(50000000)).toBe("5,00,000.00");
      expect(formatPrice(-161890)).toBe("−1,618.90");
    });
  });

  describe("formatPercent", () => {
    it("formats percentage with rounding", () => {
      expect(formatPercent(12.345)).toBe("12.35%");
    });

    it("formats signed percentages with explicit plus and real minus sign", () => {
      expect(formatPercent(-0.11, { signed: true })).toBe("−0.11%");
      expect(formatPercent(1.5, { signed: true })).toBe("+1.50%");
      expect(formatPercent(0, { signed: true })).toBe("0.00%");
      expect(formatPercent(-0, { signed: true })).toBe("0.00%");
    });
  });

  describe("formatQuantity", () => {
    it("formats quantity with Indian digit grouping", () => {
      expect(formatQuantity(150000)).toBe("1,50,000");
      expect(formatQuantity(10000000)).toBe("1,00,00,000");
      expect(formatQuantity(50)).toBe("50");
    });
  });
});
