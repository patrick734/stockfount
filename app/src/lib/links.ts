// $FOUNT trades on the Pons launchpad, whose token pages are /launchpad/<address>. NEXT_PUBLIC_FOUNT_TRADE_URL overrides.
export const tradeUrl = (token?: string) =>
  process.env.NEXT_PUBLIC_FOUNT_TRADE_URL || `https://www.ponsfamily.com/launchpad${token ? `/${token}` : ""}`;
// The $FOUNT token on Pons. The burn uses whatever DrawdownRetire holds on-chain; this is for display and trading links.
export const FOUNT_CA = (process.env.NEXT_PUBLIC_FOUNT_CA || "0x4dafdc67fde1ae73905fc82dd345807b89951709") as `0x${string}`;
