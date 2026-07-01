import { useEffect, useState } from "react";

const FIELD_DEFS = [
  ["employee_name", "Employee name"],
  ["amount", "Amount"],
  ["currency", "Currency"],
  ["location", "Location"],
  ["province_or_city", "Province / City"],
  ["date", "Date"],
  ["reason", "Reason"],
  ["purpose", "Purpose"],
  ["material_name", "Material name"],
  ["training_type", "Training type"],
  ["travel_type", "Travel type"],
];

export default function ExtractedFormEditor({ fields, onChange, disabled }) {
  const [local, setLocal] = useState(fields || {});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLocal(fields || {});
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fields]);

  function setField(key, value) {
    const next = { ...local, [key]: value === "" ? null : value };
    setLocal(next);
    onChange?.(next);
  }

  return (
    <div className="card">
      <div className="card-title">Extracted fields (editable)</div>
      <div className="grid">
        {FIELD_DEFS.map(([k, label]) => (
          <label key={k} className="field">
            <div className="field-label">{label}</div>
            <input
              value={local?.[k] ?? ""}
              disabled={disabled}
              onChange={(e) => setField(k, e.target.value)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
