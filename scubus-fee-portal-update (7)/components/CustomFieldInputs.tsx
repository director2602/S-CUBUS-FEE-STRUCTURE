"use client";

import type { CSSProperties } from "react";
import type { CustomFieldDef } from "@/lib/custom-fields";

// A single input matching a field's type — used both inline in a table cell (Fee Structure)
// and inside a `.field` wrapper (Admission form).
export function CustomFieldControl({
  def,
  value,
  onChange,
  style
}: {
  def: CustomFieldDef;
  value: string | number | null | undefined;
  onChange: (v: string) => void;
  style?: CSSProperties;
}) {
  if (def.field_type === "dropdown") {
    return (
      <select value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value)} style={style}>
        <option value="">—</option>
        {(def.options || []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={def.field_type === "number" ? "number" : def.field_type === "date" ? "date" : "text"}
      value={value == null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
      style={style}
    />
  );
}

// A fieldset of custom inputs for a `.field-grid` form (renders nothing if there are no
// active fields defined for this entity).
export default function CustomFieldInputs({
  defs,
  values,
  onChange
}: {
  defs: CustomFieldDef[];
  values: Record<string, string | number | null | undefined>;
  onChange: (key: string, value: string) => void;
}) {
  if (!defs.length) return null;
  return (
    <>
      {defs.map((f) => (
        <div className="field" key={f.id}>
          <label>{f.label}</label>
          <CustomFieldControl def={f} value={values[f.field_key]} onChange={(v) => onChange(f.field_key, v)} />
        </div>
      ))}
    </>
  );
}
