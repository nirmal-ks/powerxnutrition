/**
 * All money maths is done in integer paise so ₹0.1 + ₹0.2 never becomes ₹0.30000000000000004.
 * The database stores numeric(12,2) rupees; convert at the edges with toPaise / toRupees.
 */
export const toPaise = (rupees: number) => Math.round((Number(rupees) || 0) * 100);
export const toRupees = (paise: number) => Math.round(paise) / 100;

/** Splits `total` paise across `weights` proportionally; the pieces always add up exactly to total. */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (!sum || !total) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((s, v) => s + v, 0);
  // hand out the remaining paise to the largest fractional parts
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) out[order[k][1]] += 1;
  return out;
}

/** ₹1,234.50 — shows paise only when there are some. */
export function inr2(rupees: number) {
  const n = Number(rupees) || 0;
  const whole = Number.isInteger(Math.round(n * 100) / 100) && Math.round(n * 100) % 100 === 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}
