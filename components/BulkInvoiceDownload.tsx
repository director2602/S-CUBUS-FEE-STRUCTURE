"use client";

import { useMemo, useRef, useState } from "react";
import InvoiceSheet from "@/components/InvoiceSheet";
import { formatINR, type Payment } from "@/lib/fee-calc";

type Item = { payment: Payment; admission: any; paidBefore: number; counselorName: string | null };

export default function BulkInvoiceDownload({ items }: { items: Item[] }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      items.filter((it) => {
        const d = it.payment.paid_on;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      }),
    [items, from, to]
  );

  const totalAmount = filtered.reduce(
    (s, it) => s + Number(it.payment.amount) + Number((it.payment as any).card_charge_amount || 0),
    0
  );

  async function handleDownload() {
    if (!filtered.length || !containerRef.current) return;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: filtered.length });
    try {
      // Loaded on demand — these aren't needed by any other page, so they stay out of
      // everyone else's bundle until someone actually opens Bulk Invoices.
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const sheets = Array.from(containerRef.current.querySelectorAll<HTMLElement>("[data-invoice-sheet]"));

      for (let i = 0; i < sheets.length; i++) {
        const canvas = await html2canvas(sheets[i], { scale: 2, backgroundColor: "#ffffff" });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
        const w = canvas.width * ratio;
        const h = canvas.height * ratio;
        if (i > 0) doc.addPage();
        doc.addImage(imgData, "JPEG", (pageW - w) / 2, 18, w, h);
        setProgress({ done: i + 1, total: sheets.length });
      }

      const stamp = new Date().toISOString().slice(0, 10);
      const rangeLabel = from || to ? `_${from || "start"}_to_${to || stamp}` : "_till-date";
      doc.save(`S-CUBUS-Invoices${rangeLabel}_${stamp}.pdf`);
    } catch (err: any) {
      setError(err?.message || "Could not build the combined PDF — try \u201cPrint all instead\u201d below.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function handlePrintAll() {
    window.print();
  }

  return (
    <div>
      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field">
            <label htmlFor="bulk-from">From (optional)</label>
            <input id="bulk-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="bulk-to">To (optional)</label>
            <input id="bulk-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(from || to) && (
            <button
              className="reset-btn"
              style={{ color: "var(--accent)" }}
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              Clear range (show all, till date)
            </button>
          )}
        </div>

        <p className="comp-hint" style={{ margin: "14px 0" }}>
          {filtered.length} invoice{filtered.length === 1 ? "" : "s"} selected &middot; total {formatINR(totalAmount)}
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" onClick={handleDownload} disabled={busy || !filtered.length}>
            {busy ? `Building PDF\u2026 (${progress?.done ?? 0}/${progress?.total ?? filtered.length})` : "Download all as one PDF"}
          </button>
          <button className="btn secondary" onClick={handlePrintAll} disabled={!filtered.length}>
            Print all instead
          </button>
        </div>

        {error && (
          <div className="error-text" style={{ marginTop: 10 }}>
            {error}
          </div>
        )}
        {!filtered.length && (
          <p className="comp-hint" style={{ marginTop: 10 }}>
            No invoices in this range.
          </p>
        )}
      </div>

      {/* Always mounted (not hidden off-screen): doubles as a visible preview of exactly what
          "Download all" will capture and what "Print all" / browser Print-to-PDF will print —
          one invoice per page via the .bulk-invoice-page print rule in globals.css. */}
      <div ref={containerRef}>
        {filtered.map((it) => (
          <div key={it.payment.id} data-invoice-sheet className="bulk-invoice-page">
            <InvoiceSheet admission={it.admission} selected={it.payment} paidBefore={it.paidBefore} counselorName={it.counselorName} />
          </div>
        ))}
      </div>
    </div>
  );
}
