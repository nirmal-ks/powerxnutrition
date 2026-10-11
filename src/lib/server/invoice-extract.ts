import { emptyField, emptyInvoice, emptyLine, LOW_CONFIDENCE, type ExtractedInvoice, type ExtractedLine, type Field, type InvoiceWarning } from "@/lib/invoice-types";

/**
 * Supplier-invoice extraction providers. All FREE options:
 *  - "gemini": Google Gemini API free tier (key from aistudio.google.com) — reads PDFs and photos directly.
 *  - "openai": any OpenAI-compatible endpoint — e.g. Ollama running on the shop PC (100% local & free,
 *              model "qwen2.5vl" / "llama3.2-vision"), Groq or OpenRouter free models.
 *  - "text":   no AI at all — parses text that the browser read from the PDF / photo (pdf.js / Tesseract OCR).
 * The model is told never to invent values; we also never "fix" numbers — we only flag inconsistencies.
 */

export type ProviderId = "gemini" | "openai" | "text" | "manual";

export function aiProvider(): { id: "gemini" | "openai"; model: string; external: boolean; label: string } | null {
  if (process.env.GEMINI_API_KEY) {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    return { id: "gemini", model, external: true, label: `Google Gemini (${model})` };
  }
  if (process.env.AI_BASE_URL && process.env.AI_MODEL) {
    const local = /localhost|127\.0\.0\.1|0\.0\.0\.0|\.local\b|192\.168\.|10\.\d+\./.test(process.env.AI_BASE_URL);
    return { id: "openai", model: process.env.AI_MODEL, external: !local, label: `${local ? "Local AI" : "AI"} (${process.env.AI_MODEL})` };
  }
  return null;
}

const PROMPT = `You are reading a supplier purchase invoice for an Indian sports-nutrition retail shop.
Return ONLY JSON matching this shape. Every field is {"value": <value or null>, "confidence": <0..1>}.
RULES:
- Copy values exactly as printed. NEVER guess, compute or invent a value that is not printed. If a field is not on the invoice, use {"value": null, "confidence": null}.
- confidence = how sure you are that you read the printed value correctly (blurry/partly hidden → low).
- Numbers: plain numbers without currency symbols or commas. Dates: YYYY-MM-DD (convert from the printed format; if only month/year, use null).
- One entry in "lines" per product row. qty = number of units. unitPrice = price per unit BEFORE tax as printed (rate). lineTotal = the amount printed for that row.
- taxRate = GST % for the row if printed (e.g. 18). size e.g. "1 kg", "2 lb", "60 capsules". flavour e.g. "Double Rich Chocolate".
Shape:
{"supplierName":F,"supplierPhone":F,"supplierEmail":F,"supplierGstin":F,"supplierAddress":F,"invoiceNo":F,"invoiceDate":F,
 "subtotal":F,"discountTotal":F,"taxTotal":F,"total":F,
 "lines":[{"name":F,"brand":F,"sku":F,"barcode":F,"size":F,"flavour":F,"hsn":F,"qty":F,"unitPrice":F,"discount":F,"taxRate":F,"taxAmount":F,"lineTotal":F,"batchNo":F,"mfgDate":F,"expiryDate":F}]}`;

function stripFences(s: string) {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

const NUM_FIELDS = ["qty", "unitPrice", "discount", "taxRate", "taxAmount", "lineTotal"] as const;
const HEAD_NUM = ["subtotal", "discountTotal", "taxTotal", "total"] as const;

function field<T>(raw: unknown, kind: "string" | "number" | "date"): Field<T> {
  if (raw === null || raw === undefined) return emptyField();
  const obj = typeof raw === "object" && raw !== null && "value" in (raw as object) ? (raw as { value: unknown; confidence?: unknown }) : { value: raw, confidence: null };
  let v = obj.value;
  const c = obj.confidence === null || obj.confidence === undefined ? null : Math.max(0, Math.min(1, Number(obj.confidence)));
  if (v === null || v === undefined || v === "") return { value: null, confidence: null };
  if (kind === "number") {
    const n = typeof v === "number" ? v : Number(String(v).replace(/[₹,\s]/g, ""));
    if (!Number.isFinite(n)) return { value: null, confidence: 0 };
    v = n;
  } else if (kind === "date") {
    const s = String(v).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) return { value: null, confidence: 0 };
    v = s;
  } else v = String(v).trim().slice(0, 300);
  return { value: v as T, confidence: Number.isFinite(c as number) ? c : null };
}

