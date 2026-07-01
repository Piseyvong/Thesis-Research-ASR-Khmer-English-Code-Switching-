const MODEL_LABELS = {
  "whisper-small": "Whisper Small",
  "whisper-medium": "Whisper Medium",
  wav2vec2: "Wav2Vec2",
};

function modelLabel(modelName) {
  return MODEL_LABELS[modelName] || modelName;
}

function statusLabelForCandidate(candidate) {
  return candidate.available && !candidate.error ? "available" : "unavailable";
}

export default function TranscriptComparison({ candidates = [], selectedModel }) {
  return (
    <div className="card diagnostics-panel-card">
      <div className="card-title">ASR candidates</div>
      <div className="asr-table__viewport">
        <div className="asr-table">
          <div className="asr-table__head">
            <div className="asr-table__cell asr-table__cell--model">Model</div>
            <div className="asr-table__cell asr-table__cell--status">Status</div>
            <div className="asr-table__cell asr-table__cell--confidence">Decision</div>
          </div>
          {candidates.map((c) => {
            const isSel = c.model_name === selectedModel;
            const label = modelLabel(c.model_name);
            const statusLabel = statusLabelForCandidate(c);
            const decisionLabel = !c.available ? "-" : isSel ? "Selected" : "Reviewed";
            return (
              <div key={c.model_name} className={`asr-table__row ${isSel ? "is-selected" : ""}`}>
                <div className="asr-table__meta">
                  <div className="asr-table__cell asr-table__cell--model" title={c.model_name}>
                    {label}
                  </div>
                  <div className="asr-table__cell asr-table__cell--status" title={statusLabel}>
                    {statusLabel}
                  </div>
                  <div className="asr-table__cell asr-table__cell--confidence" title={decisionLabel}>
                    {decisionLabel}
                  </div>
                </div>
                {c.transcript || c.english_translation || c.extracted_form_type || c.validation_error ? (
                  <div className="asr-table__details">
                    {c.english_translation ? (
                      <div className="asr-table__detail-row">
                        <span className="asr-table__detail-label">Translation</span>
                        <span className="asr-table__detail-value" title={c.english_translation}>
                          {c.english_translation}
                        </span>
                      </div>
                    ) : null}
                    {c.extracted_form_type ? (
                      <div className="asr-table__detail-row">
                        <span className="asr-table__detail-label">Form</span>
                        <span className="asr-table__detail-value" title={c.extracted_form_type}>
                          {c.extracted_form_type}
                        </span>
                      </div>
                    ) : null}
                    {c.validation_error || c.extracted_missing_fields?.length ? (
                      <div className="asr-table__detail-row">
                        <span className="asr-table__detail-label">Validation</span>
                        <span
                          className="asr-table__detail-value"
                          title={c.validation_error || c.extracted_missing_fields.join(", ")}
                        >
                          {c.validation_error || `Missing: ${c.extracted_missing_fields.join(", ")}`}
                        </span>
                      </div>
                    ) : (
                      <div className="asr-table__detail-row">
                        <span className="asr-table__detail-label">Validation</span>
                        <span className="asr-table__detail-value">Schema-ready</span>
                      </div>
                    )}
                    {c.transcript ? (
                      <div className="asr-table__detail-row">
                        <span className="asr-table__detail-label">Transcript</span>
                        <span className="asr-table__detail-value asr-table__transcript-box mono" title={c.transcript}>
                          {c.transcript}
                        </span>
                      </div>
                    ) : null}
                    {c.selection_notes ? (
                      <div className="asr-table__detail-row">
                        <span className="asr-table__detail-label">Selection</span>
                        <span className="asr-table__detail-value" title={c.selection_notes}>
                          {c.selection_notes}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
