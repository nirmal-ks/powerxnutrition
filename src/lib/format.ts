const inrFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const inr = (amount: number) => inrFormatter.format(Math.round(amount));

export const discountPercent = (price: number, mrp: number) =>
  mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");
