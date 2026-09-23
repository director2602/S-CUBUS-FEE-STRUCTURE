"use client";

import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BATCH_GROUP_ORDER, formatINR, type Batch } from "@/lib/fee-calc";

type Row = Batch & { _dirty?: boolean; _isNew?: boolean };

function slugify(label: string) {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "batch"
  );
}

const blankRow = (sortOrder: number): Row => ({
  key: "",
  label: "",
  group_name: "Other",
  reg_fee: 0,
  tuition_fee: 0,
  kit_fee: 0,
  default_scholarship_pct: 0,
  sort_order: sortOrder,
  active: true,
  _isNew: true,
  _dirty: true
});

export default function FeeStructureEditor({ initialBatches }: { initialBatches: Batch[] }) {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<Row[]>(initialBatches.map((b) => ({ ...b })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const dirtyCount = useMemo(() => rows.filter((r) => r._dirty).length, [rows]);

  function updateRow(idx: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch, _dirty: true } : r)));
    setSavedMsg(null);
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow(Math.max(0, ...prev.map((r) => r.sort_order)) + 1)]);
  }

  function removeUnsavedRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSaveAll() {
    setError(null);
    setSavedMsg(null);

    const dirty = rows.filter((r) => r._dirty);
    if (dirty.length === 0) return;

    for (const r of dirty) {
      if (!r.label.trim()) {
        setError("Every row needs a batch name before saving.");
        return;
      }
    }

    // assign keys to brand-new rows now, from their label, guaranteed unique against current rows
    const existingKeys = new Set(rows.filter((r) => !r._isNew).map((r) => r.key));
    const finalRows = rows.map((r) => {
      if (!r._isNew) return r;
      let key = slugify(r.label);
      let candidate = key;
      let i = 2;
      while (existingKeys.has(candidate)) {
        candidate = `${key}_${i++}`;
      }
      existingKeys.add(candidate);
      return { ...r, key: candidate };
    });

    setRows(finalRows);
    setSaving(true);

    const payload = finalRows
      .filter((r) => r._dirty)
      .map(({ _dirty, _isNew, ...b }) => b);

    const { error } = await supabase.from("batches").upsert(payload, { onConflict: "key" });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setRows((prev) => prev.map((r) => ({ ...r, _dirty: false, _isNew: false })));
    setSavedMsg(`Saved ${dirty.length} batch${dirty.length === 1 ? "" : "es"}. New admissions will use these fees immediately.`);
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="kicker">Fee Master</span>
        <h2 className="card-title">Batches</h2>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="data" style={{ minWidth: 920 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 160 }}>Batch name</th>
              <th style={{ minWidth: 130 }}>Group</th>
              <th style={{ textAlign: "right" }}>Registration</th>
              <th style={{ textAlign: "right" }}>Tuition</th>
              <th style={{ textAlign: "right" }}>Kit fee</th>
              <th style={{ textAlign: "right" }}>Scholarship %</th>
              <th style={{ textAlign: "right" }}>Gross</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r._isNew ? `new-${idx}` : r.key}>
                <td>
                  <input value={r.label} onChange={(e) => updateRow(idx, { label: e.target.value })} placeholder="e.g. Foundation Class 11" />
                  {!r._isNew && <div className="comp-hint">{r.key}</div>}
                </td>
                <td>
                  <select value={r.group_name} onChange={(e) => updateRow(idx, { group_name: e.target.value })}>
                    {[...BATCH_GROUP_ORDER].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input className="money-input" type="number" min={0} value={r.reg_fee} onChange={(e) => updateRow(idx, { reg_fee: parseFloat(e.target.value) || 0 })} style={{ textAlign: "right" }} />
                </td>
                <td>
                  <input className="money-input" type="number" min={0} value={r.tuition_fee} onChange={(e) => updateRow(idx, { tuition_fee: parseFloat(e.target.value) || 0 })} style={{ textAlign: "right" }} />
                </td>
                <td>
                  <input className="money-input" type="number" min={0} value={r.kit_fee} onChange={(e) => updateRow(idx, { kit_fee: parseFloat(e.target.value) || 0 })} style={{ textAlign: "right" }} />
                </td>
                <td>
                  <input className="money-input" type="number" min={0} max={100} step={0.5} value={r.default_scholarship_pct} onChange={(e) => updateRow(idx, { default_scholarship_pct: parseFloat(e.target.value) || 0 })} style={{ textAlign: "right" }} />
                </td>
                <td className="amt">{formatINR(r.reg_fee + r.tuition_fee + r.kit_fee)}</td>
                <td>
                  <input type="checkbox" checked={r.active} onChange={(e) => updateRow(idx, { active: e.target.checked })} />
                </td>
                <td>
                  {r._isNew && (
                    <button className="reset-btn" onClick={() => removeUnsavedRow(idx)}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="btn secondary small" style={{ marginTop: 16 }} onClick={addRow}>
        + Add batch
      </button>

      <div style={{ height: 1, background: "var(--line)", margin: "20px 0" }} />

      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
      {savedMsg && <div className="success-text" style={{ marginBottom: 12 }}>{savedMsg}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button className="btn" onClick={handleSaveAll} disabled={saving || dirtyCount === 0}>
          {saving ? "Saving…" : dirtyCount > 0 ? `Save & finalize ${dirtyCount} change${dirtyCount === 1 ? "" : "s"}` : "No changes to save"}
        </button>
        <span className="comp-hint">Unchecking "Active" retires a batch from the dropdown without deleting its history.</span>
      </div>
    </div>
  );
}
