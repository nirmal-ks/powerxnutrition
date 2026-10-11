"use client";

/** Fixed colours (not theme tokens) so it's readable in both light and dark theme. */
export function PrintButton({ label = "🖨 Print", pdfUrl }: { label?: string; pdfUrl?: string }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: pdfUrl ? "1fr 1fr" : "1fr" }}>
      {pdfUrl && (
        <a href={pdfUrl} className="rounded-xl px-4 py-3 text-center text-sm font-bold" style={{ background: "#e10600", color: "#ffffff" }}>
          ⬇ Download PDF
        </a>
      )}
      <button onClick={() => window.print()} className="rounded-xl px-4 py-3 text-sm font-bold" style={{ background: "#111111", color: "#ffffff" }}>
        {label}
      </button>
    </div>
  );
}
