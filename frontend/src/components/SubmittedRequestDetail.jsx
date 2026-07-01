import StatusBadge from "./StatusBadge";
import SubmittedRequestSummaryForm from "./SubmittedRequestSummaryForm";

export default function SubmittedRequestDetail({ request, onReopenDraft }) {
  if (!request) {
    return null;
  }

  const editable = request.status === "Returned" || request.status === "Needs clarification";

  return (
    <div className="submitted-request">
      <header className="submitted-request__head">
        <div>
          <div className="submitted-request__eyebrow">Request details</div>
          <h1 className="submitted-request__title">{request.form_type || "-"}</h1>
          <p className="submitted-request__copy">
            Read-only request record prepared for internal review and manager decision.
          </p>
        </div>
        <div className="submitted-request__head-actions">
          <StatusBadge status={request.status} />
          {editable ? (
            <button type="button" className="btn btn-primary" onClick={onReopenDraft}>
              Continue editing
            </button>
          ) : null}
        </div>
      </header>

      <section className="generated-form">
        <div className="generated-form__head">
          <div className="generated-form__title-group">
            <div className="generated-form__eyebrow">Request overview</div>
            <div className="generated-form__title">{request.form_type || "-"}</div>
            <div className="request-form-modal__meta">
              {(request.request_number || "-")} - Updated{" "}
              {(request.updated_at ? new Date(request.updated_at).toLocaleString() : "-")}
            </div>
          </div>
          <StatusBadge status={request.status} />
        </div>

        <SubmittedRequestSummaryForm request={request} />
      </section>
    </div>
  );
}
