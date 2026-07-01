import { useEffect } from "react";
import { CloseIcon } from "./Icons";

function valueOrFallback(value) {
  return value || "-";
}

export default function RequestFormModal({
  open,
  preview,
  submitting,
  stale,
  onClose,
  onEditDetails,
  onSubmit,
  canSubmit,
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !preview) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="request-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-form-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="request-form-modal__top">
          <div className="request-form-modal__title-group">
            <div className="generated-form__eyebrow">Internal request preview</div>
            <h2 className="request-form-modal__title" id="request-form-modal-title">
              {valueOrFallback(preview.category)}
            </h2>
            <div className="request-form-modal__meta">
              {valueOrFallback(preview.requestNumber)} - {valueOrFallback(preview.status)} - Draft prepared {valueOrFallback(preview.savedAt)}
            </div>
          </div>

          <button className="icon-button icon-button--ghost" type="button" onClick={onClose} aria-label="Close request form preview">
            <CloseIcon />
          </button>
        </div>

        <div className="request-form-modal__body">
          <section className="generated-form__section">
            <div className="generated-form__section-title">Employee and routing</div>
            <div className="generated-form__meta-grid">
              <div className="generated-form__meta-item">
                <div className="field-label">Requester name</div>
                <div className="generated-form__meta-value">{valueOrFallback(preview.requesterName)}</div>
              </div>
              <div className="generated-form__meta-item">
                <div className="field-label">Employee ID</div>
                <div className="generated-form__meta-value">{valueOrFallback(preview.requesterId)}</div>
              </div>
              <div className="generated-form__meta-item">
                <div className="field-label">Department</div>
                <div className="generated-form__meta-value">{valueOrFallback(preview.requesterDepartment)}</div>
              </div>
              <div className="generated-form__meta-item">
                <div className="field-label">Requester email</div>
                <div className="generated-form__meta-value">{valueOrFallback(preview.requesterEmail)}</div>
              </div>
              <div className="generated-form__meta-item">
                <div className="field-label">Assigned manager</div>
                <div className="generated-form__meta-value">{valueOrFallback(preview.assignedManagerName)}</div>
              </div>
              <div className="generated-form__meta-item">
                <div className="field-label">Manager email</div>
                <div className="generated-form__meta-value">{valueOrFallback(preview.assignedManagerEmail)}</div>
              </div>
              <div className="generated-form__meta-item">
                <div className="field-label">Manager department</div>
                <div className="generated-form__meta-value">{valueOrFallback(preview.assignedManagerDepartment)}</div>
              </div>
              <div className="generated-form__meta-item">
                <div className="field-label">Location / city</div>
                <div className="generated-form__meta-value">{valueOrFallback(preview.location)}</div>
              </div>
            </div>
          </section>

          <section className="generated-form__section">
            <div className="generated-form__section-title">Request details</div>
            <div className="generated-form__detail-grid">
              <div className="generated-form__detail-item">
                <div className="field-label">Category</div>
                <div className="generated-form__detail-value">{valueOrFallback(preview.category)}</div>
              </div>
              <div className="generated-form__detail-item">
                <div className="field-label">Amount</div>
                <div className="generated-form__detail-value">{valueOrFallback(preview.amount)}</div>
              </div>
              <div className="generated-form__detail-item">
                <div className="field-label">Priority</div>
                <div className="generated-form__detail-value">{valueOrFallback(preview.priority)}</div>
              </div>
              <div className="generated-form__detail-item generated-form__detail-item--wide">
                <div className="field-label">Reason</div>
                <div className="generated-form__detail-value">{valueOrFallback(preview.reason)}</div>
              </div>
            </div>
          </section>

          <section className="generated-form__section">
            <div className="generated-form__section-title">Review status</div>
            <div className="generated-form__review">
              <div className="generated-form__review-copy">
                This preview is generated from the last saved extracted details. Edit the details in the chat flow and save again if the information needs correction before the final manager submission.
              </div>
              <div className="generated-form__review-note">
                {submitting ? "Submitting to manager" : stale ? "Preview needs refresh" : "Ready for submission"}
              </div>
            </div>
            {preview.summary ? (
              <div className="generated-form__review">
                <div className="generated-form__review-copy">
                  <strong>AI summary</strong>
                  <div className="generated-form__meta-value">{preview.summary}</div>
                </div>
                <div className="generated-form__review-note">
                  {valueOrFallback(preview.submittedAt || preview.savedAt)}
                </div>
              </div>
            ) : null}
          </section>

        </div>

        <div className="request-form-modal__actions">
          <button className="btn btn-secondary" type="button" onClick={onEditDetails}>
            Edit details
          </button>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" type="button" onClick={onSubmit} disabled={!canSubmit || submitting}>
            {submitting ? "Submitting..." : "Submit to manager"}
          </button>
        </div>
      </div>
    </div>
  );
}
