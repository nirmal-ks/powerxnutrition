import { siteConfig } from "@/config/site";

export interface ShopStatus {
  open: boolean;
  /** true in the last 30 minutes before closing */
  closingSoon: boolean;
  /** e.g. "Closes at 9:30 PM" / "Opens tomorrow at 9:00 AM" */
  detail: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const formatTime = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** Shop status at `now`, always in India time (IST, UTC+5:30, no daylight saving) whatever the visitor's timezone. */
export function getShopStatus(now: Date = new Date()): ShopStatus {
  const { open, close, closedDays } = siteConfig.contact.openingHours;
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  const day = ist.getUTCDay();
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const openAt = toMinutes(open);
  const closeAt = toMinutes(close);
  const worksOn = (d: number) => !closedDays.includes(d);

  if (worksOn(day) && mins >= openAt && mins < closeAt) {
    return { open: true, closingSoon: closeAt - mins <= 30, detail: `Closes at ${formatTime(close)}` };
  }
  if (worksOn(day) && mins < openAt) {
    return { open: false, closingSoon: false, detail: `Opens today at ${formatTime(open)}` };
  }
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    if (worksOn(d)) {
      return { open: false, closingSoon: false, detail: `Opens ${i === 1 ? "tomorrow" : DAYS[d]} at ${formatTime(open)}` };
    }
  }
  return { open: false, closingSoon: false, detail: "Temporarily closed" };
}

/** schema.org openingHours, e.g. "Mo-Su 09:00-21:30" or "Mo,Tu,We 09:00-21:30". */
export function schemaOpeningHours() {
  const { open, close, closedDays } = siteConfig.contact.openingHours;
  const codes = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => !closedDays.includes(d)).map((d) => codes[d]);
  return `${days.length === 7 ? "Mo-Su" : days.join(",")} ${open}-${close}`;
}
