import { ApiError } from "./api-error";
import type { AdminProduct, PricingInput } from "../types/api";

export function numericInput(value: string) {
  return value.trim().replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/٫/g, ".").replace(/[٬,]/g, "").replace(/٪/g, "%");
}

export function draftPricing(form: { priceCurrency: PricingInput["priceCurrency"]; basePrice: string; profit: string }): { input: PricingInput | null; error: string } {
  const basePrice = numericInput(form.basePrice);
  const profit = numericInput(form.profit);
  if (!basePrice) return { input: null, error: "قیمت پایه را وارد کنید." };
  const basePattern = form.priceCurrency === "USD" ? /^\d+(?:\.\d{1,6})?$/ : /^\d+$/;
  if (basePrice.length > 24 || !basePattern.test(basePrice)) return { input: null, error: form.priceCurrency === "USD"
    ? "قیمت دلاری باید غیرمنفی و با حداکثر ۶ رقم اعشار باشد." : "قیمت تومانی باید عدد صحیح و غیرمنفی باشد." };
  const validProfit = profit === "" || /^\d+$/.test(profit) || /^\$\d+(?:\.\d{1,6})?$/.test(profit)
    || /^(?:%\d+(?:\.\d{1,4})?|\d+(?:\.\d{1,4})?%)$/.test(profit);
  if (!validProfit || profit.length > 32) return { input: null, error: "سود را با عدد تومانی، %10 یا $2 وارد کنید؛ سود خالی یا صفر مجاز است." };
  return { input: { priceCurrency: form.priceCurrency, basePrice, profit, quantity: 1 }, error: "" };
}

export function profitInput(product: Pick<AdminProduct, "profitType" | "profitValue">) {
  return `${product.profitType === "PERCENT" ? "%" : product.profitType === "USD" ? "$" : ""}${product.profitValue}`;
}

export function pricingError(error: unknown) {
  if (!(error instanceof ApiError)) return "عملیات کامل نشد؛ دوباره تلاش کنید.";
  if (error.status === 401) return "نشست شما پایان یافته است؛ دوباره وارد حساب شوید.";
  if (error.status === 403) return "برای این بخش دسترسی مدیریتی لازم است.";
  if (error.status === 404) return "این قابلیت یا محصول در بک‌اند در دسترس نیست؛ نسخهٔ سرور را بررسی کنید.";
  if (error.status === 429) return "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.";
  const labels: Record<string, string> = {
    PRICING_INPUT_INVALID: "قیمت یا سود معتبر نیست؛ معیار قیمت و تعداد اعشار را بررسی کنید.",
    PRICING_AMOUNT_TOO_LARGE: "قیمت نهایی از سقف مجاز بیشتر است؛ قیمت پایه یا سود را کاهش دهید.",
    PRICING_BASE_REQUIRED: "برای تغییر معیار قیمت، قیمت پایه را دوباره وارد کنید.",
    PRICING_LEGACY_AMBIGUOUS: "درخواست قیمت با قرارداد بک‌اند هماهنگ نیست؛ صفحه را تازه‌سازی کنید.",
    VALIDATION_ERROR: "مقادیر فرم معتبر نیستند؛ محدودهٔ عددها و قالب سود را بررسی کنید.",
    API_INVALID_RESPONSE: "پاسخ سرور با قرارداد قیمت‌گذاری هماهنگ نیست؛ دوباره تلاش کنید.",
  };
  return labels[error.payload?.error?.code ?? ""] ?? error.message;
}