/** Coerces whatever a model returned into our strict shape (drops anything unexpected). */
export function normaliseExtraction(raw: unknown): ExtractedInvoice {
  const r = (raw ?? {}) as Record<string, unknown>;
  const inv = emptyInvoice();
  for (const k of ["supplierName", "supplierPhone", "supplierEmail", "supplierGstin", "supplierAddress", "invoiceNo"] as const) inv[k] = field<string>(r[k], "string");
  inv.invoiceDate = field<string>(r.invoiceDate, "date");
  for (const k of HEAD_NUM) inv[k] = field<number>(r[k], "number");
  const lines = Array.isArray(r.lines) ? r.lines.slice(0, 300) : [];
  inv.lines = lines.map((l) => {
    const x = (l ?? {}) as Record<string, unknown>;
    const line = emptyLine();
    for (const k of ["name", "brand", "sku", "barcode", "size", "flavour", "hsn", "batchNo"] as const) line[k] = field<string>(x[k], "string");
    for (const k of NUM_FIELDS) line[k] = field<number>(x[k], "number");
    line.mfgDate = field<string>(x.mfgDate, "date");
    line.expiryDate = field<string>(x.expiryDate, "date");
    return line;
  }).filter((l) => l.name.value || l.qty.value || l.lineTotal.value);
  return inv;
}

async function callGemini(file: { bytes: Buffer; mime: string } | null, text: string | null, fetchImpl: typeof fetch) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const parts: unknown[] = [{ text: PROMPT }];
  if (file) parts.push({ inline_data: { mime_type: file.mime, data: file.bytes.toString("base64") } });
  if (text) parts.push({ text: `Invoice text:\n${text.slice(0, 60000)}` });
  const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }),
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const out = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return JSON.parse(stripFences(out));
}

