"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatINR, INSTALLMENT_LABELS, type Payment } from "@/lib/fee-calc";

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
  note: ""
};

export default function PaymentsPanel({
  admissionId,
  counselorId,
  initialPayments,
  baseAmount,
  onChanged
}: {
  admissionId: string;
  counselorId: string;
  initialPayments: Payment[];
  baseAmount: number;
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

  function resortAndSet(rows: Payment[]) {
    setPayments([...rows].sort((a, b) => (a.paid_on < b.paid_on ? 1 : -1)));
  }

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
      note: p.note || ""
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
              <th>Date</th>
              <th>Mode</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) =>
              editingId === p.id ? (
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
                  <td>
                    <input type="date" value={editDraft.paid_on} onChange={(e) => setEditDraft({ ...editDraft, paid_on: e.target.value })} />
                  </td>
                  <td>
                    <input value={editDraft.mode} onChange={(e) => setEditDraft({ ...editDraft, mode: e.target.value })} placeholder="e.g. UPI" />
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
                  <td>{fmtDate(p.paid_on)}</td>
                  <td>{p.mode || "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="reset-btn" disabled={saving} onClick={() => startEdit(p)}>
                        Edit
                      </button>
                      <button className="reset-btn" disabled={saving} onClick={() => handleDelete(p.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
            <tr>
              <td>
                <strong>Tracked total</strong>
              </td>
              <td className="amt">
                <strong>{formatINR(trackedTotal)}</strong>
              </td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      )}

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
          <input value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value })} placeholder="e.g. UPI, cheque, cash" />
        </div>
        <div className="field full">
          <label>Note (optional)</label>
          <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="e.g. cheque no. 000123" />
        </div>
      </div>
      {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
      <button className="btn secondary small" disabled={saving} onClick={handleAdd}>
        {saving ? "Saving…" : "+ Record payment"}
      </button>
    </div>
  );
}
