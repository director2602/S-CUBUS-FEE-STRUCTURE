"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { jsPDF } from "jspdf";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatINR } from "@/lib/fee-calc";
import SignaturePad, { type SignaturePadHandle } from "@/components/SignaturePad";

const PLUM: [number, number, number] = [64, 12, 77];
const SOFT: [number, number, number] = [107, 101, 88];

export default function ReceiptView({ admission }: { admission: any }) {
  const supabase = supabaseBrowser();
  const sigRef = useRef<SignaturePadHandle>(null);
  const [signedByName, setSignedByName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  async function loadLogoDataUrl(): Promise<string | null> {
    try {
      const res = await fetch("/logo.png");
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  function row(doc: jsPDF, y: number, label: string, value: string, opts?: { bold?: boolean; big?: boolean }) {
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(opts?.big ? 12 : 10.5);
    doc.setTextColor(...SOFT);
    doc.text(label, 18, y);
    doc.setTextColor(...PLUM);
    doc.text(value, 192, y, { align: "right" });
    return y + (opts?.big ? 8 : 6.5);
  }

  async function handleGenerate() {
    if (!signedByName.trim()) {
      setError("Enter the signer's name.");
      return;
    }
    if (sigRef.current?.isEmpty()) {
      setError("Please draw a signature before generating the PDF.");
      return;
    }
    setBusy(true);
    setError(null);

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const logo = await loadLogoDataUrl();
    if (logo) {
      try {
        doc.addImage(logo, "PNG", 18, 14, 16, 17.5);
      } catch {
        /* ignore image errors, keep going without it */
      }
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...PLUM);
    doc.text("S-CUBUS — Admission Fee Summary", 40, 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...SOFT);
    doc.text(`Generated ${new Date().toLocaleString("en-IN")}`, 40, 28);

    let y = 42;
    doc.setDrawColor(230, 224, 210);
    doc.line(18, y, 192, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PLUM);
    doc.text("Student & Admission", 18, y);
    y += 7;

    y = row(doc, y, "Student name", admission.student_name || "—");
    y = row(doc, y, "SCID", admission.scid || "—");
    y = row(doc, y, "Mother's / Father's name", `${admission.mother_name || "—"} / ${admission.father_name || "—"}`);
    y = row(doc, y, "Contact", `${admission.phone1 || "—"} ${admission.phone2 ? "/ " + admission.phone2 : ""}`);
    y = row(doc, y, "Batch", admission.batch_label || "—");
    y = row(doc, y, "Admission date", admission.admission_date || "—");
    y = row(doc, y, "Batch commencement", admission.batch_commencement_date || "—");

    y += 4;
    doc.line(18, y, 192, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PLUM);
    doc.text("Fee Breakdown", 18, y);
    y += 7;

    y = row(doc, y, "Registration fee", formatINR(admission.reg_fee));
    y = row(doc, y, "Tuition fee", formatINR(admission.tuition_fee));
    y = row(doc, y, "Kit fee (module + technology + uniform)", formatINR(admission.kit_fee));
    y = row(doc, y, "Gross fee", formatINR(admission.gross_fee), { bold: true });
    y = row(doc, y, `Scholarship (${admission.eff_scholarship_pct}% of tuition)`, `− ${formatINR(admission.scholarship_amount)}`);
    y = row(doc, y, "Net payable (excl. GST)", formatINR(admission.net_excl_gst));
    y = row(doc, y, `GST @ ${admission.gst_rate}%`, `+ ${formatINR(admission.gst_amount)}`);
    y = row(doc, y, "Net payable (incl. GST)", formatINR(admission.net_incl_gst), { bold: true });
    y = row(doc, y, "Additional discount", `− ${formatINR(admission.additional_discount)}`);
    y = row(doc, y, "Actual fee payable", formatINR(admission.actual_payable), { bold: true, big: true });
    y = row(doc, y, "Fees paid so far", formatINR(admission.actual_fees_paid));
    y = row(doc, y, "Net outstanding", formatINR(Math.max(admission.outstanding, 0)));
    y = row(doc, y, "Billing status", admission.billing_status, { bold: true });

    y += 4;
    doc.line(18, y, 192, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PLUM);
    doc.text("Installment Schedule", 18, y);
    y += 7;

    y = row(doc, y, "On registration", formatINR(admission.inst0));
    y = row(doc, y, "1st — before batch commencement (40%)", formatINR(admission.inst1));
    y = row(doc, y, "2nd — by the 20th of month 2", formatINR(admission.inst2));
    y = row(doc, y, "3rd — by the 20th of month 4", formatINR(admission.inst3));
    y = row(doc, y, "Total of installments", formatINR(admission.inst0 + admission.inst1 + admission.inst2 + admission.inst3), { bold: true });

    y += 10;
    if (y > 250) {
      doc.addPage();
      y = 24;
    }
    doc.line(18, y, 192, y);
    y += 10;

    const sigData = sigRef.current!.getDataUrl()!;
    doc.addImage(sigData, "PNG", 18, y, 55, 22);
    doc.setDrawColor(200, 190, 205);
    doc.line(18, y + 24, 78, y + 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...SOFT);
    doc.text(`Signed by: ${signedByName}`, 18, y + 29);
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, 18, y + 34);

    const pdfBlob = doc.output("blob");
    const fileName = `${(admission.student_name || "student").replace(/[^a-z0-9]+/gi, "_")}-fee-summary.pdf`;

    // 1) trigger a local download for whoever is on this screen
    const localUrl = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = localUrl;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(localUrl);

    // 2) keep a durable copy in Supabase Storage + record the signature on the admission
    const path = `${admission.counselor_id}/${admission.id}.pdf`;
    const { error: upErr } = await supabase.storage.from("fee-receipts").upload(path, pdfBlob, {
      upsert: true,
      contentType: "application/pdf"
    });
    if (upErr) {
      setError(`PDF downloaded, but saving a copy on file failed: ${upErr.message}`);
      setBusy(false);
      return;
    }
    const nowIso = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("admissions")
      .update({
        signature_data_url: sigData,
        signed_by_name: signedByName,
        signed_at: nowIso,
        pdf_path: path,
        pdf_generated_at: nowIso
      })
      .eq("id", admission.id);
    if (updErr) {
      setError(`PDF downloaded and saved, but couldn't record the signature: ${updErr.message}`);
      setBusy(false);
      return;
    }

    const { data: signed } = await supabase.storage.from("fee-receipts").createSignedUrl(path, 60 * 60 * 24 * 7);
    setSavedUrl(signed?.signedUrl ?? null);
    setDone(true);
    setBusy(false);
  }

  async function handleDownloadSavedCopy() {
    const { data, error } = await supabase.storage.from("fee-receipts").createSignedUrl(admission.pdf_path, 60 * 60);
    if (error) {
      setError(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <>
      <Link href="/calculator" className="comp-hint">
        &larr; Back to calculator
      </Link>
      <div style={{ height: 16 }} />
      <div className="grid-2">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <span className="kicker">Summary</span>
              <h2 className="card-title">{admission.student_name}</h2>
            </div>
            <div className="sum-row">
              <span className="sum-label">Batch</span>
              <span className="sum-val">{admission.batch_label}</span>
            </div>
            <div className="sum-row total">
              <span className="sum-label strong">Actual fee payable</span>
              <span className="sum-val big">{formatINR(admission.actual_payable)}</span>
            </div>
            <div className="sum-row">
              <span className="sum-label">Net outstanding</span>
              <span className="sum-val">{formatINR(Math.max(admission.outstanding, 0))}</span>
            </div>
            <div className="sum-row">
              <span className="sum-label">Billing status</span>
              <span
                className={`badge ${admission.billing_status === "Paid in Full" ? "good" : admission.billing_status === "Unpaid" ? "bad" : "warn"}`}
              >
                {admission.billing_status}
              </span>
            </div>
          </div>

          {admission.pdf_path && (
            <div className="card">
              <div className="card-head">
                <span className="kicker">On file</span>
                <h2 className="card-title">Previously saved copy</h2>
              </div>
              <p className="comp-hint">
                Signed {admission.signed_by_name ? `by ${admission.signed_by_name} ` : ""}
                {admission.signed_at ? `on ${new Date(admission.signed_at).toLocaleString("en-IN")}` : ""}
              </p>
              <button className="btn secondary small" onClick={handleDownloadSavedCopy}>
                Download saved copy
              </button>
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <span className="kicker">08</span>
              <h2 className="card-title">Sign &amp; Download PDF</h2>
            </div>
            <p className="comp-hint" style={{ marginBottom: 12 }}>
              Draw a signature below, confirm the signer's name, then generate the PDF. It downloads to this device
              and a signed copy is kept on file for this admission.
            </p>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Signature</label>
              <SignaturePad ref={sigRef} />
              <button className="reset-btn" style={{ pointerEvents: "auto", alignSelf: "flex-start" }} onClick={() => sigRef.current?.clear()}>
                Clear signature
              </button>
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Signed by (name)</label>
              <input value={signedByName} onChange={(e) => setSignedByName(e.target.value)} placeholder="e.g. parent / guardian name" />
            </div>
            {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
            {done && (
              <div className="success-text" style={{ marginBottom: 12 }}>
                Downloaded and saved on file.{" "}
                {savedUrl && (
                  <a href={savedUrl} target="_blank" rel="noreferrer">
                    Open saved copy
                  </a>
                )}
              </div>
            )}
            <button className="btn" style={{ width: "100%" }} onClick={handleGenerate} disabled={busy}>
              {busy ? "Generating…" : "Generate, sign & download PDF"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
