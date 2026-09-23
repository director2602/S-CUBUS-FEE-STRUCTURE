"use client";

import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BATCH_GROUP_ORDER, computeFees, formatINR, type Batch } from "@/lib/fee-calc";

type Student = {
  scid: string;
  name: string;
  mother: string;
  father: string;
  email: string;
  phone1: string;
  phone2: string;
  admissionDate: string;
  batchStart: string;
};

type Notes = {
  modeReg: string;
  mode1: string;
  mode2: string;
  mode3: string;
  pdc1: string;
  pdc2: string;
  remarks: string;
};

const emptyStudent: Student = {
  scid: "",
  name: "",
  mother: "",
  father: "",
  email: "",
  phone1: "",
  phone2: "",
  admissionDate: "",
  batchStart: ""
};

const emptyNotes: Notes = { modeReg: "", mode1: "", mode2: "", mode3: "", pdc1: "", pdc2: "", remarks: "" };

export default function CalculatorForm({
  batches,
  counselorId,
  onSaved,
  mode = "create",
  admissionId,
  initial
}: {
  batches: Batch[];
  counselorId: string;
  onSaved?: () => void;
  mode?: "create" | "edit";
  admissionId?: string;
  initial?: any;
}) {
  const supabase = supabaseBrowser();
  const [batchKey, setBatchKey] = useState(initial?.batch_key ?? batches[0]?.key ?? "");
  const [regOverride, setRegOverride] = useState<number | null>(initial?.reg_fee_override ?? null);
  const [tuitionOverride, setTuitionOverride] = useState<number | null>(initial?.tuition_fee_override ?? null);
  const [kitOverride, setKitOverride] = useState<number | null>(initial?.kit_fee_override ?? null);
  const [scholarshipPct, setScholarshipPct] = useState<number | null>(initial?.scholarship_pct ?? null);
  const [gstRate, setGstRate] = useState(initial?.gst_rate ?? 18);
  const [additionalDiscount, setAdditionalDiscount] = useState(initial?.additional_discount ?? 0);
  const [actualFeesPaid, setActualFeesPaid] = useState(initial?.actual_fees_paid ?? 0);
  const [student, setStudent] = useState<Student>(
    initial
      ? {
          scid: initial.scid ?? "",
          name: initial.student_name ?? "",
          mother: initial.mother_name ?? "",
          father: initial.father_name ?? "",
          email: initial.email ?? "",
          phone1: initial.phone1 ?? "",
          phone2: initial.phone2 ?? "",
          admissionDate: initial.admission_date ?? "",
          batchStart: initial.batch_commencement_date ?? ""
        }
      : emptyStudent
  );
  const [notes, setNotes] = useState<Notes>(
    initial
      ? {
          modeReg: initial.mode_reg ?? "",
          mode1: initial.mode1 ?? "",
          mode2: initial.mode2 ?? "",
          mode3: initial.mode3 ?? "",
          pdc1: initial.pdc1 ?? "",
          pdc2: initial.pdc2 ?? "",
          remarks: initial.remarks ?? ""
        }
      : emptyNotes
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const batch = useMemo(() => batches.find((b) => b.key === batchKey) ?? batches[0], [batches, batchKey]);
  const groups = useMemo(
    () =>
      BATCH_GROUP_ORDER.map((g) => ({ group: g, items: batches.filter((b) => b.group_name === g) })).filter(
        (g) => g.items.length
      ),
    [batches]
  );

  const result = useMemo(() => {
    if (!batch) return null;
    return computeFees({
      batch,
      regOverride,
      tuitionOverride,
      kitOverride,
      scholarshipPct,
      gstRate,
      additionalDiscount,
      actualFeesPaid
    });
  }, [batch, regOverride, tuitionOverride, kitOverride, scholarshipPct, gstRate, additionalDiscount, actualFeesPaid]);

  function resetAllForNewBatch(key: string) {
    setBatchKey(key);
    setRegOverride(null);
    setTuitionOverride(null);
    setKitOverride(null);
  }

  async function handleSave() {
    if (!batch || !student.name.trim()) {
      setError("Enter the student's name before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    setSavedMsg(null);

    const payload = {
      scid: student.scid || null,
      student_name: student.name,
      mother_name: student.mother || null,
      father_name: student.father || null,
      email: student.email || null,
      phone1: student.phone1 || null,
      phone2: student.phone2 || null,
      admission_date: student.admissionDate || null,
      batch_commencement_date: student.batchStart || null,
      batch_key: batch.key,
      // Always store the actual effective numbers (never null) so this admission is a frozen
      // snapshot: a later change to the batch's base fee structure (a fee revision) must never
      // retroactively alter a fee that was already calculated and agreed with a student.
      reg_fee_override: regOverride ?? batch.reg_fee,
      tuition_fee_override: tuitionOverride ?? batch.tuition_fee,
      kit_fee_override: kitOverride ?? batch.kit_fee,
      scholarship_pct: scholarshipPct ?? batch.default_scholarship_pct,
      gst_rate: gstRate,
      additional_discount: additionalDiscount,
      actual_fees_paid: actualFeesPaid,
      mode_reg: notes.modeReg || null,
      mode1: notes.mode1 || null,
      mode2: notes.mode2 || null,
      mode3: notes.mode3 || null,
      pdc1: notes.pdc1 || null,
      pdc2: notes.pdc2 || null,
      remarks: notes.remarks || null
    };

    const { error } =
      mode === "edit" && admissionId
        ? await supabase.from("admissions").update(payload).eq("id", admissionId)
        : await supabase.from("admissions").insert({ ...payload, counselor_id: counselorId });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }

    if (mode === "edit") {
      setSavedMsg("Changes saved.");
      onSaved?.();
      return;
    }

    setSavedMsg(`Saved ${student.name}'s admission.`);
    setStudent(emptyStudent);
    setNotes(emptyNotes);
    setScholarshipPct(null);
    setAdditionalDiscount(0);
    setActualFeesPaid(0);
    setRegOverride(null);
    setTuitionOverride(null);
    setKitOverride(null);
    onSaved?.();
  }

  if (!batch || !result) return null;

  return (
    <div className="grid-2">
      <div className="stack">
        <div className="card">
          <div className="card-head">
            <span className="kicker">01</span>
            <h2 className="card-title">Student &amp; Admission</h2>
          </div>
          <div className="field-grid">
            <div className="field">
              <label>SCID</label>
              <input value={student.scid} onChange={(e) => setStudent({ ...student, scid: e.target.value })} placeholder="27SC00000001" />
            </div>
            <div className="field">
              <label>Student name</label>
              <input value={student.name} onChange={(e) => setStudent({ ...student, name: e.target.value })} placeholder="e.g. Mehak" />
            </div>
            <div className="field">
              <label>Mother's name</label>
              <input value={student.mother} onChange={(e) => setStudent({ ...student, mother: e.target.value })} />
            </div>
            <div className="field">
              <label>Father's name</label>
              <input value={student.father} onChange={(e) => setStudent({ ...student, father: e.target.value })} />
            </div>
            <div className="field full">
              <label>Email</label>
              <input type="email" value={student.email} onChange={(e) => setStudent({ ...student, email: e.target.value })} />
            </div>
            <div className="field">
              <label>Contact (primary)</label>
              <input value={student.phone1} onChange={(e) => setStudent({ ...student, phone1: e.target.value })} />
            </div>
            <div className="field">
              <label>Contact (secondary)</label>
              <input value={student.phone2} onChange={(e) => setStudent({ ...student, phone2: e.target.value })} />
            </div>
            <div className="field">
              <label>Date of admission</label>
              <input type="date" value={student.admissionDate} onChange={(e) => setStudent({ ...student, admissionDate: e.target.value })} />
            </div>
            <div className="field">
              <label>Batch commencement</label>
              <input type="date" value={student.batchStart} onChange={(e) => setStudent({ ...student, batchStart: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="kicker">05</span>
            <h2 className="card-title">Payment Mode &amp; Notes</h2>
          </div>
          <div className="field-grid">
            <div className="field">
              <label>Registration fee mode</label>
              <input value={notes.modeReg} onChange={(e) => setNotes({ ...notes, modeReg: e.target.value })} placeholder="e.g. UPI" />
            </div>
            <div className="field">
              <label>Installment 1 mode</label>
              <input value={notes.mode1} onChange={(e) => setNotes({ ...notes, mode1: e.target.value })} placeholder="e.g. Online transfer" />
            </div>
            <div className="field">
              <label>Installment 2 mode</label>
              <input value={notes.mode2} onChange={(e) => setNotes({ ...notes, mode2: e.target.value })} placeholder="e.g. PDC" />
            </div>
            <div className="field">
              <label>Installment 3 mode</label>
              <input value={notes.mode3} onChange={(e) => setNotes({ ...notes, mode3: e.target.value })} />
            </div>
            <div className="field">
              <label>PDC cheque no. 1</label>
              <input value={notes.pdc1} onChange={(e) => setNotes({ ...notes, pdc1: e.target.value })} placeholder="000123" />
            </div>
            <div className="field">
              <label>PDC cheque no. 2</label>
              <input value={notes.pdc2} onChange={(e) => setNotes({ ...notes, pdc2: e.target.value })} placeholder="000124" />
            </div>
            <div className="field full">
              <label>Remarks</label>
              <input value={notes.remarks} onChange={(e) => setNotes({ ...notes, remarks: e.target.value })} placeholder="e.g. Balance via post-dated cheque" />
            </div>
          </div>
        </div>
      </div>

      <div className="stack">
        <div className="card">
          <div className="card-head">
            <span className="kicker">02</span>
            <h2 className="card-title">Batch &amp; Fee Components</h2>
          </div>
          <div className="field full" style={{ marginBottom: 18 }}>
            <label>Batch</label>
            <select value={batchKey} onChange={(e) => resetAllForNewBatch(e.target.value)} style={{ fontWeight: 600, fontSize: 16, padding: "12px 13px" }}>
              {groups.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="comp-row">
            <div>
              <div>Registration fee</div>
              <div className="comp-hint">Batch default: {formatINR(batch.reg_fee)}</div>
            </div>
            <input className="money-input" type="number" value={regOverride ?? batch.reg_fee} onChange={(e) => setRegOverride(e.target.value === "" ? null : parseFloat(e.target.value))} />
            <button className="reset-btn" disabled={regOverride == null} onClick={() => setRegOverride(null)}>
              Reset
            </button>
          </div>
          <div className="comp-row">
            <div>
              <div>Tuition fee</div>
              <div className="comp-hint">Batch default: {formatINR(batch.tuition_fee)}</div>
            </div>
            <input className="money-input" type="number" value={tuitionOverride ?? batch.tuition_fee} onChange={(e) => setTuitionOverride(e.target.value === "" ? null : parseFloat(e.target.value))} />
            <button className="reset-btn" disabled={tuitionOverride == null} onClick={() => setTuitionOverride(null)}>
              Reset
            </button>
          </div>
          <div className="comp-row">
            <div>
              <div>Kit fee</div>
              <div className="comp-hint">Module + technology + uniform &mdash; batch default: {formatINR(batch.kit_fee)}</div>
            </div>
            <input className="money-input" type="number" value={kitOverride ?? batch.kit_fee} onChange={(e) => setKitOverride(e.target.value === "" ? null : parseFloat(e.target.value))} />
            <button className="reset-btn" disabled={kitOverride == null} onClick={() => setKitOverride(null)}>
              Reset
            </button>
          </div>

          <div className="sum-row total">
            <span className="sum-label strong">Gross fee</span>
            <span className="sum-val big">{formatINR(result.grossFee)}</span>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="kicker">03</span>
            <h2 className="card-title">Scholarship &amp; GST</h2>
          </div>
          <div className="field-grid" style={{ marginBottom: 8 }}>
            <div className="field">
              <label>Scholarship % (on tuition fee)</label>
              <input className="money-input" type="number" step={0.5} min={0} max={100} value={scholarshipPct ?? batch.default_scholarship_pct} onChange={(e) => setScholarshipPct(e.target.value === "" ? null : parseFloat(e.target.value))} />
              <div className="comp-hint">Standard for this batch: {batch.default_scholarship_pct}%</div>
            </div>
            <div className="field">
              <label>GST rate</label>
              <input className="money-input" type="number" step={0.5} min={0} max={28} value={gstRate} onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
          <div className="sum-row">
            <span className="sum-label">Scholarship amount</span>
            <span className="sum-val">&minus; {formatINR(result.scholarshipAmount)}</span>
          </div>
          <div className="sum-row">
            <span className="sum-label">Net payable (excl. GST)</span>
            <span className="sum-val">{formatINR(result.netExclGst)}</span>
          </div>
          <div className="sum-row">
            <span className="sum-label">GST @ {gstRate}%</span>
            <span className="sum-val">+ {formatINR(result.gstAmount)}</span>
          </div>
          <div className="sum-row total">
            <span className="sum-label strong">Net payable (incl. GST)</span>
            <span className="sum-val big">{formatINR(result.netInclGst)}</span>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="kicker">04</span>
            <h2 className="card-title">Discount &amp; Payment Status</h2>
          </div>
          <div className="field-grid" style={{ marginBottom: 8 }}>
            <div className="field">
              <label>Additional discount</label>
              <input className="money-input" type="number" min={0} value={additionalDiscount} onChange={(e) => setAdditionalDiscount(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="field">
              <label>Fees paid {mode === "edit" ? "(at admission)" : "at admission"}</label>
              <input className="money-input" type="number" min={0} value={actualFeesPaid} onChange={(e) => setActualFeesPaid(parseFloat(e.target.value) || 0)} />
              <div className="comp-hint">
                {mode === "edit"
                  ? "This is the opening amount only. Log every installment paid after admission from the Payments panel on this admission's page — it adds on top of this figure."
                  : "Amount collected right now, if any. Once saved, log each later installment from the admission's Payments panel so the running total stays accurate."}
              </div>
            </div>
          </div>
          {mode === "edit" && initial?.payments_count > 0 && (
            <div className="comp-hint" style={{ marginBottom: 8 }}>
              Plus {formatINR(initial.payments_total)} already logged across {initial.payments_count} tracked
              installment{initial.payments_count === 1 ? "" : "s"} &mdash; the figures below don't include those
              until you save; see the Payments panel for the true running total.
            </div>
          )}
          <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
          <div className="sum-row">
            <span className="sum-label strong">Actual fee payable</span>
            <span className="sum-val big">{formatINR(result.actualPayable)}</span>
          </div>
          <div className="sum-row">
            <span className="sum-label">Net outstanding {mode === "edit" && initial?.payments_count > 0 ? "(excl. tracked installments)" : ""}</span>
            <span className="sum-val">{formatINR(Math.max(result.outstanding, 0))}</span>
          </div>
          <div className="sum-row">
            <span className="sum-label">Billing status</span>
            <span className={`badge ${result.billingStatus === "Paid in Full" ? "good" : result.billingStatus === "Unpaid" ? "bad" : "warn"}`}>
              {result.billingStatus}
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="kicker">06</span>
            <h2 className="card-title">Installment Schedule</h2>
          </div>
          <table className="data">
            <thead>
              <tr>
                <th>Stage</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>On registration</td>
                <td className="amt">{formatINR(result.installments.inst0)}</td>
              </tr>
              <tr>
                <td>1st &mdash; before batch commencement (40% of balance)</td>
                <td className="amt">{formatINR(result.installments.inst1)}</td>
              </tr>
              <tr>
                <td>2nd &mdash; by the 20th of month 2</td>
                <td className="amt">{formatINR(result.installments.inst2)}</td>
              </tr>
              <tr>
                <td>3rd &mdash; by the 20th of month 4</td>
                <td className="amt">{formatINR(result.installments.inst3)}</td>
              </tr>
              <tr>
                <td>
                  <strong>Total of installments</strong>
                </td>
                <td className="amt">
                  <strong>{formatINR(result.installments.total)}</strong>
                </td>
              </tr>
            </tbody>
          </table>

          {error && <div className="error-text" style={{ marginTop: 12 }}>{error}</div>}
          {savedMsg && <div className="success-text" style={{ marginTop: 12 }}>{savedMsg}</div>}
          <button className="btn" style={{ marginTop: 16, width: "100%" }} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Save admission"}
          </button>
        </div>
      </div>
    </div>
  );
}
