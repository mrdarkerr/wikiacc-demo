import type { Order } from "@/types/api";
import { superipStatusLabel } from "@/lib/superip";
export function SuperipOrderStatus({ order }: { order: Order }) {
  return (
    <>
      {order.items
        .filter((item) => item.productTypeSnapshot === "SUPERIP_WALLET")
        .map((item) => {
          const job = item.superipFulfillment;
          return (
            <div
              key={item.id}
              className="my-3 space-y-1 rounded-md border border-border bg-muted/30 p-3 text-sm"
            >
              <p className="font-medium">شارژ کیف پول نمایندگی سوپر ایپی</p>
              <p>
                نام کاربری: <bdi>{job?.username ?? "—"}</bdi> · مبلغ:{" "}
                {(job?.amount ?? item.priceSnapshot).toLocaleString("fa-IR")}{" "}
                تومان
              </p>
              <p role="status">
                {order.status === "REFUNDED" || order.paymentStatus === "REFUNDED"
                  ? "مبلغ سفارش بازپرداخت شده است"
                  : order.status === "CANCELLED"
                    ? "سفارش لغو شده است"
                    : order.paymentStatus !== "PAID"
                      ? "در انتظار پرداخت"
                      : superipStatusLabel(job?.status)}
              </p>
              {job?.status === "REVIEW_REQUIRED" && (
                <p className="text-xs text-muted-foreground">
                  پرداخت ثبت شده و شارژ نیازمند بررسی است؛ دوباره خرید نکنید و
                  با پشتیبانی تماس بگیرید.
                </p>
              )}
            </div>
          );
        })}
    </>
  );
}
