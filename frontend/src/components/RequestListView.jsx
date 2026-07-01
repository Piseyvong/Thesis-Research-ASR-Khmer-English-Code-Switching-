import { SearchIcon } from "./Icons";
import InlineConfirmButton from "./InlineConfirmButton";
import StatusBadge from "./StatusBadge";

const FILTER_COPY = {
  all: {
    eyebrow: "Request overview",
    title: "My requests",
    copy: "Review every request you have created across draft, submitted, approved, rejected, and returned states.",
  },
  Draft: {
    eyebrow: "Editable requests",
    title: "Draft requests",
    copy: "Continue working on draft requests before sending them to the assigned manager.",
  },
  Submitted: {
    eyebrow: "Requests in review",
    title: "Submitted requests",
    copy: "Read submitted requests and monitor items that are currently with the manager.",
  },
  Approved: {
    eyebrow: "Completed requests",
    title: "Approved requests",
    copy: "Review approved requests and their final submitted request details.",
  },
  Rejected: {
    eyebrow: "Closed requests",
    title: "Rejected requests",
    copy: "Review rejected requests and their recorded request details in read-only mode.",
  },
  Returned: {
    eyebrow: "Needs correction",
    title: "Returned requests",
    copy: "Open returned requests, correct the details, and resubmit them to the assigned manager.",
  },
};

function formatRequestMeta(request) {
  return [
    request.request_number,
    request.updated_at ? new Date(request.updated_at).toLocaleDateString() : null,
  ]
    .filter(Boolean)
    .join(" - ");
}

function getSummaryText(request) {
  return request.summary || request.follow_up_question || "Open this request to review the full details.";
}

export default function RequestListView({
  activeFilter,
  requests,
  currentUser,
  searchValue,
  onSearchChange,
  onOpenRequest,
  onDeleteDraft,
}) {
  const copy = FILTER_COPY[activeFilter] || FILTER_COPY.all;

  function handleDraftDoubleClick(event, request) {
    if (event.target.closest?.("button")) {
      return;
    }

    onOpenRequest(request);
  }

  return (
    <div className="request-list-view">
      <header className="request-list-view__hero">
        <div className="request-list-view__hero-copy">
          <div className="request-list-view__eyebrow">{copy.eyebrow}</div>
          <h1 className="request-list-view__title">{copy.title}</h1>
          <p className="request-list-view__copy">
            {copy.copy} These records belong to {currentUser?.name}.
          </p>
        </div>
      </header>

      <section className="request-list-view__section">
        <div className="request-list-view__section-head">
          <div>
            <div className="request-list-view__section-title">Request cards</div>
            <div className="request-list-view__section-meta">
              Select a request to view details. Double-click a draft card to continue editing.
            </div>
          </div>
          <div className="request-list-view__section-count">{requests.length}</div>
        </div>

        <label className="request-list-view__search">
          <SearchIcon />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search requests"
            aria-label="Search requests"
          />
        </label>

        <div className="request-list-view__scroll sidebar-scroll">
          {requests.length === 0 ? (
            <div className="request-list-view__empty">No requests match the selected category.</div>
          ) : (
            <div className="request-list-view__grid">
              {requests.map((request) => {
                const isDraft = request.status === "Draft";

                return (
                  <article
                    key={request.id}
                    className={`request-list-view__card${isDraft ? " request-list-view__card--draft" : ""}`}
                    onDoubleClick={isDraft ? (event) => handleDraftDoubleClick(event, request) : undefined}
                    title={isDraft ? "Double-click to continue editing this draft" : undefined}
                  >
                    <div className="request-list-view__card-top">
                      <div>
                        <div className="request-list-view__card-title">
                          {request.form_type || request.summary || `Request #${request.id}`}
                        </div>
                        <div className="request-list-view__card-meta">{formatRequestMeta(request)}</div>
                      </div>
                      <div className="request-list-view__card-actions">
                        <StatusBadge status={request.status} />
                        {isDraft ? (
                          <InlineConfirmButton
                            triggerLabel="Delete"
                            prompt={`Delete draft ${request.request_number || `#${request.id}`}?`}
                            confirmLabel="Delete"
                            buttonClassName="request-list-view__card-delete"
                            popoverClassName="inline-confirm__popover--list"
                            onConfirm={() => onDeleteDraft?.(request)}
                          />
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="request-list-view__card-open"
                      onClick={() => onOpenRequest(request)}
                      aria-label={isDraft ? "Open draft for editing" : "Open request details"}
                    >
                      <div className="request-list-view__card-body">{getSummaryText(request)}</div>
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
