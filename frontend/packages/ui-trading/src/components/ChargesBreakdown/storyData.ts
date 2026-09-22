import type { Charges } from "@nova/contracts";

export const deliveryCharges: Charges = {
  brokeragePaise: 2000,
  sttPaise: 10000,
  exchangeTxnPaise: 345,
  sebiFeePaise: 10,
  stampDutyPaise: 1500,
  gstPaise: 422,
  dpPaise: 1593,
  totalPaise: 15870,
};

export const intradayCharges: Charges = {
  brokeragePaise: 4000,
  sttPaise: 2500,
  exchangeTxnPaise: 700,
  sebiFeePaise: 20,
  stampDutyPaise: 300,
  gstPaise: 850,
  dpPaise: 0,
  totalPaise: 8370,
};