async function callOpenAiCompatible(file: { bytes: Buffer; mime: string } | null, text: string | null, fetchImpl: typeof fetch) {
  const content: unknown[] = [{ type: "text", text: PROMPT }];
  if (file && file.mime.startsWith("image/")) content.push({ type: "image_url", image_url: { url: `data:${file.mime};base64,${file.bytes.toString("base64")}` } });
  if (text) content.push({ type: "text", text: `Invoice text:\n${text.slice(0, 60000)}` });
  if (content.length === 1) throw new Error("This AI endpoint can't read PDFs directly — the page will read the PDF text first and send that instead.");
  const res = await fetchImpl(`${process.env.AI_BASE_URL!.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.AI_API_KEY ? { Authorization: `Bearer ${process.env.AI_API_KEY}` } : {}) },
    body: JSON.stringify({ model: process.env.AI_MODEL, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) throw new Error(`AI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return JSON.parse(stripFences(data.choices?.[0]?.message?.content ?? "{}"));
}

export async function extractWithAi(file: { bytes: Buffer; mime: string } | null, text: string | null, fetchImpl: typeof fetch = fetch) {
  const p = aiProvider();
  if (!p) throw new Error("No AI provider configured");
  const raw = p.id === "gemini" ? await callGemini(file, text, fetchImpl) : await callOpenAiCompatible(file, text, fetchImpl);
  return normaliseExtraction(raw);
}

// ---------------------------------------------------------------- no-AI text parser

const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

function findDate(s: string): string | null {
  let m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const d = `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (!Number.isNaN(Date.parse(d))) return d;
  }
  m = s.match(/(\d{1,2})[\s-]([A-Za-z]{3})[a-z]*[\s,-]+(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : null;
}

const money = (s: string) => Number(s.replace(/[₹,\s]/g, ""));

/**
 * Best-effort parse of OCR/PDF text without AI. Deliberately conservative: values get LOW
 * confidence (≤0.5) so every one is shown for review. Lines are rows that end with qty/rate/amount.
 */
export function parseInvoiceText(text: string): ExtractedInvoice {
  const inv = emptyInvoice();
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const all = lines.join("\n");
  const low = (v: string | number | null, c = 0.45) => (v === null || v === "" ? emptyField<never>() : { value: v as never, confidence: c });

  const gst = all.match(/\b(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/);
  if (gst) inv.supplierGstin = low(gst[1], 0.6);
  const no = all.match(/(?:invoice|inv|bill)\s*(?:no|number|#)\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9/\-]{1,24})/i);
  if (no) inv.invoiceNo = low(no[1], 0.5);
  const dateLine = lines.find((l) => /date/i.test(l) && findDate(l));
  const d = dateLine ? findDate(dateLine) : null;
  if (d) inv.invoiceDate = low(d, 0.45);
  const phone = all.match(/(?:\+91[\s-]?)?\b([6-9]\d{9})\b/);
  if (phone) inv.supplierPhone = low(phone[1], 0.4);
  const email = all.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (email) inv.supplierEmail = low(email[0], 0.5);
  // supplier name: first line with letters that isn't a heading word
  const head = lines.slice(0, 6).find((l) => /[A-Za-z]{3}/.test(l) && !/(tax invoice|invoice|bill of supply|original|duplicate|gstin|phone|email)/i.test(l));
  if (head) inv.supplierName = low(head.slice(0, 80), 0.3);

  const totalLine = [...lines].reverse().find((l) => /(grand total|net amount|total amount|invoice total|amount payable|total)\b/i.test(l) && /\d/.test(l));
  const tm = totalLine?.match(/([\d,]+\.\d{2}|[\d,]{3,})\s*$/);
  if (tm) inv.total = low(money(tm[1]), 0.45);
  const taxLine = lines.find((l) => /(total\s*(gst|tax)|igst|cgst)/i.test(l) && /\d/.test(l));
  const tx = taxLine?.match(/([\d,]+\.\d{2})\s*$/);
  if (tx && /total/i.test(taxLine!)) inv.taxTotal = low(money(tx[1]), 0.35);

  // product rows: "<description> <qty> <rate> <amount>" (rate/amount with decimals)
  for (const l of lines) {
    if (/(total|subtotal|cgst|sgst|igst|round|amount in words|bank|ifsc)/i.test(l)) continue;
    const m = l.match(/^(?:\d{1,3}[.)]?\s+)?(.{4,}?)\s+(\d{1,5})\s+(?:nos|pcs|units?|qty)?\s*([\d,]+\.\d{2})\s+(?:.*?\s)?([\d,]+\.\d{2})$/i);
    if (!m) continue;
    const line = emptyLine();
    line.name = low(m[1].replace(/\s+\d{4,8}$/, "").trim(), 0.4);
    const hsn = m[1].match(/\b(\d{4}|\d{6}|\d{8})$/);
    if (hsn) line.hsn = low(hsn[1], 0.35);
    line.qty = low(Number(m[2]), 0.45);
    line.unitPrice = low(money(m[3]), 0.45);
    line.lineTotal = low(money(m[4]), 0.45);
    const batch = l.match(/batch\s*(?:no)?\.?\s*[:\-]?\s*([A-Z0-9-]{3,})/i);
    if (batch) line.batchNo = low(batch[1], 0.35);
    inv.lines.push(line);
  }
  return inv;
}

// ---------------------------------------------------------------- consistency checks

const near = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;

/** Flags missing fields, low confidence and arithmetic mismatches. NEVER changes any value. */
export function checkInvoice(inv: ExtractedInvoice): InvoiceWarning[] {
  const w: InvoiceWarning[] = [];
  const need: [keyof ExtractedInvoice, string][] = [
    ["supplierName", "Supplier name"],
    ["invoiceNo", "Invoice number"],
    ["invoiceDate", "Invoice date"],
    ["total", "Invoice total"],
  ];
  for (const [k, label] of need) if ((inv[k] as Field<unknown>).value === null) w.push({ level: "warn", field: k, message: `${label} not found — enter it from the paper invoice` });
  for (const k of ["supplierName", "supplierGstin", "invoiceNo", "invoiceDate", "subtotal", "taxTotal", "total"] as const) {
    const f = inv[k];
    if (f.value !== null && f.confidence !== null && f.confidence < LOW_CONFIDENCE) w.push({ level: "warn", field: k, message: `Low confidence — please check` });
  }
  if (!inv.lines.length) w.push({ level: "error", field: "lines", message: "No product lines were found — add them manually" });

  let linesSum = 0;
  let linesSumKnown = true;
  inv.lines.forEach((l, i) => {
    const p = `lines[${i}]`;
    if (l.name.value === null) w.push({ level: "warn", field: `${p}.name`, message: `Line ${i + 1}: product name missing` });
    if (l.qty.value === null) w.push({ level: "error", field: `${p}.qty`, message: `Line ${i + 1}: quantity missing` });
    else if (!Number.isInteger(l.qty.value) || l.qty.value <= 0) w.push({ level: "error", field: `${p}.qty`, message: `Line ${i + 1}: quantity ${l.qty.value} is not a whole number above 0` });
    if (l.unitPrice.value === null) w.push({ level: "error", field: `${p}.unitPrice`, message: `Line ${i + 1}: unit price missing` });
    for (const k of ["qty", "unitPrice", "lineTotal", "expiryDate", "batchNo"] as const) {
      const f = l[k];
      if (f.value !== null && f.confidence !== null && f.confidence < LOW_CONFIDENCE) w.push({ level: "warn", field: `${p}.${k}`, message: `Line ${i + 1}: low confidence on ${k} — check against the invoice` });
    }
    if (l.qty.value !== null && l.unitPrice.value !== null && l.lineTotal.value !== null) {
      const base = l.qty.value * l.unitPrice.value - (l.discount.value ?? 0);
      const withTax = l.taxRate.value ? base * (1 + l.taxRate.value / 100) : l.taxAmount.value ? base + l.taxAmount.value : base;
      if (!near(l.lineTotal.value, base) && !near(l.lineTotal.value, withTax, Math.max(1, withTax * 0.005))) {
        w.push({ level: "error", field: `${p}.lineTotal`, message: `Line ${i + 1}: ${l.qty.value} × ${l.unitPrice.value} doesn't match the line amount ${l.lineTotal.value}` });
      }
    }
    if (l.lineTotal.value !== null) linesSum += l.lineTotal.value;
    else linesSumKnown = false;
  });
  if (linesSumKnown && inv.lines.length) {
    const sub = inv.subtotal.value;
    const total = inv.total.value;
    const tax = inv.taxTotal.value ?? 0;
    const disc = inv.discountTotal.value ?? 0;
    const okSub = sub === null || near(linesSum, sub, Math.max(1, sub * 0.002));
    const okTotal =
      total === null ||
      near(linesSum, total, Math.max(2, total * 0.002)) ||
      near(linesSum - disc + tax, total, Math.max(2, total * 0.002)) ||
      (sub !== null && near(sub - disc + tax, total, Math.max(2, total * 0.002)));
    if (!okSub) w.push({ level: "error", field: "subtotal", message: `Lines add up to ${linesSum.toFixed(2)} but the invoice subtotal is ${sub}` });
    if (!okTotal) w.push({ level: "error", field: "total", message: `Lines (${linesSum.toFixed(2)}) − discount + tax don't match the invoice total ${total}. Check for missing lines or misread numbers.` });
  }
  return w;
}
