import ChatMessage from "./ChatMessage";
import { CATEGORY_OPTIONS, FIELD_META, getExtraFieldKeys, getRequiredFieldKeys } from "../constants/requestForms";

function valueOrFallback(value) {
  return value || "-";
}

function withValidationState(baseClass, hasError, validationPulse) {
  const classes = [baseClass];
  if (hasError) {
    classes.push("is-invalid");
    if (validationPulse > 0) {
      classes.push(`is-shaking-${validationPulse % 2}`);
    }
  }
  return classes.join(" ");
}

function fieldLabelFromKey(fieldKey) {
  if (fieldKey === "form_type") {
    return "Category";
  }
  if (fieldKey === "assigned_manager_id") {
    return "Assigned manager";
  }
  if (fieldKey === "province_or_city" || fieldKey === "location") {
    return "Location / city";
  }
  if (fieldKey === "reason") {
    return "Description";
  }
  if (fieldKey === "amount") {
    return "Amount";
  }
  if (fieldKey === "currency") {
    return "Currency";
  }
  if (FIELD_META[fieldKey]?.label) {
    return FIELD_META[fieldKey].label;
  }
  return fieldKey.replace(/_/g, " ");
}

function renderFieldLabel(label, isRequired = false) {
  return (
    <div className="field-label">
      {label}
      {isRequired ? <span className="required-star" aria-hidden="true"> *</span> : null}
    </div>
  );
}

