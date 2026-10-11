import { json, searchParams, staffRoute } from "@/lib/api";
import { dashboardData } from "@/lib/server/dashboard";
import { parsePeriod } from "@/lib/server/reports";

export const dynamic = "force-dynamic";

/** Polled by the dashboard so another device sees new sales/stock within seconds of commit. */
export const GET = staffRoute("dashboard.view", async (req, { db, actor }) => json(await dashboardData(db, actor, parsePeriod(searchParams(req)))));
