import { cn } from "@/lib/format";
import type { OrderStatus, PaymentStatus } from "@/types";

const STATUS: Record<OrderStatus, string> = {
  new: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  confirmed: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  shipped: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  delivered: "bg-green-500/15 text-green-300 border-green-500/30",
  cancelled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};
const PAYMENT: Record<PaymentStatus, string> = {
  unpaid: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  verifying: "bg-gold/15 text-gold border-gold/40",
  paid: "bg-green-500/15 text-green-300 border-green-500/30",
  refunded: "bg-red-500/15 text-red-300 border-red-500/30",
};

export const StatusBadge = ({ status }: { status: OrderStatus }) => (
  <span className={cn("rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider", STATUS[status])}>{status}</span>
);
export const PaymentBadge = ({ status }: { status: PaymentStatus }) => (
  <span className={cn("rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider", PAYMENT[status])}>
    {status === "verifying" ? "UTR to verify" : status}
  </span>
);