export default function GeneratedRequestFormPreview({
  preview,
  currentUser,
  managers = [],
  category,
  fields,
  fieldErrors = {},
  assignedManagerId,
  helperMessage,
  dirty,
  confirmed,
  disabled,
  saving,
  submitting,
  canSubmit,
  validationPulse = 0,
  onCategoryChange,
  onAssignedManagerChange,
  onFieldChange,
  onSaveDetails,
  onCancelDetails,
  onSubmit,
  createdAt,
}) {
  if (!preview) {
    return null;
  }

  const extraFieldKeys = getExtraFieldKeys(category);
  const requiredFieldKeys = new Set(getRequiredFieldKeys(category));
  const selectedManager = managers.find((manager) => manager.id === assignedManagerId);
  const fieldErrorKeys = Object.keys(fieldErrors || {});
  const missingRequiredLabels = Array.from(new Set(fieldErrorKeys.map(fieldLabelFromKey)));
  const amountRequired = requiredFieldKeys.has("amount") || requiredFieldKeys.has("currency");
  const saveDisabled = disabled || saving || (!dirty && confirmed);
  const statusNote = submitting
    ? "Submitting to manager"
    : saving
      ? "Saving changes"
      : dirty
        ? "Unsaved changes"
        : confirmed
          ? "Ready for submission"
          : "Draft prepared";

  return (
    <ChatMessage role="assistant" createdAt={createdAt} bubbleClassName="chat-bubble--structured">
      <div className="generated-form generated-form--editable">
        <div className="generated-form__head">
          <div className="generated-form__title-group">
            <div className="generated-form__eyebrow">Internal request preview</div>
            <div className="generated-form__title">{valueOrFallback(category || preview.category)}</div>
            <div className="request-form-modal__meta">
              {valueOrFallback(preview.requestNumber)} - {valueOrFallback(preview.status)} - Draft prepared {valueOrFallback(preview.savedAt)}
            </div>
          </div>
          <div className="generated-form__review-note">{statusNote}</div>
        </div>

        {missingRequiredLabels.length ? (
          <div className="generated-form__required-popup" role="alert">
            Please complete required fields: {missingRequiredLabels.join(", ")}.
          </div>
        ) : null}

        <section className="generated-form__section">
          <div className="generated-form__section-title">Employee and routing</div>
          <div className="generated-form__meta-grid">
            <div className="generated-form__meta-item">
              <div className="field-label">Requester name</div>
              <div className="generated-form__meta-value">{valueOrFallback(currentUser?.name)}</div>
            </div>
            <div className="generated-form__meta-item">
              <div className="field-label">Employee ID</div>
              <div className="generated-form__meta-value">{valueOrFallback(currentUser?.id)}</div>
            </div>
            <div className="generated-form__meta-item">
              <div className="field-label">Department</div>
              <div className="generated-form__meta-value">{valueOrFallback(currentUser?.department)}</div>
            </div>
            <div className="generated-form__meta-item">
              <div className="field-label">Requester email</div>
              <div className="generated-form__meta-value">{valueOrFallback(currentUser?.email)}</div>
            </div>
            <label className={withValidationState("generated-form__meta-item", Boolean(fieldErrors.assigned_manager_id), validationPulse)}>
              {renderFieldLabel("Assigned manager", true)}
              <select
                className="generated-form__input"
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
                <div className="generated-form__meta-note">
                  {selectedManager.department} - {selectedManager.email}
                </div>
              ) : null}
              {fieldErrors.assigned_manager_id ? <div className="assistant-summary__error-text">{fieldErrors.assigned_manager_id}</div> : null}
            </label>
            <div className="generated-form__meta-item">
              <div className="field-label">Manager email</div>
              <div className="generated-form__meta-value">{valueOrFallback(selectedManager?.email || preview.assignedManagerEmail)}</div>
            </div>
            <div className="generated-form__meta-item">
              <div className="field-label">Manager department</div>
              <div className="generated-form__meta-value">{valueOrFallback(selectedManager?.department || preview.assignedManagerDepartment)}</div>
            </div>
            <label className={withValidationState("generated-form__meta-item", Boolean(fieldErrors.province_or_city), validationPulse)}>
              {renderFieldLabel("Location / city", requiredFieldKeys.has("province_or_city"))}
              <input
                className="generated-form__input"
                value={fields.province_or_city ?? ""}
                disabled={disabled}
                onChange={(event) => onFieldChange("province_or_city", event.target.value)}
                placeholder="Click to add"
                aria-label="Edit location or city"
              />
              {fieldErrors.province_or_city ? <div className="assistant-summary__error-text">{fieldErrors.province_or_city}</div> : null}
            </label>
          </div>
        </section>

        <section className="generated-form__section">
          <div className="generated-form__section-title">Request details</div>
          <div className="generated-form__detail-grid">
            <label className={withValidationState("generated-form__detail-item", Boolean(fieldErrors.form_type), validationPulse)}>
              {renderFieldLabel("Category", true)}
              <select
                className="generated-form__input"
                value={category || ""}
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
              {fieldErrors.form_type ? <div className="assistant-summary__error-text">{fieldErrors.form_type}</div> : null}
            </label>

            <label className={withValidationState("generated-form__detail-item", Boolean(fieldErrors.amount || fieldErrors.currency), validationPulse)}>
              {renderFieldLabel("Amount", amountRequired)}
              <div className="generated-form__input-group">
                <input
                  className="generated-form__input"
                  value={fields.amount ?? ""}
                  disabled={disabled}
                  onChange={(event) => onFieldChange("amount", event.target.value)}
                  placeholder="Not detected"
                  aria-label="Edit amount"
                />
                <input
                  className="generated-form__input generated-form__input--compact"
                  value={fields.currency ?? ""}
                  disabled={disabled}
                  onChange={(event) => onFieldChange("currency", event.target.value)}
                  placeholder="Currency"
                  aria-label="Edit currency"
                />
              </div>
              {fieldErrors.amount || fieldErrors.currency ? <div className="assistant-summary__error-text">{fieldErrors.amount || fieldErrors.currency}</div> : null}
            </label>

            <label className={withValidationState("generated-form__detail-item", Boolean(fieldErrors.priority), validationPulse)}>
              <div className="field-label">Priority</div>
              <select
                className="generated-form__input"
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
              {fieldErrors.priority ? <div className="assistant-summary__error-text">{fieldErrors.priority}</div> : null}
            </label>

            <label className={`${withValidationState("generated-form__detail-item", Boolean(fieldErrors.reason), validationPulse)} generated-form__detail-item--wide`}>
              {renderFieldLabel("Description", requiredFieldKeys.has("reason"))}
              <textarea
                className="generated-form__input generated-form__input--textarea"
                value={fields.reason ?? ""}
                disabled={disabled}
                onChange={(event) => onFieldChange("reason", event.target.value)}
                placeholder="Describe the request"
                aria-label="Edit request description"
              />
              {fieldErrors.reason ? <div className="assistant-summary__error-text">{fieldErrors.reason}</div> : null}
            </label>

            {extraFieldKeys.map((fieldKey) => (
              <label key={fieldKey} className={withValidationState("generated-form__detail-item", Boolean(fieldErrors[fieldKey]), validationPulse)}>
                {renderFieldLabel(FIELD_META[fieldKey]?.label || fieldKey, requiredFieldKeys.has(fieldKey))}
                <input
                  className="generated-form__input"
                  value={fields[fieldKey] ?? ""}
                  disabled={disabled}
                  onChange={(event) => onFieldChange(fieldKey, event.target.value)}
                  placeholder={FIELD_META[fieldKey]?.placeholder || "Click to add"}
                  aria-label={`Edit ${FIELD_META[fieldKey]?.label || fieldKey}`}
                />
                {fieldErrors[fieldKey] ? <div className="assistant-summary__error-text">{fieldErrors[fieldKey]}</div> : null}
              </label>
            ))}
          </div>
        </section>

        <div className="generated-form__actions">
          <div className={`generated-form__helper ${helperMessage ? "is-error" : ""}`}>
            {helperMessage || (confirmed ? "You can submit this request directly or save any new edits first." : "Review the generated request form, update any field if needed, then submit to the manager.")}
          </div>
          <div className="generated-form__action-row">
            <button className="btn btn-secondary" type="button" onClick={onCancelDetails} disabled={disabled || !dirty}>
              Cancel
            </button>
            <button className="btn btn-secondary" type="button" onClick={onSaveDetails} disabled={saveDisabled}>
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button className="btn btn-primary" type="button" onClick={onSubmit} disabled={!canSubmit || submitting}>
              {submitting ? "Submitting..." : "Submit to manager"}
            </button>
          </div>
        </div>
      </div>
    </ChatMessage>
  );
}
