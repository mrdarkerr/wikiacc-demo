export const IRANPAYAMAK_PROVIDER = "IRANPAYAMAK";
export const IRANPAYAMAK_PATTERN_ENDPOINT =
  "https://api.iranpayamak.com/ws/v1/sms/pattern";
export const SMS_SETTINGS_ID = "iranpayamak";

export const DEFAULT_SMS_SENDERS = Object.freeze([
  {
    id: "iranpayamak-main-line",
    label: "خط اصلی",
    lineNumber: "50002178584000",
    sortOrder: 0,
  },
  {
    id: "iranpayamak-pro-line",
    label: "خط خدماتی PRO",
    lineNumber: "PRO",
    sortOrder: 1,
  },
]);
