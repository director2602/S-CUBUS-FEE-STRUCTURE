"use client";

import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatINR2, round2, type Payment } from "@/lib/fee-calc";

type Component = {
  key: "Registration" | "Installment 1" | "Installment 2" | "Installment 3";
  allotted: number;
  // Which admissions column this component's override lives in — null for Installment 3,
  // which always auto-balances to whatever's left so the four components keep summing to
  // actual_payable, exactly as agreed: never independently editable.
  overrideColumn: "reg_fee_override" | "inst1_override" | "inst2_override" | null;
  overrideValue: number | null;
  hint: string;
};

const cellTop = { verticalAlign: "top" } as const;

export default function FeeReconciliation({
  admissionId,
  payments,
  regFee,
  regFeeOverride,
  inst1,
  inst1Override,
  inst2,
  inst2Override,
  inst3,
  actualPayable,
  canEdit = true,
  onChanged
}: {
  admissionId: string;
  payments: Payment[];
  regFee: number;
  regFeeOverride: number | null;
  inst1: number;
  inst1Override: number | null;
  inst2: number;
  inst2Override: number | null;
  inst3: number;
  actualPayable: number;
  // False when viewing a student that isn't yours — the table still shows allotted/paid/balance,
  // just without the Edit / Reset-to-auto controls.
  canEdit?: boolean;
  onChanged?: () => void;
}) {
  const supabase = supabaseBrowser();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paidByLabel = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const p of payments) {
      const label = p.installment_label;
      totals[label] = (totals[label] || 0) + Number(p.amount || 0);
    }
    return totals;
  }, [payments]);

  const components: Component[] = [
    {
      key: "Registration",
      allotted: regFee,
      overrideColumn: "reg_fee_override",
      overrideValue: regFeeOverride,
      hint: "Sets the registration fee itself."
    },
    {
      key: "Installment 1",
      allotted: inst1,
      overrideColumn: "inst1_override",
      overrideValue: inst1Override,
      hint: "Default: 40% of the remainder."
    },
    {
      key: "Installment 2",
      allotted: inst2,
      overrideColumn: "inst2_override",
      overrideValue: inst2Override,
      hint: "Default: half of what's left."
    },
    {
      key: "Installment 3",
      allotted: inst3,
      overrideColumn: null,
      overrideValue: null,
      hint: "Always auto-balances."
    }
  ];

  const otherPaid = paidByLabel["Other"] || 0;

  function startEdit(c: Component) {
    setEditingKey(c.key);
    setEditValue(c.overrideValue != null ? String(c.overrideValue) : String(c.allotted));
    setError(null);
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditValue("");
    setError(null);
  }

  async function saveEdit(c: Component) {
    if (!c.overrideColumn) return;
    const val = parseFloat(editValue);
    if (Number.isNaN(val) || val < 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updErr } = await supabase
      .from("admissions")
      .update({ [c.overrideColumn]: val })
      .eq("id", admissionId);
    setSaving(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    setEditingKey(null);
    onChanged?.();
  }

  async function resetToAuto(c: Component) {
    if (!c.overrideColumn) return;
    setSaving(true);
    setError(null);
    const { error: updErr } = await supabase
      .from("admissions")
      .update({ [c.overrideColumn]: null })
      .eq("id", admissionId);
    setSaving(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    setEditingKey(null);
    onChanged?.();
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-head">
        <span className="kicker">Reconciliation</span>
        <h2 className="card-title">Fee breakup &mdash; allotted vs. paid</h2>
      </div>
      <p className="comp-hint" style={{ marginBottom: 14 }}>
        What's planned for each component vs. what's actually come in so far &mdash; a parent can pay a component
        like Registration in as many parts as needed, tagging each payment with the same label below, and it all
        reconciles here.
      </p>

      <div style={{ overflowX: "auto" }}>
        <table className="data" style={{ minWidth: 620 }}>
          <thead>
            <tr>
              <th style={{ width: 160 }}>Component</th>
              <th style={{ textAlign: "right", width: 130 }}>Allotted</th>
              <th style={{ textAlign: "right", width: 110 }}>Paid</th>
              <th style={{ textAlign: "right", width: 110 }}>Balance</th>
              <th style={{ width: 140 }}></th>
            </tr>
          </thead>
          <tbody>
            {components.map((c) => {
              const paid = paidByLabel[c.key] || 0;
              const balance = round2(c.allotted - paid);
              const isEditing = editingKey === c.key;
              return (
                <tr key={c.key}>
                  <td style={cellTop}>
                    <div style={{ fontWeight: 600 }}>{c.key}</div>
                    <div className="comp-hint" style={{ marginTop: 2, whiteSpace: "nowrap" }}>{c.hint}</div>
                  </td>
                  <td className="amt" style={cellTop}>
                    {isEditing ? (
                      <input
                        className="money-input"
                        type="number"
                        min={0}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        style={{ width: 100, textAlign: "right" }}
                        autoFocus
                      />
                    ) : (
                      <>
                        <div>{formatINR2(c.allotted)}</div>
                        {c.overrideColumn && c.overrideValue != null && (
                          <div className="comp-hint" style={{ marginTop: 2 }}>manually set</div>
                        )}
                      </>
                    )}
                  </td>
                  <td className="amt" style={cellTop}>{paid > 0 ? formatINR2(paid) : "—"}</td>
                  <td className="amt" style={cellTop}>
                    <span
                      style={
                        balance < 0
                          ? { color: "#c0392b", fontWeight: 700, whiteSpace: "nowrap" }
                          : balance === 0
                            ? { color: "#2b6b45", fontWeight: 700 }
                            : { whiteSpace: "nowrap" }
                      }
                    >
                      {balance < 0 ? `+${formatINR2(Math.abs(balance))} over` : balance === 0 ? "Settled" : formatINR2(balance)}
                    </span>
                  </td>
                  <td style={cellTop}>
                    {canEdit && c.overrideColumn &&
                      (isEditing ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                          <button className="reset-btn" disabled={saving} onClick={() => saveEdit(c)}>
                            {saving ? "Saving…" : "Save"}
                          </button>
                          <button className="reset-btn" disabled={saving} onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                          <button className="reset-btn" onClick={() => startEdit(c)}>
                            Edit
                          </button>
                          {c.overrideValue != null && (
                            <button className="reset-btn" disabled={saving} onClick={() => resetToAuto(c)}>
                              Reset to auto
                            </button>
                          )}
                        </div>
                      ))}
                  </td>
                </tr>
              );
            })}
            {otherPaid > 0 && (
              <tr>
                <td style={cellTop}>
                  <div style={{ fontWeight: 600 }}>Other</div>
                  <div className="comp-hint" style={{ marginTop: 2 }}>Not part of the 4-part plan.</div>
                </td>
                <td className="amt" style={cellTop}>—</td>
                <td className="amt" style={cellTop}>{formatINR2(otherPaid)}</td>
                <td className="amt" style={cellTop}>—</td>
                <td style={cellTop}></td>
              </tr>
            )}
            <tr>
              <td style={cellTop}>
                <strong>Total</strong>
              </td>
              <td className="amt" style={cellTop}>
                <strong>{formatINR2(actualPayable)}</strong>
              </td>
              <td className="amt" style={cellTop}>
                <strong>{formatINR2(Object.values(paidByLabel).reduce((s, v) => s + v, 0))}</strong>
              </td>
              <td colSpan={2} style={cellTop} />
            </tr>
          </tbody>
        </table>
      </div>
      {error && <div className="error-text" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}
