import { z } from "zod";
import { NonNegPaiseSchema } from "./common";

export const ChargesSchema = z
  .strictObject({
    brokeragePaise: NonNegPaiseSchema,
    sttPaise: NonNegPaiseSchema,
    exchangeTxnPaise: NonNegPaiseSchema,
    sebiFeePaise: NonNegPaiseSchema,
    stampDutyPaise: NonNegPaiseSchema,
    gstPaise: NonNegPaiseSchema,
    dpPaise: NonNegPaiseSchema,
    totalPaise: NonNegPaiseSchema,
  })
  .refine(
    (data) =>
      data.totalPaise ===
      data.brokeragePaise +
        data.sttPaise +
        data.exchangeTxnPaise +
        data.sebiFeePaise +
        data.stampDutyPaise +
        data.gstPaise +
        data.dpPaise,
    {
      message: "totalPaise must equal the sum of individual charges",
      path: ["totalPaise"],
    }
  );

export type Charges = z.infer<typeof ChargesSchema>;
