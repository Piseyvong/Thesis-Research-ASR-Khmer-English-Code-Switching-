import ChatMessage from "./ChatMessage";

function valueOrFallback(value) {
  return value || "Not detected";
}

export default function TranslationMessage({
  createdAt,
  translation,
  transcript,
  showOriginalTranscript,
  editable = false,
  editing = false,
  draftValue = "",
  saving = false,
  onStartEdit,
  onCancelEdit,
  onDraftChange,
  onSaveEdit,
}) {
  return (
    <ChatMessage role="assistant" createdAt={createdAt} bubbleClassName="chat-bubble--structured">
      <div className="agent-card">
        <div className="agent-card__eyebrow">English request</div>
        <div className="agent-card__title">Refined request</div>

        {editing ? (
          <div className="agent-card__editor">
            <textarea
              className="agent-card__textarea"
              value={draftValue}
              onChange={(event) => onDraftChange?.(event.target.value)}
              placeholder="Edit the English request"
              aria-label="Edit the translated request"
            />
            <div className="agent-card__actions-row">
              <button className="btn btn-secondary" type="button" onClick={onCancelEdit} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary" type="button" onClick={onSaveEdit} disabled={saving || !draftValue.trim()}>
                {saving ? "Updating..." : "Update request"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              className={`agent-card__body ${editable ? "agent-card__body--editable" : ""}`}
              onDoubleClick={editable ? onStartEdit : undefined}
              title={editable ? "Double-click to edit the translated request." : undefined}
            >
              {valueOrFallback(translation)}
            </div>
            {editable ? (
              <div className="agent-card__hint">Double-click the English request to edit and regenerate the form.</div>
            ) : null}
          </>
        )}

        {showOriginalTranscript && transcript ? (
          <details className="agent-card__details">
            <summary>View original transcript</summary>
            <div className="agent-card__details-body mono">{transcript}</div>
          </details>
        ) : null}
      </div>
    </ChatMessage>
  );
}
