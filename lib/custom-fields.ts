// Self-service custom fields: the owner defines extra fields (from the "Manage Fields" page)
// for either the admission form or the fee structure (batch) editor, without needing a code
// change. Definitions live in `custom_field_defs`; the values themselves live in a `custom_fields`
// jsonb column on `admissions` / `batches`, keyed by each field's `field_key`.

export type FieldEntity = "admission" | "batch";
export type FieldType = "text" | "number" | "date" | "dropdown";

export type CustomFieldDef = {
  id: string;
  entity: FieldEntity;
  field_key: string;
  label: string;
  field_type: FieldType;
  options: string[];
  sort_order: number;
  active: boolean;
};

export type CustomFieldValues = Record<string, string | number>;

export function slugifyFieldKey(label: string) {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "field"
  );
}

// Drop blank/null entries before saving so the jsonb column only ever holds real values —
// an unfilled optional field just doesn't appear in the record, rather than storing "".
export function cleanCustomFieldValues(values: Record<string, string | number | null | undefined>): CustomFieldValues {
  const out: CustomFieldValues = {};
  for (const [k, v] of Object.entries(values || {})) {
    if (v === null || v === undefined || v === "") continue;
    out[k] = v;
  }
  return out;
}
