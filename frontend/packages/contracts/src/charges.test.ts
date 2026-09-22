import { describe, expect, it } from "vitest";
import { Charges, ChargesSchema } from "./charges";

describe("ChargesSchema", () => {
  const validCharges: Charges = {
    brokeragePaise: 2000,
    sttPaise: 1250,
    exchangeTxnPaise: 350,
    sebiFeePaise: 10,
    stampDutyPaise: 300,
    gstPaise: 425,
    dpPaise: 1550,
    totalPaise: 5885,
  };

  it("accepts a valid charges object where total matches sum", () => {
    expect(ChargesSchema.safeParse(validCharges).success).toBe(true);
  });

  it("rejects when totalPaise does not equal sum of parts", () => {
    const invalid = { ...validCharges, totalPaise: 5880 };
    expect(ChargesSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects negative charge values", () => {
    const invalid = { ...validCharges, brokeragePaise: -100 };
    expect(ChargesSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects floating point values for paise", () => {
    const invalid = { ...validCharges, brokeragePaise: 20.5 };
    expect(ChargesSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects extra keys due to strictObject", () => {
    expect(ChargesSchema.safeParse({ ...validCharges, extra: 0 }).success).toBe(false);
  });
});
