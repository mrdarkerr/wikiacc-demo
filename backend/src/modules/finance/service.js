const DAY = 86400000;
export const TIME_ZONE = "Asia/Tehran";
const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
export function dateKey(value) {
  const parts = Object.fromEntries(localDate.formatToParts(value).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function shiftDate(key, days) {
  return new Date(Date.parse(`${key}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}
// Convert Tehran calendar midnight to UTC using the historical IANA offset,
// including pre-2023 daylight saving. No dependency on the server/browser TZ.
export function midnight(key) {
  const target = Date.parse(`${key}T00:00:00Z`);
  let value = target;
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(formatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
    value += target - Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
  }
  return new Date(value);
}
function weekStart(key) {
  return shiftDate(key, -((new Date(`${key}T12:00:00Z`).getUTCDay() + 1) % 7));
}
const eligible = { paymentStatus: "PAID", status: { notIn: ["CANCELLED", "REFUNDED"] } };
const select = { totalAmount: true, createdAt: true, items: { select: { totalProfitSnapshot: true } } };
export function emptyTotals() {
  return { turnover: 0, profit: null, orderCount: 0, knownProfitItemCount: 0, unknownProfitItemCount: 0 };
}
function addOrder(totals, order) {
  totals.turnover += order.totalAmount;
  totals.orderCount++;
  for (const item of order.items) {
    if (item.totalProfitSnapshot === null) totals.unknownProfitItemCount++;
    else { totals.knownProfitItemCount++; totals.profit = (totals.profit ?? 0) + item.totalProfitSnapshot; }
  }
}
const context = { currency: "TOMAN", timeZone: TIME_ZONE, dateBasis: "ORDER_CREATED_AT", profitBasis: "FROZEN_PRODUCT_MARGIN_BEFORE_FEES" };
export async function history(prisma, { interval = "daily", page = 1 } = {}, now = new Date()) {
  const step = interval === "weekly" ? 7 : 1;
  const pageSize = interval === "weekly" ? 8 : 7;
  const today = dateKey(now);
  const anchor = interval === "weekly" ? weekStart(today) : today;
  const first = await prisma.order.findFirst({ where: eligible, orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  const oldestKey = first ? dateKey(first.createdAt) : anchor;
  const oldest = interval === "weekly" ? weekStart(oldestKey) : oldestKey;
  const totalPeriods = Math.max(1, Math.round((Date.parse(`${anchor}T12:00:00Z`) - Date.parse(`${oldest}T12:00:00Z`)) / DAY / step) + 1);
  const totalPages = Math.ceil(totalPeriods / pageSize);
  page = Math.min(page, totalPages);
  const startDate = shiftDate(anchor, -((page - 1) * pageSize + pageSize - 1) * step);
  const endDateExclusive = shiftDate(startDate, pageSize * step);
  const points = Array.from({ length: pageSize }, (_, i) => {
    const start = shiftDate(startDate, i * step);
    return { startDate: start, endDate: shiftDate(start, step - 1), isPartial: shiftDate(start, step) > today, ...emptyTotals() };
  });
  const orders = await prisma.order.findMany({ where: { ...eligible, createdAt: { gte: midnight(startDate), lt: midnight(endDateExclusive), lte: now } }, select });
  const totals = emptyTotals();
  for (const order of orders) {
    const key = interval === "weekly" ? weekStart(dateKey(order.createdAt)) : dateKey(order.createdAt);
    const point = points.find((p) => p.startDate === key);
    if (point) { addOrder(point, order); addOrder(totals, order); }
  }
  return { ...context, interval, generatedAt: now.toISOString(), range: { startDate, endDate: shiftDate(endDateExclusive, -1) },
    pagination: { page, pageSize, totalPages, hasOlder: page < totalPages, hasNewer: page > 1 }, totals, points };
}
export async function forecast(prisma, now = new Date()) {
  const today = dateKey(now);
  const startDate = shiftDate(today, -28);
  const orders = await prisma.order.findMany({ where: { ...eligible, createdAt: { gte: midnight(startDate), lt: midnight(today) } }, select });
  const totals = emptyTotals();
  for (const order of orders) addOrder(totals, order);
  const first = await prisma.order.findFirst({ where: { ...eligible, createdAt: { lt: midnight(today) } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  const observedDays = first ? Math.min(28, Math.max(0, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${dateKey(first.createdAt)}T12:00:00Z`)) / DAY))) : 0;
  const sufficient = observedDays >= 7 && totals.orderCount >= 3;
  return { ...context, generatedAt: now.toISOString(), method: "TRAILING_DAILY_AVERAGE", status: sufficient ? "READY" : "INSUFFICIENT_DATA",
    sample: { startDate: observedDays ? shiftDate(today, -observedDays) : startDate, endDate: shiftDate(today, -1), observedDays, ...totals },
    horizons: [7, 30].map((days) => ({ days, startDate: shiftDate(today, 1), endDate: shiftDate(today, days),
      turnover: sufficient ? Math.round(totals.turnover / observedDays * days) : null,
      profit: sufficient && totals.knownProfitItemCount > 0 && totals.unknownProfitItemCount === 0 ? Math.round(totals.profit / observedDays * days) : null })) };
}
