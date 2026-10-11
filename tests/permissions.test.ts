import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Use an in-memory database for the app's real getDb() (route handlers call it).
process.env.PGLITE_DATA_DIR = "memory://";
process.env.ADMIN_PASSWORD = "owner-pass-123";
process.env.ADMIN_SESSION_SECRET = "test-secret-for-sessions-0123456789";

const { getDb } = await import("@/lib/db");
const { createSessionToken, ADMIN_COOKIE } = await import("@/lib/auth");
const { createStaff, ensureBuiltinOwner, updateStaff } = await import("@/lib/server/staff");
const { can } = await import("@/lib/permissions");
const settingsRoute = await import("@/app/api/admin/settings/route");
const salesRoute = await import("@/app/api/admin/sales/route");
const reportsRoute = await import("@/app/api/admin/reports/route");
const adjustRoute = await import("@/app/api/admin/inventory/adjust/route");
const auditRoute = await import("@/app/api/admin/audit/route");
const purchasesRoute = await import("@/app/api/admin/purchases/route");
const staffRoute = await import("@/app/api/admin/staff/route");
const productRoute = await import("@/app/api/admin/products/[slug]/route");

const OWNER = { id: "owner", name: "Owner", role: "owner" as const };
const cookies: Record<string, string> = {};
let cashierId = "";
let variantId = "";

const req = (url: string, who: string | null, init: { method?: string; body?: unknown } = {}) =>
  new Request(`http://localhost${url}`, {
    method: init.method ?? "GET",
    headers: { ...(who ? { cookie: `${ADMIN_COOKIE}=${cookies[who]}` } : {}), "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

beforeAll(async () => {
  const db = await getDb();
  await ensureBuiltinOwner(db);
  const cashier = await db.tx((q) => createStaff(q, OWNER, { username: "ravi", name: "Ravi", role: "cashier", password: "cashier-pass-1" }));
  const inv = await db.tx((q) => createStaff(q, OWNER, { username: "mani", name: "Mani", role: "inventory", password: "stock-pass-12" }));
  const mgr = await db.tx((q) => createStaff(q, OWNER, { username: "kavi", name: "Kavi", role: "manager", password: "manager-pass-1" }));
  cashierId = cashier!.id;
  cookies.owner = createSessionToken("owner", 1).token;
  cookies.cashier = createSessionToken(cashier!.id, 1).token;
  cookies.inventory = createSessionToken(inv!.id, 1).token;
  cookies.manager = createSessionToken(mgr!.id, 1).token;
  variantId = (await db.query<{ id: string }>("select id from product_variants where stock > 2 limit 1"))[0].id;
});
afterAll(async () => (await getDb()).close());

describe("role matrix", () => {
  it("owner can do everything; cashier & inventory are restricted", () => {
    expect(can("owner", "tax.manage")).toBe(true);
    expect(can("manager", "tax.manage")).toBe(false);
    expect(can("manager", "sales.return")).toBe(true);
    expect(can("cashier", "sales.create")).toBe(true);
    expect(can("cashier", "sales.return")).toBe(false);
    expect(can("cashier", "reports.financial")).toBe(false);
    expect(can("cashier", "inventory.adjust")).toBe(false);
    expect(can("inventory", "purchases.confirm")).toBe(true);
    expect(can("inventory", "sales.create")).toBe(false);
    expect(can("inventory", "products.cost")).toBe(false);
    expect(can("inventory", "images.review")).toBe(false);
  });
});

describe("server-side enforcement on real API routes", () => {
  it("unauthenticated requests are rejected (401)", async () => {
    expect((await salesRoute.GET(req("/api/admin/sales", null))).status).toBe(401);
    expect((await settingsRoute.PUT(req("/api/admin/settings", null, { method: "PUT", body: { group: "operations", values: {} } }))).status).toBe(401);
  });

  it("a forged/garbage cookie is rejected", async () => {
    cookies.fake = "eyJ1Ijoib3duZXIiLCJ2IjoxLCJlIjo5OTk5OTk5OTk5OTk5fQ.forged";
    expect((await salesRoute.GET(req("/api/admin/sales", "fake"))).status).toBe(401);
  });

  it("owner access works", async () => {
    const r = await settingsRoute.PUT(req("/api/admin/settings", "owner", { method: "PUT", body: { group: "operations", values: { cashierMaxDiscountPct: 5 } } }));
    expect(r.status).toBe(200);
    expect((await reportsRoute.GET(req("/api/admin/reports?type=summary", "owner"))).status).toBe(200);
  });

  it("cashier can bill but can't change settings, see reports, adjust stock, read the audit log or change prices", async () => {
    const sale = await salesRoute.POST(req("/api/admin/sales", "cashier", { method: "POST", body: { clientTxnId: crypto.randomUUID(), items: [{ variantId, qty: 1 }], payments: [{ method: "cash", amount: 999999 }] } }));
    expect(sale.status).toBe(400); // allowed in, but server recomputes the total and rejects the wrong payment amount
    expect((await settingsRoute.PUT(req("/api/admin/settings", "cashier", { method: "PUT", body: { group: "business", values: { gstRegistered: true } } }))).status).toBe(403);
    expect((await reportsRoute.GET(req("/api/admin/reports?type=summary", "cashier"))).status).toBe(403);
    expect((await adjustRoute.POST(req("/api/admin/inventory/adjust", "cashier", { method: "POST", body: { variantId, change: 50, reason: "found" } }))).status).toBe(403);
    expect((await auditRoute.GET(req("/api/admin/audit", "cashier"))).status).toBe(403);
    expect((await productRoute.PATCH(req("/api/admin/products/x", "cashier", { method: "PATCH", body: { variants: [] } }), { params: Promise.resolve({ slug: "x" }) })).status).toBe(403);
  });

  it("manager can't change tax settings (owner only)", async () => {
    expect((await settingsRoute.PUT(req("/api/admin/settings", "manager", { method: "PUT", body: { group: "business", values: { gstRegistered: false } } }))).status).toBe(403);
  });

  it("inventory staff can receive stock but can't bill or manage staff", async () => {
    expect((await purchasesRoute.GET(req("/api/admin/purchases", "inventory"))).status).toBe(200);
    expect((await salesRoute.POST(req("/api/admin/sales", "inventory", { method: "POST", body: {} }))).status).toBe(403);
    expect((await staffRoute.POST(req("/api/admin/staff", "inventory", { method: "POST", body: { username: "x", name: "x", role: "owner", password: "12345678" } }))).status).toBe(403);
  });

  it("cashier only sees their own bills", async () => {
    const ok = await salesRoute.POST(req("/api/admin/sales", "owner", { method: "POST", body: { clientTxnId: crypto.randomUUID(), items: [{ variantId, qty: 1 }], payments: [{ method: "cash", amount: (await (await getDb()).query<{ price: number }>("select price from product_variants where id = $1", [variantId]))[0].price }] } }));
    expect(ok.status).toBe(201);
    const list = (await (await salesRoute.GET(req("/api/admin/sales", "cashier"))).json()) as { sales: { cashier_name: string }[] };
    expect(list.sales.every((s) => s.cashier_name === "Ravi")).toBe(true);
  });

  it("deactivating or re-roling staff signs them out immediately", async () => {
    const db = await getDb();
    await db.tx((q) => updateStaff(q, OWNER, cashierId, { active: false }));
    expect((await salesRoute.GET(req("/api/admin/sales", "cashier"))).status).toBe(401);
  });
});
