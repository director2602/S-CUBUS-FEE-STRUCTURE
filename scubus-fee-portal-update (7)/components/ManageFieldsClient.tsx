"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { slugifyFieldKey, type CustomFieldDef, type FieldEntity, type FieldType } from "@/lib/custom-fields";

type Row = CustomFieldDef & { _isNew?: boolean; _dirty?: boolean };

function blankRow(entity: FieldEntity, sortOrder: number): Row {
  return {
    id: `new-${Math.random().toString(36).slice(2)}`,
    entity,
    field_key: "",
    label: "",
    field_type: "text",
    options: [],
    sort_order: sortOrder,
    active: true,
    _isNew: true,
    _dirty: true
  };
}

function FieldsSection({
  entity,
  title,
  hint,
  rows,
  setRows
}: {
  entity: FieldEntity;
  title: string;
  hint: string;
  rows: Row[];
  setRows: (fn: (prev: Row[]) => Row[]) => void;
}) {
  const supabase = supabaseBrowser();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const dirtyCount = rows.filter((r) => r._dirty).length;

  function updateRow(idx: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch, _dirty: true } : r)));
    setSavedMsg(null);
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow(entity, Math.max(0, ...prev.map((r) => r.sort_order)) + 1)]);
  }

  async function handleDelete(row: Row) {
    if (row._isNew) {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      return;
    }
    if (!window.confirm(`Delete the "${row.label || row.field_key}" field? Values already saved for it stay on each record but won't be shown or editable anymore.`)) {
      return;
    }
    const { error } = await supabase.from("custom_field_defs").delete().eq("id", row.id);
    if (error) {
      setError(error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setSavedMsg("Field deleted.");
  }

  async function handleSaveAll() {
    setError(null);
    setSavedMsg(null);

    const dirty = rows.filter((r) => r._dirty);
    if (!dirty.length) return;
    for (const r of dirty) {
      if (!r.label.trim()) {
        setError("Every field needs a name before saving.");
        return;
      }
      if (r.field_type === "dropdown" && r.options.length === 0) {
        setError(`"${r.label}" is a dropdown but has no options — add at least one, or change its type.`);
        return;
      }
    }

    const existingKeys = new Set(rows.filter((r) => !r._isNew).map((r) => r.field_key));
    const finalRows = rows.map((r) => {
      if (!r._isNew) return r;
      let key = slugifyFieldKey(r.label);
      let candidate = key;
      let i = 2;
      while (existingKeys.has(candidate)) candidate = `${key}_${i++}`;
      existingKeys.add(candidate);
      return { ...r, field_key: candidate };
    });
    setRows(() => finalRows);

    setSaving(true);
    const payload = finalRows
      .filter((r) => r._dirty)
      .map(({ id, _isNew, _dirty, ...rest }) => (_isNew ? rest : { id, ...rest }));

    const { error } = await supabase.from("custom_field_defs").upsert(payload, { onConflict: "entity,field_key" });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setRows((prev) => prev.map((r) => ({ ...r, _dirty: false, _isNew: false })));
    setSavedMsg(`Saved ${dirty.length} field${dirty.length === 1 ? "" : "s"}.`);
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="kicker">Custom fields</span>
        <h2 className="card-title">{title}</h2>
      </div>
      <p className="comp-hint" style={{ marginBottom: 14 }}>{hint}</p>

      <div style={{ overflowX: "auto" }}>
        <table className="data" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 180 }}>Field name</th>
              <th style={{ minWidth: 120 }}>Type</th>
              <th style={{ minWidth: 220 }}>Dropdown options (comma-separated)</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.id}>
                <td>
                  <input value={r.label} onChange={(e) => updateRow(idx, { label: e.target.value })} placeholder="e.g. Referred by" />
                  {!r._isNew && <div className="comp-hint">{r.field_key}</div>}
                </td>
                <td>
                  <select value={r.field_type} onChange={(e) => updateRow(idx, { field_type: e.target.value as FieldType })}>
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="dropdown">Dropdown</option>
                  </select>
                </td>
                <td>
                  <input
                    value={r.options.join(", ")}
                    disabled={r.field_type !== "dropdown"}
                    onChange={(e) =>
                      updateRow(idx, {
                        options: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                      })
                    }
                    placeholder={r.field_type === "dropdown" ? "e.g. Friend, Social media, Walk-in" : "—"}
                  />
                </td>
                <td>
                  <input type="checkbox" checked={r.active} onChange={(e) => updateRow(idx, { active: e.target.checked })} />
                </td>
                <td>
                  <button className="reset-btn" onClick={() => handleDelete(r)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="comp-hint">
                  No custom fields yet — add one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button className="btn secondary small" style={{ marginTop: 16 }} onClick={addRow}>
        + Add field
      </button>

      <div style={{ height: 1, background: "var(--line)", margin: "20px 0" }} />

      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
      {savedMsg && <div className="success-text" style={{ marginBottom: 12 }}>{savedMsg}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button className="btn" onClick={handleSaveAll} disabled={saving || dirtyCount === 0}>
          {saving ? "Saving…" : dirtyCount > 0 ? `Save ${dirtyCount} change${dirtyCount === 1 ? "" : "s"}` : "No changes to save"}
        </button>
        <span className="comp-hint">Unchecking "Active" hides a field from the form without deleting values already saved for it.</span>
      </div>
    </div>
  );
}

export default function ManageFieldsClient({ initialDefs }: { initialDefs: CustomFieldDef[] }) {
  const [admissionRows, setAdmissionRows] = useState<Row[]>(
    initialDefs.filter((d) => d.entity === "admission").map((d) => ({ ...d }))
  );
  const [batchRows, setBatchRows] = useState<Row[]>(initialDefs.filter((d) => d.entity === "batch").map((d) => ({ ...d })));

  return (
    <div className="stack">
      <FieldsSection
        entity="admission"
        title="Admission form fields"
        hint="These show up as extra fields on the Student & Admission card in the Calculator, and save onto each admission record."
        rows={admissionRows}
        setRows={setAdmissionRows}
      />
      <FieldsSection
        entity="batch"
        title="Fee structure fields"
        hint="These show up as extra columns on the Fee Structure page, one value per batch."
        rows={batchRows}
        setRows={setBatchRows}
      />
    </div>
  );
}
