"use client";

/**
 * Free, no-API-key text reading in the browser:
 *  - PDF → pdf.js reads the text layer (digital invoices).
 *  - Photo / scanned PDF page → Tesseract.js OCR (runs on the device; language data is downloaded once).
 * Libraries load from public CDNs only when needed.
 */
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<PdfPage> }> };
};
type PdfPage = {
  getTextContent: () => Promise<{ items: { str: string; transform: number[] }[] }>;
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
};
type Tess = { recognize: (img: Blob | HTMLCanvasElement, lang: string) => Promise<{ data: { text: string } }> };

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const TESSERACT = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load the free text reader (needs internet once)."));
    document.head.appendChild(s);
  });
}

async function pdfjs(): Promise<PdfJs> {
  await loadScript(PDFJS);
  const lib = (window as unknown as { pdfjsLib: PdfJs }).pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return lib;
}

async function tesseract(): Promise<Tess> {
  await loadScript(TESSERACT);
  return (window as unknown as { Tesseract: Tess }).Tesseract;
}

/** Groups pdf.js text items into lines by their y position. */
function itemsToLines(items: { str: string; transform: number[] }[]) {
  const rows = new Map<number, { x: number; s: string }[]>();
  for (const it of items) {
    if (!it.str.trim()) continue;
    const y = Math.round(it.transform[5] / 3) * 3;
    const list = rows.get(y) ?? [];
    list.push({ x: it.transform[4], s: it.str });
    rows.set(y, list);
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, cells]) => cells.sort((a, b) => a.x - b.x).map((c) => c.s.trim()).join(" "))
    .join("\n");
}

export async function readFileText(file: Blob, mime: string, onProgress?: (msg: string) => void): Promise<string> {
  if (mime === "application/pdf") {
    onProgress?.("Reading PDF text…");
    const lib = await pdfjs();
    const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
    let out = "";
    for (let n = 1; n <= Math.min(doc.numPages, 10); n++) {
      const page = await doc.getPage(n);
      const text = itemsToLines((await page.getTextContent()).items);
      if (text.trim().length > 40) out += text + "\n";
      else {
        // scanned page with no text layer → OCR the rendered page
        onProgress?.(`Page ${n} is a scan — running OCR (free, on this device)…`);
        const vp = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width;
        canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
        const t = await tesseract();
        out += (await t.recognize(canvas, "eng")).data.text + "\n";
      }
    }
    return out;
  }
  onProgress?.("Reading the photo with OCR (free, on this device — may take 20–40 s)…");
  const t = await tesseract();
  return (await t.recognize(file, "eng")).data.text;
}
