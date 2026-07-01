import { CATEGORY_OPTIONS, FIELD_META, getExtraFieldKeys } from "../constants/requestForms";

function renderFieldError(error) {
  return error ? <div className="assistant-summary__error-text">{error}</div> : null;
}

function splitNameParts(name) {
  const tokens = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!tokens.length) {
    return { firstName: "-", lastName: "-" };
  }

  if (tokens.length === 1) {
    return { firstName: tokens[0], lastName: "-" };
  }

  return {
    firstName: tokens[0],
    lastName: tokens.slice(1).join(" "),
  };
}

function renderReadonlyValue(value) {
  return value || "-";
}

export default function AssistantExtractionSummary({
  currentUser,
  managers = [],
  category,
  fields,
  fieldErrors,
  assignedManagerId,
  helperMessage,
  dirty,
  confirmed,
  disabled,
  saving,
  onCategoryChange,
  onAssignedManagerChange,
  onFieldChange,
  onSaveDetails,
  onCancelDetails,
  elementId,
}) {
  const extraFieldKeys = getExtraFieldKeys(category);
  const saveDisabled = disabled || saving || (!dirty && confirmed);
  const { firstName, lastName } = splitNameParts(currentUser?.name);
  const selectedManager = managers.find((manager) => manager.id === assignedManagerId);

  return (
    <section className="assistant-summary" id={elementId}>
      <div className="assistant-summary__card assistant-summary__card--compact">
        <div className="assistant-summary__sheet-head">
          <div className="assistant-summary__sheet-title">Information</div>
          {confirmed ? (
            <div className="assistant-summary__sheet-status">Details ready</div>
          ) : dirty ? (
            <div className="assistant-summary__sheet-status assistant-summary__sheet-status--pending">Unsaved changes</div>
          ) : null}
        </div>

        <div className="assistant-summary__sheet-body">
          <div className="assistant-summary__sheet-intro">
            Review the detected fields, correct anything missing, then save to prepare the request form.
          </div>

          <div className="assistant-summary__sheet-grid">
            <div className="assistant-summary__sheet-row assistant-summary__sheet-row--readonly">
              <div className="assistant-summary__sheet-label">First Name</div>
              <div className="assistant-summary__sheet-value">{renderReadonlyValue(firstName)}</div>
            </div>

            <div className="assistant-summary__sheet-row assistant-summary__sheet-row--readonly">
              <div className="assistant-summary__sheet-label">Last Name</div>
              <div className="assistant-summary__sheet-value">{renderReadonlyValue(lastName)}</div>
            </div>

            <div className="assistant-summary__sheet-row assistant-summary__sheet-row--readonly">
              <div className="assistant-summary__sheet-label">Department</div>
              <div className="assistant-summary__sheet-value">{renderReadonlyValue(currentUser?.department)}</div>
            </div>

            <label className={`assistant-summary__sheet-row ${fieldErrors.assigned_manager_id ? "is-invalid" : ""}`}>
              <div className="assistant-summary__sheet-label">Assigned Manager</div>
              <div className="assistant-summary__sheet-control">
                <select
                  className="assistant-summary__sheet-input"
                  value={assignedManagerId || ""}
                  disabled={disabled}
                  onChange={(event) => onAssignedManagerChange(event.target.value)}
                  aria-label="Select assigned manager"
                >
                  <option value="">Select manager</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name} - {manager.department}
                    </option>
                  ))}
                </select>
                {selectedManager ? (
                  <div className="assistant-summary__sheet-note">
                    {selectedManager.department} - {selectedManager.email}
                  </div>
                ) : null}
                {renderFieldError(fieldErrors.assigned_manager_id)}
              </div>
            </label>

            <label className={`assistant-summary__sheet-row ${fieldErrors.form_type ? "is-invalid" : ""}`}>
              <div className="assistant-summary__sheet-label">Request Type</div>
              <div className="assistant-summary__sheet-control">
                <select
                  className="assistant-summary__sheet-input"
                  value={category}
                  disabled={disabled}
                  onChange={(event) => onCategoryChange(event.target.value)}
                  aria-label="Select request form type"
                >
                  <option value="">Not detected</option>
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {renderFieldError(fieldErrors.form_type)}
              </div>
            </label>

            <label className={`assistant-summary__sheet-row ${fieldErrors.amount || fieldErrors.currency ? "is-invalid" : ""}`}>
              <div className="assistant-summary__sheet-label">Amount</div>
              <div className="assistant-summary__sheet-control">
                <div className="assistant-summary__sheet-split">
                  <input
                    className="assistant-summary__sheet-input"
                    value={fields.amount ?? ""}
                    disabled={disabled}
                    onChange={(event) => onFieldChange("amount", event.target.value)}
                    placeholder="Not detected"
                    aria-label="Edit amount"
                  />
                  <input
                    className="assistant-summary__sheet-input assistant-summary__sheet-input--compact"
                    value={fields.currency ?? ""}
                    disabled={disabled}
                    onChange={(event) => onFieldChange("currency", event.target.value)}
                    placeholder="Currency"
                    aria-label="Edit currency"
                  />
                </div>
                {renderFieldError(fieldErrors.amount || fieldErrors.currency)}
              </div>
            </label>

            <label className={`assistant-summary__sheet-row ${fieldErrors.province_or_city ? "is-invalid" : ""}`}>
              <div className="assistant-summary__sheet-label">Location / City</div>
              <div className="assistant-summary__sheet-control">
                <input
                  className="assistant-summary__sheet-input"
                  value={fields.province_or_city ?? ""}
                  disabled={disabled}
                  onChange={(event) => onFieldChange("province_or_city", event.target.value)}
                  placeholder="Click to add"
                  aria-label="Edit location or city"
                />
                {renderFieldError(fieldErrors.province_or_city)}
              </div>
            </label>

            <label className={`assistant-summary__sheet-row ${fieldErrors.priority ? "is-invalid" : ""}`}>
              <div className="assistant-summary__sheet-label">Priority</div>
              <div className="assistant-summary__sheet-control">
                <select
                  className="assistant-summary__sheet-input"
                  value={fields.priority ?? ""}
                  disabled={disabled}
                  onChange={(event) => onFieldChange("priority", event.target.value)}
                  aria-label="Select priority"
                >
                  <option value="">Normal</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
                {renderFieldError(fieldErrors.priority)}
              </div>
            </label>

            <label className={`assistant-summary__sheet-row assistant-summary__sheet-row--full ${fieldErrors.reason ? "is-invalid" : ""}`}>
              <div className="assistant-summary__sheet-label">Description</div>
              <div className="assistant-summary__sheet-control">
                <textarea
                  className="assistant-summary__sheet-input assistant-summary__sheet-input--textarea"
                  value={fields.reason ?? ""}
                  disabled={disabled}
                  onChange={(event) => onFieldChange("reason", event.target.value)}
                  placeholder="Describe the request"
                  aria-label="Edit request description"
                />
                {renderFieldError(fieldErrors.reason)}
              </div>
            </label>

            {extraFieldKeys.map((fieldKey) => (
              <label key={fieldKey} className={`assistant-summary__sheet-row ${fieldErrors[fieldKey] ? "is-invalid" : ""}`}>
                <div className="assistant-summary__sheet-label">{FIELD_META[fieldKey]?.label || fieldKey}</div>
                <div className="assistant-summary__sheet-control">
                  <input
                    className="assistant-summary__sheet-input"
                    value={fields[fieldKey] ?? ""}
                    disabled={disabled}
                    onChange={(event) => onFieldChange(fieldKey, event.target.value)}
                    placeholder={FIELD_META[fieldKey]?.placeholder || "Click to add"}
                    aria-label={`Edit ${FIELD_META[fieldKey]?.label || fieldKey}`}
                  />
                  {renderFieldError(fieldErrors[fieldKey])}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="assistant-summary__actions">
          <div className={`assistant-summary__helper ${fieldErrors.form_type || helperMessage ? "is-error" : ""}`}>
            {helperMessage || (confirmed ? "Saved details will be used for the final submission." : "Save the extracted details before sending this request to the manager.")}
          </div>
          <div className="assistant-summary__action-row">
            <button className="btn btn-secondary" type="button" onClick={onCancelDetails} disabled={disabled || !dirty}>
              Cancel
            </button>
            <button className="btn btn-primary" type="button" onClick={onSaveDetails} disabled={saveDisabled}>
              {saving ? "Saving..." : "Save details"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
