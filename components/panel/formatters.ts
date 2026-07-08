export function formatCurrency(amount: number) {
  return `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
