import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import StatusBadge from "../components/StatusBadge";
import { api } from "../services/api";

const MANAGER_FILTERS = [
  { key: "all", label: "Pending approvals" },
  { key: "Approved", label: "Approved requests" },
  { key: "Rejected", label: "Rejected requests" },
  { key: "Returned", label: "Returned requests" },
];

function matchesManagerFilter(request, filterKey) {
  if (filterKey === "all") {
    return request.status === "Submitted";
  }
  if (filterKey === "Returned") {
    return request.status === "Returned" || request.status === "Needs clarification";
  }
  return request.status === filterKey;
}

function getAmountLabel(request) {
  const fields = request.fields || {};
  return [fields.amount, fields.currency].filter(Boolean).join(" ") || "-";
}

function getReasonLabel(request) {
  const fields = request.fields || {};
  return fields.reason || fields.purpose || request.summary || "-";
}

export default function ManagerDashboard({ currentUser, onLogout, theme, onThemeToggle }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [decisionModal, setDecisionModal] = useState(null);
  const [decisionComment, setDecisionComment] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setSuccessMessage("");
    try {
      const result = await api.listManagerRequests();
      setRows(result);
    } catch (requestError) {
      setError(requestError?.message || String(requestError));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.listManagerRequests()
      .then((result) => {
        if (!cancelled) {
          setRows(result);
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
  }, []);

  const filteredRows = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return rows
      .filter((row) => matchesManagerFilter(row, activeFilter))
      .filter((row) =>
        !query ||
        [
          row.request_number,
          row.form_type,
          row.requester_name,
          row.requester_department,
          row.summary,
          row.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      );
  }, [activeFilter, rows, searchValue]);

  const filterOptions = useMemo(
    () =>
      MANAGER_FILTERS.map((filter) => ({
        ...filter,
        count: rows.filter((row) => matchesManagerFilter(row, filter.key)).length,
      })),
    [rows]
  );

  function openDecisionModal(request, action) {
    if (request.status !== "Submitted") {
      return;
    }

    setDecisionModal({ request, action });
    setDecisionComment("");
    setError(null);
  }

  function closeDecisionModal() {
    if (actionLoadingId) {
      return;
    }

    setDecisionModal(null);
    setDecisionComment("");
  }

  async function submitDecision() {
    if (!decisionModal) {
      return;
    }

    const { request, action } = decisionModal;
    const trimmedComment = decisionComment.trim();
    if (action === "reject" && !trimmedComment) {
      setError("Please add a rejection comment before rejecting this request.");
      return;
    }

    setActionLoadingId(request.id);
    setError(null);
    setSuccessMessage("");
    try {
      const nextRequest = action === "approve"
        ? await api.managerApprove(request.id, trimmedComment || null)
        : await api.managerReject(request.id, trimmedComment);
      setRows((currentRows) => currentRows.map((row) => (row.id === request.id ? nextRequest : row)));
      setSuccessMessage(
        action === "approve"
          ? `${request.request_number} approved. The employee was notified.`
          : `${request.request_number} rejected with your comment. The employee was notified.`
      );
      setDecisionModal(null);
      setDecisionComment("");
    } catch (requestError) {
      setError(requestError?.message || String(requestError));
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="request-shell">
      <Sidebar
        currentUser={currentUser}
        portalLabel="Manager portal"
        filters={filterOptions}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        requests={filteredRows}
        selectedRequestId={null}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onSelectRequest={(id) => navigate(`/manager/requests/${id}`)}
        historyTitle="Assigned requests"
        theme={theme}
        onThemeToggle={onThemeToggle}
        onLogout={onLogout}
      />

      <main className="workspace manager-workspace">
        <header className="conversation-header manager-header">
          <div>
            <div className="conversation-header__eyebrow">Manager portal</div>
            <h1 className="conversation-header__title">Assigned request queue</h1>
            <p className="conversation-header__copy">
              Review requests assigned to {currentUser.name}, add comments, and decide whether to approve, reject, or return them.
            </p>
          </div>
          <div className="conversation-header__actions">
            <button className="btn btn-secondary" type="button" onClick={load}>
              Refresh
            </button>
          </div>
        </header>

        {error ? <div className="error">{error}</div> : null}
        {successMessage ? <div className="notice notice-success">{successMessage}</div> : null}

        <section className="card manager-queue-card">
          <div className="card-title">Requests awaiting review</div>
          <div className="manager-table">
            <div className="manager-table__head">
              <div>Request</div>
              <div>Requester</div>
              <div>Department</div>
              <div>Amount</div>
              <div>Reason</div>
              <div>Submitted</div>
              <div>Status</div>
              <div></div>
            </div>
            {filteredRows.length === 0 ? (
              <div className="sidebar__empty">No assigned requests match the current filter.</div>
            ) : (
              filteredRows.map((row) => (
                <div key={row.id} className="manager-table__row">
                  <div data-label="Request">{row.request_number}</div>
                  <div data-label="Requester">{row.requester_name}</div>
                  <div data-label="Department">{row.requester_department || "-"}</div>
                  <div data-label="Amount">{getAmountLabel(row)}</div>
                  <div data-label="Reason" className="manager-table__reason">{getReasonLabel(row)}</div>
                  <div data-label="Submitted">{new Date(row.submitted_at || row.updated_at || row.created_at).toLocaleString()}</div>
                  <div data-label="Status">
                    <StatusBadge status={row.status} />
                  </div>
                  <div data-label="Actions" className="manager-table__actions">
                    {row.status === "Submitted" ? (
                      <>
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={() => openDecisionModal(row, "approve")}
                          disabled={actionLoadingId === row.id}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-danger"
                          type="button"
                          onClick={() => openDecisionModal(row, "reject")}
                          disabled={actionLoadingId === row.id}
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                    <button className="btn btn-secondary" type="button" onClick={() => navigate(`/manager/requests/${row.id}`)}>
                      Open
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {decisionModal ? (
        <div className="modal-backdrop" role="presentation" onClick={closeDecisionModal}>
          <div
            className="manager-decision-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manager-decision-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="manager-decision-modal__eyebrow">Manager decision</div>
            <h2 className="manager-decision-modal__title" id="manager-decision-title">
              {decisionModal.action === "approve" ? "Approve request" : "Reject request"}
            </h2>
            <div className="manager-decision-modal__meta">
              {decisionModal.request.request_number} - {decisionModal.request.requester_name} - {decisionModal.request.form_type || "Request"}
            </div>

            <label className="field manager-decision-modal__field">
              <div className="field-label">
                {decisionModal.action === "approve"
                  ? "Approval comment (optional)"
                  : "Rejection comment (required)"}
              </div>
              <textarea
                value={decisionComment}
                onChange={(event) => setDecisionComment(event.target.value)}
                placeholder={
                  decisionModal.action === "approve"
                    ? "Add a short note for the employee"
                    : "Explain why this request is rejected"
                }
                disabled={Boolean(actionLoadingId)}
                autoFocus
              />
            </label>

            <div className="manager-decision-modal__actions">
              <button className="btn btn-secondary" type="button" onClick={closeDecisionModal} disabled={Boolean(actionLoadingId)}>
                Cancel
              </button>
              <button
                className={decisionModal.action === "approve" ? "btn btn-primary" : "btn btn-danger"}
                type="button"
                onClick={() => void submitDecision()}
                disabled={Boolean(actionLoadingId) || (decisionModal.action === "reject" && !decisionComment.trim())}
              >
                {actionLoadingId ? "Sending..." : decisionModal.action === "approve" ? "Approve and notify" : "Reject and notify"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
