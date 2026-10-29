"use client";

import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CARD_CHARGE_RATE, computeCardCharge, formatINR, INSTALLMENT_LABELS, PAYMENT_MODES, type Payment } from "@/lib/fee-calc";

const CARD_MODE = "Debit/Credit Card";

function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const emptyDraft = {
  installment_label: "Installment 1" as (typeof INSTALLMENT_LABELS)[number],
  amount: "",
  paid_on: todayISO(),
  mode: "",
  note: "",
  cardCharge: false
};

export default function PaymentsPanel({
  admissionId,
  counselorId,
  initialPayments,
  baseAmount,
  gstRate,
  canEdit = true,
  onChanged
}: {
  admissionId: string;
  counselorId: string;
  initialPayments: Payment[];
  baseAmount: number;
  // This admission's GST rate — the card/POS convenience charge is taxed at the same rate
  // as the fee itself, so it travels through as a prop rather than being hardcoded here.
  gstRate: number;
  // False when viewing a student that isn't yours — the payment history and "Invoice" links
  // still show (read access is company-wide for counselors), but recording, editing or
  // deleting a payment stays limited to that student's own counselor or the owner.
  canEdit?: boolean;
  onChanged?: () => void;
}) {
  const supabase = supabaseBrowser();
  const [payments, setPayments] = useState<Payment[]>(
    [...initialPayments].sort((a, b) => (a.paid_on < b.paid_on ? 1 : -1))
  );
  const [draft, setDraft] = useState({ ...emptyDraft });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ ...emptyDraft });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trackedTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const cardChargeTotal = payments.reduce((s, p) => s + Number(p.card_charge_amount || 0), 0);

  function resortAndSet(rows: Payment[]) {
    setPayments([...rows].sort((a, b) => (a.paid_on < b.paid_on ? 1 : -1)));
  }

  // Ticking "add card charge" auto-selects the card mode; manually switching the mode away
  // from it clears the charge again, since the surcharge only makes sense for a card/POS
  // payment — these two stay in sync in both directions.
  function setDraftCardCharge(on: boolean) {
    setDraft((d) => ({ ...d, cardCharge: on, mode: on ? CARD_MODE : d.mode }));
  }
  function setDraftMode(mode: string) {
    setDraft((d) => ({ ...d, mode, cardCharge: mode === CARD_MODE ? d.cardCharge : false }));
  }
  function setEditCardCharge(on: boolean) {
    setEditDraft((d) => ({ ...d, cardCharge: on, mode: on ? CARD_MODE : d.mode }));
  }
  function setEditMode(mode: string) {
    setEditDraft((d) => ({ ...d, mode, cardCharge: mode === CARD_MODE ? d.cardCharge : false }));
  }

  const draftAmt = parseFloat(draft.amount) || 0;
  const draftCharge = draft.cardCharge ? computeCardCharge(draftAmt, gstRate) : null;
  const editAmt = parseFloat(editDraft.amount) || 0;
  const editCharge = editDraft.cardCharge ? computeCardCharge(editAmt, gstRate) : null;

  async function handleAdd() {
    const amt = parseFloat(draft.amount);
    if (!amt || amt <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("payments")
      .insert({
        admission_id: admissionId,
        installment_label: draft.installment_label,
        amount: amt,
        card_charge_amount: draft.cardCharge ? computeCardCharge(amt, gstRate).total : 0,
        paid_on: draft.paid_on || todayISO(),
        mode: draft.mode || null,
        note: draft.note || null,
        recorded_by: counselorId
      })
      .select()
      .single();
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    resortAndSet([...payments, data as Payment]);
    setDraft({ ...emptyDraft });
    onChanged?.();
  }

  function startEdit(p: Payment) {
    setEditingId(p.id);
    setEditDraft({
      installment_label: p.installment_label,
      amount: String(p.amount),
      paid_on: p.paid_on,
      mode: p.mode || "",
      note: p.note || "",
      cardCharge: Number(p.card_charge_amount || 0) > 0
    });
  }

  async function handleSaveEdit(id: string) {
    const amt = parseFloat(editDraft.amount);
    if (!amt || amt <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("payments")
      .update({
        installment_label: editDraft.installment_label,
        amount: amt,
        card_charge_amount: editDraft.cardCharge ? computeCardCharge(amt, gstRate).total : 0,
        paid_on: editDraft.paid_on,
        mode: editDraft.mode || null,
        note: editDraft.note || null
      })
      .eq("id", id)
      .select()
      .single();
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    resortAndSet(payments.map((p) => (p.id === id ? (data as Payment) : p)));
    setEditingId(null);
    onChanged?.();
  }

  async function handleDelete(id: string) {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("payments").delete().eq("id", id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    resortAndSet(payments.filter((p) => p.id !== id));
    onChanged?.();
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="kicker">Payments</span>
        <h2 className="card-title">Installments Received</h2>
      </div>
      <p className="comp-hint" style={{ marginBottom: 14 }}>
        {formatINR(baseAmount)} was recorded at admission. Log every installment as it comes in below &mdash; this
        keeps the outstanding balance and billing status accurate over the life of the admission.
      </p>

      {payments.length > 0 && (
        <table className="data" style={{ marginBottom: 16 }}>
          <thead>
            <tr>
              <th>Stage</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th style={{ textAlign: "right" }}>Card chg.</th>
              <th>Date</th>
              <th>Mode</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) =>
              canEdit && editingId === p.id ? (
                <tr key={p.id}>
                  <td>
                    <select
                      value={editDraft.installment_label}
                      onChange={(e) => setEditDraft({ ...editDraft, installment_label: e.target.value as any })}
                    >
                      {INSTALLMENT_LABELS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="money-input"
                      type="number"
                      min={0}
                      value={editDraft.amount}
                      onChange={(e) => setEditDraft({ ...editDraft, amount: e.target.value })}
                      style={{ textAlign: "right" }}
                    />
                  </td>
                  <td colSpan={3}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, whiteSpace: "nowrap" }}>
                      <input type="checkbox" checked={editDraft.cardCharge} onChange={(e) => setEditCardCharge(e.target.checked)} />
                      +{CARD_CHARGE_RATE}% card charge{editCharge ? ` (${formatINR(editCharge.total)})` : ""}
                    </label>
                    <select value={editDraft.mode} onChange={(e) => setEditMode(e.target.value)} style={{ marginTop: 6 }}>
                      <option value="">Select mode</option>
                      {PAYMENT_MODES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={editDraft.paid_on}
                      onChange={(e) => setEditDraft({ ...editDraft, paid_on: e.target.value })}
                      style={{ marginTop: 6 }}
                    />
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="reset-btn" disabled={saving} onClick={() => handleSaveEdit(p.id)}>
                        Save
                      </button>
                      <button className="reset-btn" disabled={saving} onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={p.id}>
                  <td>{p.installment_label}</td>
                  <td className="amt">{formatINR(p.amount)}</td>
                  <td className="amt">{Number(p.card_charge_amount || 0) > 0 ? formatINR(p.card_charge_amount) : "—"}</td>
                  <td>{fmtDate(p.paid_on)}</td>
                  <td>{p.mode || "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <Link className="reset-btn" href={`/admissions/${admissionId}/invoice?payment=${p.id}`}>
                        Invoice
                      </Link>
                      {canEdit && (
                        <>
                          <button className="reset-btn" disabled={saving} onClick={() => startEdit(p)}>
                            Edit
                          </button>
                          <button className="reset-btn" disabled={saving} onClick={() => handleDelete(p.id)}>
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            )}
            <tr>
              <td>
                <strong>Tracked total (fee)</strong>
              </td>
              <td className="amt">
                <strong>{formatINR(trackedTotal)}</strong>
              </td>
              <td className="amt">{cardChargeTotal > 0 ? formatINR(cardChargeTotal) : "—"}</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      )}

      {canEdit ? (
        <>
          <div className="field-grid" style={{ marginBottom: 10 }}>
            <div className="field">
              <label>Installment</label>
              <select value={draft.installment_label} onChange={(e) => setDraft({ ...draft, installment_label: e.target.value as any })}>
                {INSTALLMENT_LABELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Amount received</label>
              <input
                className="money-input"
                type="number"
                min={0}
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                placeholder="e.g. 25000"
              />
            </div>
            <div className="field">
              <label>Date paid</label>
              <input type="date" value={draft.paid_on} onChange={(e) => setDraft({ ...draft, paid_on: e.target.value })} />
            </div>
            <div className="field">
              <label>Mode</label>
              <select value={draft.mode} onChange={(e) => setDraftMode(e.target.value)}>
                <option value="">Select mode</option>
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              border: "1.5px solid var(--accent)",
              background: "rgba(64,12,77,0.04)",
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 14,
              cursor: "pointer"
            }}
          >
            <input
              type="checkbox"
              checked={draft.cardCharge}
              onChange={(e) => setDraftCardCharge(e.target.checked)}
              style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--accent)", flexShrink: 0 }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                Customer is paying by Card / QR on the POS machine &mdash; add {CARD_CHARGE_RATE}% card charge
              </div>
              <div className="comp-hint" style={{ marginTop: 2 }}>
                Ticking this selects &ldquo;{CARD_MODE}&rdquo; as the mode and adds a separate, GST-ed convenience-charge
                line to this payment&apos;s invoice &mdash; it does not reduce the student&apos;s fee due, only the
                amount above does that.
              </div>
              {draft.cardCharge && draftAmt > 0 && draftCharge && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    background: "#fff",
                    border: "1px dashed var(--line)",
                    borderRadius: 10,
                    fontSize: 12.5,
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    rowGap: 4
                  }}
                >
                  <div>{CARD_CHARGE_RATE}% of {formatINR(draftAmt)} fee received</div>
                  <div>{formatINR(draftCharge.base)}</div>
                  <div>+ GST @ {gstRate}% on that charge</div>
                  <div>{formatINR(draftCharge.gst)}</div>
                  <div style={{ fontWeight: 700, borderTop: "1px solid var(--line)", paddingTop: 5, marginTop: 1 }}>
                    Card charge added to invoice
                  </div>
                  <div style={{ fontWeight: 700, borderTop: "1px solid var(--line)", paddingTop: 5, marginTop: 1, color: "var(--accent)" }}>
                    {formatINR(draftCharge.total)}
                  </div>
                </div>
              )}
            </div>
          </label>

          <div className="field-grid" style={{ marginBottom: 10 }}>
            <div className="field full">
              <label>Note (optional)</label>
              <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="e.g. cheque no. 000123" />
            </div>
          </div>
          {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
          <button className="btn secondary small" disabled={saving} onClick={handleAdd}>
            {saving ? "Saving…" : "+ Record payment"}
          </button>
        </>
      ) : (
        <p className="comp-hint">
          You're viewing this student's payment history &mdash; only their own counselor or the owner can record,
          edit, or delete a payment here.
        </p>
      )}
    </div>
  );
}
