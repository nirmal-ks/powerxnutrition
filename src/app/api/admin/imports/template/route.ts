import { searchParams, staffRoute } from "@/lib/api";
import { toCsv } from "@/lib/server/reports";
import { TEMPLATE_COLUMNS, TEMPLATE_EXAMPLE } from "@/lib/server/stock-import";
import { writeXlsx } from "@/lib/server/xlsx";

/** Downloadable import template (?format=xlsx|csv). Row 2 is an example — delete it before importing. */
export const GET = staffRoute("purchases.create", async (req) => {
  if (searchParams(req).get("format") === "csv") {
    const row = Object.fromEntries(TEMPLATE_COLUMNS.map((c, i) => [c, TEMPLATE_EXAMPLE[i]]));
    return new Response(toCsv([row], TEMPLATE_COLUMNS.map((c) => ({ key: c, label: c }))), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="powerx-stock-import-template.csv"' },
    });
  }
  const buf = writeXlsx([[...TEMPLATE_COLUMNS], [...TEMPLATE_EXAMPLE]], "Stock import");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="powerx-stock-import-template.xlsx"',
    },
  });
});
