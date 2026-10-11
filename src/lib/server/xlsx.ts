import { crc32, inflateRawSync } from "node:zlib";

/**
 * Minimal, dependency-free .xlsx support: reads the first worksheet as rows of strings, and writes
 * a simple one-sheet workbook (for the import template). Enough for stock imports; avoids pulling
 * a large spreadsheet library (and its security advisories) into the server.
 */

function unzip(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  // find End Of Central Directory record
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a valid .xlsx file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Corrupt .xlsx file");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + compSize);
    if (compSize > 50 * 1024 * 1024) throw new Error("Spreadsheet is too large");
    files.set(name, method === 0 ? Buffer.from(data) : method === 8 ? inflateRawSync(data, { maxOutputLength: 100 * 1024 * 1024 }) : Buffer.alloc(0));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");

const colIndex = (ref: string) => {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

/** Excel serial date → YYYY-MM-DD */
export const excelDate = (serial: number) => new Date(Math.round((serial - 25569) * 86400_000)).toISOString().slice(0, 10);

export function readXlsx(buf: Buffer): string[][] {
  const files = unzip(buf);
  const text = (name: string) => files.get(name)?.toString("utf8") ?? "";
  const shared: string[] = [];
  for (const si of text("xl/sharedStrings.xml").match(/<si>[\s\S]*?<\/si>/g) ?? []) {
    shared.push(decode((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<t[^>]*>|<\/t>/g, "")).join("")));
  }
  // date-formatted styles (so date cells become YYYY-MM-DD instead of 45678)
  const styles = text("xl/styles.xml");
  const customDate = new Set<number>();
  for (const m of styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/g)) if (/[dy]/i.test(m[2]) && !/\[h\]/i.test(m[2])) customDate.add(Number(m[1]));
  const xfs = (styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1].match(/<xf [^>]*>/g) ?? []).map((x) => Number(x.match(/numFmtId="(\d+)"/)?.[1] ?? 0));
  const isDateStyle = (s: number) => {
    const f = xfs[s];
    return (f >= 14 && f <= 22) || (f >= 45 && f <= 47) || customDate.has(f);
  };

  // first sheet in workbook order
  const wb = text("xl/workbook.xml");
  const firstRid = wb.match(/<sheet [^>]*r:id="([^"]+)"/)?.[1];
  const rels = text("xl/_rels/workbook.xml.rels");
  const target = firstRid ? rels.match(new RegExp(`<Relationship [^>]*Id="${firstRid}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${firstRid}"`))?.[1] : undefined;
  const sheetPath = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`) : "xl/worksheets/sheet1.xml";
  const sheet = text(sheetPath) || text("xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("The spreadsheet has no worksheet");

  const rows: string[][] = [];
  for (const rowXml of sheet.match(/<row[^>]*>[\s\S]*?<\/row>|<row[^>]*\/>/g) ?? []) {
    const row: string[] = [];
    for (const c of rowXml.match(/<c [^>]*\/>|<c [^>]*>[\s\S]*?<\/c>/g) ?? []) {
      const ref = c.match(/ r="([A-Z]+\d+)"/)?.[1];
      const type = c.match(/ t="([^"]+)"/)?.[1];
      const style = Number(c.match(/ s="(\d+)"/)?.[1] ?? -1);
      let v = c.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      if (type === "s") v = shared[Number(v)] ?? "";
      else if (type === "inlineStr") v = decode((c.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? ""));
      else if (type === "b") v = v === "1" ? "TRUE" : "FALSE";
      else if (type === "str") v = decode(v);
      else if (v && style >= 0 && isDateStyle(style) && /^\d+(\.\d+)?$/.test(v)) v = excelDate(Number(v));
      else v = decode(v);
      const idx = ref ? colIndex(ref) : row.length;
      while (row.length < idx) row.push("");
      row[idx] = v.trim();
    }
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------- writer

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

function zip(entries: { name: string; data: Buffer }[]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name);
    const crc = crc32(e.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc >>> 0, 14);
    local.writeUInt32LE(e.data.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc >>> 0, 16);
    central.writeUInt32LE(e.data.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, e.data);
    centrals.push(central, name);
    offset += 30 + name.length + e.data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

export function writeXlsx(rows: (string | number)[][], sheetName = "Sheet1") {
  const sheetRows = rows
    .map(
      (r, ri) =>
        `<row r="${ri + 1}">${r
          .map((v, ci) =>
            typeof v === "number"
              ? `<c r="${colName(ci)}${ri + 1}"><v>${v}</v></c>`
              : `<c r="${colName(ci)}${ri + 1}" t="inlineStr"${ri === 0 ? ' s="1"' : ""}><is><t>${esc(v)}</t></is></c>`,
          )
          .join("")}</row>`,
    )
    .join("");
  const x = (s: string) => Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${s}`);
  return zip([
    { name: "[Content_Types].xml", data: x(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`) },
    { name: "_rels/.rels", data: x(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: "xl/workbook.xml", data: x(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: x(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name: "xl/styles.xml", data: x(`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`) },
    { name: "xl/worksheets/sheet1.xml", data: x(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`) },
  ]);
}

/** RFC 4180 CSV parser (quotes, escaped quotes, CRLF, BOM). */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}
