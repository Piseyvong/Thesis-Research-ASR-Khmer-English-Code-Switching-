import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api";
import StatusBadge from "../components/StatusBadge";
import MockEmailPanel from "../components/MockEmailPanel";
import SubmittedRequestSummaryForm from "../components/SubmittedRequestSummaryForm";

function valueOrFallback(value) {
  return value || "-";
}

export default function RequestDetailPage({ currentUser }) {
  const { id } = useParams();
  const requestId = Number(id);

  const [request, setRequest] = useState(null);
  const [comment, setComment] = useState("");
  const [returnQuestion, setReturnQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const nextRequest = await api.getRequest(requestId);
      setRequest(nextRequest);
    } catch (requestError) {
      setError(requestError?.message || String(requestError));
    }
  }, [requestId]);

  useEffect(() => {
    let cancelled = false;
    api.getRequest(requestId)
      .then((nextRequest) => {
        if (!cancelled) {
          setRequest(nextRequest);
          setError(null);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError?.message || String(requestError));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  async function act(kind) {
    const trimmedComment = comment.trim();
    const trimmedQuestion = returnQuestion.trim();

    if (kind === "reject" && !trimmedComment) {
      setError("Please add a rejection comment before rejecting this request.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage("");
    try {
      if (kind === "approve") {
        await api.managerApprove(requestId, trimmedComment || null);
        setSuccessMessage("Request approved. A notification was sent to the employee.");
      } else if (kind === "reject") {
        await api.managerReject(requestId, trimmedComment);
        setSuccessMessage("Request rejected. The rejection comment was sent to the employee.");
      } else if (kind === "return") {
        await api.managerReturn(requestId, trimmedQuestion, trimmedComment || null);
        setSuccessMessage("Request returned for correction. The employee was notified.");
      }
      setComment("");
      setReturnQuestion("");
      await load();
    } catch (requestError) {
      setError(requestError?.message || String(requestError));
    } finally {
      setLoading(false);
    }
  }
  const reviewLocked = request?.status !== "Submitted";

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="conversation-header__eyebrow">Manager review</div>
          <h1 className="h1">{request?.form_type || `Request ${requestId}`}</h1>
          <div className="row">
            {request ? <StatusBadge status={request.status} /> : null}
            <span className="muted">{request?.request_number || `Request #${requestId}`}</span>
            <span className="muted">Assigned to {currentUser?.name}</span>
          </div>
        </div>
        <div className="row">
          <Link className="btn btn-secondary" to="/manager">
            Back to queue
          </Link>
          <button className="btn btn-secondary" type="button" onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {successMessage ? <div className="notice notice-success">{successMessage}</div> : null}

      {!request ? (
        <div className="muted">Loading request...</div>
      ) : (
        <div className="stack">
          <section className="generated-form">
            <div className="generated-form__head">
              <div className="generated-form__title-group">
                <div className="generated-form__eyebrow">Generated request form</div>
                <div className="generated-form__title">{valueOrFallback(request.form_type)}</div>
                <div className="request-form-modal__meta">
                  {valueOrFallback(request.request_number)} - {valueOrFallback(request.status)} - Submitted {valueOrFallback(request.submitted_at ? new Date(request.submitted_at).toLocaleString() : "-")}
                </div>
              </div>
              <StatusBadge status={request.status} />
            </div>

            <SubmittedRequestSummaryForm request={request} />
          </section>

          <section className="card">
            <div className="card-title">Manager decision</div>
            {reviewLocked ? <div className="muted">This request is no longer awaiting a manager decision.</div> : null}
            <label className="field">
              <div className="field-label">Manager comment {comment.trim() ? "" : "(required for rejection)"}</div>
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} disabled={loading || reviewLocked} placeholder="Add an approval, rejection, or return comment" />
            </label>
            <label className="field">
              <div className="field-label">Return for correction message</div>
              <textarea
                value={returnQuestion}
                onChange={(event) => setReturnQuestion(event.target.value)}
                disabled={loading || reviewLocked}
                placeholder="Describe what the employee must correct before resubmission"
              />
            </label>
            <div className="row">
              <button className="btn btn-primary" type="button" onClick={() => void act("approve")} disabled={loading || reviewLocked}>
                Approve
              </button>
              <button className="btn btn-danger" type="button" onClick={() => void act("reject")} disabled={loading || reviewLocked}>
                Reject
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => void act("return")} disabled={loading || reviewLocked || !returnQuestion.trim()}>
                Return for correction
              </button>
            </div>
          </section>

          <MockEmailPanel requestId={requestId} />
        </div>
      )}
    </div>
  );
}
