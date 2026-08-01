export const IRANPAYAMAK_PROVIDER = "IRANPAYAMAK";
export const IRANPAYAMAK_PATTERN_ENDPOINT =
  "https://api.iranpayamak.com/ws/v1/sms/pattern";
export const SMS_SETTINGS_ID = "iranpayamak";
export const DEFAULT_AUTH_PATTERN_CODE = "a5gPP4cwpS";
export const DEFAULT_TICKET_ANSWERED_PATTERN_CODE = "ojtukzfpWZ";
export const DEFAULT_TICKET_CREATED_PATTERN_CODE = "6bZHqMLbrY";
export const DEFAULT_ADMIN_TICKET_ACTIVITY_PATTERN_CODE = "bvDXpCSNbU";
export const DEFAULT_ORDER_CREATED_PATTERN_CODE = "DBh0eWEV0p";
export const DEFAULT_ORDER_COMPLETED_PATTERN_CODE = "d8RdZIfeIs";

export const SMS_NOTIFICATION_EVENTS = Object.freeze({
  ADMIN_TICKET_ACTIVITY: "ADMIN_TICKET_ACTIVITY",
  ORDER_COMPLETED: "ORDER_COMPLETED",
  ORDER_CREATED: "ORDER_CREATED",
  TICKET_ANSWERED: "TICKET_ANSWERED",
  TICKET_CREATED: "TICKET_CREATED",
});

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
