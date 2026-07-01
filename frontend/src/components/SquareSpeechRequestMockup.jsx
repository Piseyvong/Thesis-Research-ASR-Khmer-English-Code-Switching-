import { useEffect, useRef, useState } from "react";
import {
  ClipboardIcon,
  FileAudioIcon,
  LogoutIcon,
  MicrophoneIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
} from "./Icons";
import { api } from "../services/api";
import {
  FIELD_META,
  createEmptyRequestFields,
  serializeFieldsForApi,
  toDraftFields,
  validateRequestDetails,
} from "../constants/requestForms";
import { AUDIO_ACCEPT } from "./RequestComposer";
import TranscriptComparison from "./TranscriptComparison";

const TRANSCRIPT_TEXT = "cash van.";

const DEFAULT_SUMMARY = {
  formName: "Cash Advance Form",
  quoteNumber: "REQ-0013",
  no: "1",
  description: "cash van",
  qty: "1",
  price: "1000",
  amount: "1000 USD",
  total: "1000 USD",
};

const SUMMARY_FIELD_LABELS = {
  employee_name: "Employee name",
  amount: "Amount",
  currency: "Currency",
  location: "Location",
  province_or_city: "Province / city",
  date: "Date",
  reason: "Reason",
  purpose: "Purpose",
  priority: "Priority",
  material_name: "Material name",
  training_type: "Training type",
  travel_type: "Travel type",
};

const FILTERS = [
  { key: "all", label: "My requests" },
  { key: "Draft", label: "Drafts" },
  { key: "Submitted", label: "Submitted" },
  { key: "Approved", label: "Approved" },
  { key: "Rejected", label: "Rejected" },
  { key: "Returned", label: "Returned" },
];

const QUICK_ACTIONS = [
  { label: "Cash Advance", icon: ClipboardIcon },
  { label: "Expense Claim", icon: ClipboardIcon },
  { label: "Material Request", icon: ClipboardIcon },
  { label: "Record voice", icon: MicrophoneIcon },
  { label: "Upload audio", icon: FileAudioIcon },
];

const FALLBACK_REQUESTS = [
  {
    id: 13,
    form_type: "Cash Advance Form",
    status: "Draft",
    summary: "cash van.",
  },
  {
    id: 12,
    form_type: "Traveling Request Form",
    status: "Submitted",
    summary: "Request for $100 to Siem Reap for a business trip.",
  },
  {
    id: 35,
    form_type: "Material Request Form",
    status: "Approved",
    summary: "Office material request for the team.",
  },
  {
    id: 34,
    form_type: "Expense Claim Form",
    status: "Draft",
    summary: "Expense claim for business travel.",
  },
];

function countByStatus(requests, key) {
  if (key === "all") {
    return requests.length || 33;
  }
  if (key === "Returned") {
    return requests.filter((request) => ["Returned", "Needs clarification"].includes(request.status)).length;
  }
  return requests.filter((request) => request.status === key).length;
}

function requestTitle(request) {
  return request?.form_type || request?.summary || request?.request_number || "Traveling Request Form";
}

function buildSummaryFromText(text) {
  const cleanText = text.trim().replace(/[.!?]+$/, "");
  const amountMatch = cleanText.match(/\$?\b(\d+(?:\.\d{1,2})?)\b/);
  const normalizedAmount = amountMatch?.[1] || (cleanText.toLowerCase() === "cash van" ? "1000" : DEFAULT_SUMMARY.price);
  const formName = /\b(travel|trip|siem reap|province|flight)\b/i.test(cleanText)
    ? "Traveling Request Form"
    : DEFAULT_SUMMARY.formName;

  return {
    ...DEFAULT_SUMMARY,
    formName,
    description: cleanText || DEFAULT_SUMMARY.description,
    price: normalizedAmount,
    amount: `${normalizedAmount} USD`,
    total: `${normalizedAmount} USD`,
  };
}

function requestToTranscript(request) {
  if (request?.selected_transcript) {
    return request.selected_transcript.replace(/[.!?]*$/, ".");
  }
  if (request?.summary) {
    return request.summary.replace(/^Request for/i, "I want to request").replace(/[.!?]*$/, ".");
  }
  if (request?.form_type === "Cash Advance Form") {
    return "I want to request $100 cash advance for a business activity.";
  }
  if (request?.form_type === "Material Request Form") {
    return "I want to request office material for my team.";
  }
  if (request?.form_type === "Expense Claim Form") {
    return "I want to claim $100 for my business trip expense.";
  }
  return TRANSCRIPT_TEXT;
}

function buildSummaryFromRequest(request) {
  const transcript = requestToTranscript(request);
  const baseSummary = buildSummaryFromText(transcript);
  const fields = request?.fields || {};
  const amount = fields.amount || baseSummary.price;
  const currency = fields.currency || "USD";

  return {
    ...baseSummary,
    formName: request?.form_type || baseSummary.formName,
    quoteNumber: request?.request_number || (request?.id ? `REQ-${String(request.id).padStart(4, "0")}` : baseSummary.quoteNumber),
    description: fields.reason || fields.purpose || transcript.replace(/[.!?]+$/, ""),
    price: amount,
    amount: `${amount} ${currency}`.trim(),
    total: `${amount} ${currency}`.trim(),
  };
}

function summaryToTranscript(summary) {
  return `${summary.description.replace(/[.!?]+$/, "")}.`;
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function writeString(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function encodeMonoWav(audioBuffer) {
  const samples = audioBuffer.length;
  const channelCount = audioBuffer.numberOfChannels;
  const bytesPerSample = 2;
  const wav = new ArrayBuffer(44 + samples * bytesPerSample);
  const view = new DataView(wav);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples * bytesPerSample, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples * bytesPerSample, true);

  const channels = Array.from({ length: channelCount }, (_, index) => audioBuffer.getChannelData(index));
  let offset = 44;
  for (let i = 0; i < samples; i += 1) {
    let sample = 0;
    for (const channel of channels) {
      sample += channel[i];
    }
    sample = Math.max(-1, Math.min(1, sample / channelCount));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += bytesPerSample;
  }

  return wav;
}

async function convertRecordingToWav(blob) {
  const audioContext = new AudioContext();
  try {
    const buffer = await audioContext.decodeAudioData(await blob.arrayBuffer());
    return new File([encodeMonoWav(buffer)], "recording.wav", { type: "audio/wav" });
  } finally {
    await audioContext.close();
  }
}

function summaryFromAudioResponse(response) {
  const fields = response?.llm?.fields || {};
  const transcript = response?.asr?.selected_transcript || response?.llm?.cleaned_transcript || "";
  const amount = fields.amount || DEFAULT_SUMMARY.price;
  const currency = fields.currency || "USD";
  const description = fields.reason || fields.purpose || response?.llm?.summary || transcript || DEFAULT_SUMMARY.description;

  return {
    ...DEFAULT_SUMMARY,
    formName: response?.llm?.form_type || DEFAULT_SUMMARY.formName,
    quoteNumber: response?.request_id ? `REQ-${String(response.request_id).padStart(4, "0")}` : DEFAULT_SUMMARY.quoteNumber,
    description,
    price: amount,
    amount: `${amount} ${currency}`.trim(),
    total: `${amount} ${currency}`.trim(),
  };
}

function fieldLabel(fieldKey) {
  return FIELD_META[fieldKey]?.label || SUMMARY_FIELD_LABELS[fieldKey] || fieldKey.replaceAll("_", " ");
}

function fieldPlaceholder(fieldKey) {
  return FIELD_META[fieldKey]?.placeholder || `Enter ${fieldLabel(fieldKey).toLowerCase()}`;
}

function visibleSummaryFieldKeys(formName, fields = {}, missingFields = []) {
  const keys = new Set();
  const type = formName || "";

  if (
    ["Cash Advance Form", "Traveling Request Form"].includes(type) ||
    fields.province_or_city ||
    fields.location ||
    missingFields.includes("province_or_city")
  ) {
    keys.add("province_or_city");
  }

  if (type === "Traveling Request Form" || fields.travel_type || missingFields.includes("travel_type")) {
    keys.add("travel_type");
  }

  for (const optionalKey of ["date", "material_name", "training_type"]) {
    if (fields[optionalKey] || missingFields.includes(optionalKey)) {
      keys.add(optionalKey);
    }
  }

  return [...keys];
}

export function Sidebar({
  currentUser,
  requests = [],
  activeFilter,
  selectedRequestId,
  drawerOpen = false,
  onFilterSelect,
  onRequestSelect,
  onNewRequest,
  onCloseDrawer,
  onThemeToggle,
  onLogout,
}) {
  const sourceRequests = requests.length ? requests : FALLBACK_REQUESTS;
  const recentRequests = sourceRequests
    .filter((request) => {
      if (activeFilter === "all") {
        return true;
      }
      if (activeFilter === "Returned") {
        return ["Returned", "Needs clarification"].includes(request.status);
      }
      return request.status === activeFilter;
    })
    .slice(0, 8);

  return (
    <aside className={`square-sidebar ${drawerOpen ? "is-open" : ""}`}>
      <button className="square-sidebar__close" type="button" onClick={onCloseDrawer} aria-label="Close menu">
        <span />
        <span />
      </button>

      <div className="square-sidebar__brand">
        <div className="square-sidebar__brand-mark">S</div>
        <div>
          <div className="square-sidebar__brand-title">Speech Request System</div>
          <div className="square-sidebar__brand-subtitle">Employee workspace</div>
        </div>
      </div>

      <button className="square-sidebar__new" type="button" onClick={onNewRequest}>
        <PlusIcon />
        <span>New request</span>
      </button>

      <div className="square-sidebar__section">
        <div className="square-sidebar__eyebrow">Employee portal</div>
        <div className="square-sidebar__filters">
          {FILTERS.map((filter) => (
            <button
              className={`square-sidebar__filter ${filter.key === activeFilter ? "is-active" : ""}`}
              type="button"
              key={filter.key}
              onClick={() => {
                onFilterSelect(filter.key);
                onCloseDrawer?.();
              }}
            >
              <span>{filter.label}</span>
              <strong>{countByStatus(requests, filter.key)}</strong>
            </button>
          ))}
        </div>
      </div>

      <label className="square-sidebar__search">
        <SearchIcon />
        <input type="search" placeholder="Search requests" />
      </label>

      <div className="square-sidebar__history">
        <div className="square-sidebar__eyebrow">Recent requests</div>
        <div className="square-sidebar__history-list">
          {recentRequests.map((request) => (
            <button
              className={`square-sidebar__history-item ${request.id === selectedRequestId ? "is-active" : ""}`}
              type="button"
              key={request.id}
              onClick={() => {
                onRequestSelect(request);
                onCloseDrawer?.();
              }}
            >
              <span className="square-sidebar__history-dot" />
              <span>{requestTitle(request)}</span>
            </button>
          ))}
          {!recentRequests.length ? (
            <div className="square-sidebar__empty">No requests in this filter</div>
          ) : null}
        </div>
      </div>

      <div className="square-sidebar__footer">
        <button className="square-sidebar__utility" type="button" onClick={onThemeToggle}>
          <MoonIcon />
          <span>
            <strong>Night mode</strong>
            <small>Switch to the dark workspace</small>
          </span>
        </button>

        <div className="square-sidebar__profile">
          <div className="square-sidebar__avatar">{(currentUser?.name || "P").slice(0, 1)}</div>
          <div className="square-sidebar__profile-copy">
            <strong>{currentUser?.name || "Pisey"}</strong>
            <span>{currentUser?.department || "Marketing"}</span>
          </div>
          <button className="square-sidebar__logout" type="button" onClick={onLogout} aria-label="Log out">
            <LogoutIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function TranscriptCard({ text }) {
  return (
    <section className="transcript-card">
      <div className="transcript-card__icon" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="transcript-card__content">
        <div className="transcript-card__label">Your transcript</div>
        <p>&ldquo;{text}&rdquo;</p>
      </div>
    </section>
  );
}

export function EditableCell({ value, onChange, className = "", ariaLabel, readOnly = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function startEditing() {
    if (readOnly) {
      return;
    }
    setDraft(value);
    setEditing(true);
  }

  function save() {
    onChange(draft.trim());
    setEditing(false);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        className={`editable-cell editable-cell--active ${className}`}
        value={draft}
        autoFocus
        aria-label={ariaLabel}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
      />
    );
  }

  return (
    <button
      className={`editable-cell ${readOnly ? "editable-cell--readonly" : ""} ${className}`}
      type="button"
      onDoubleClick={startEditing}
      aria-label={ariaLabel}
      aria-readonly={readOnly}
    >
      {value}
    </button>
  );
}

export function EditableSummaryCard({
  summary: sourceSummary,
  fields,
  missingFields = [],
  onFieldChange,
  onSubmit,
  onKeyDown,
  submitting = false,
  submitError = "",
  submitted = false,
}) {
  const [summary, setSummary] = useState(sourceSummary);
  const uniqueMissingFields = [...new Set(missingFields)].filter((fieldKey) => fieldKey !== "form_type");
  const summaryFieldKeys = visibleSummaryFieldKeys(summary.formName, fields, uniqueMissingFields);

  function updateField(key, value) {
    if (submitted) {
      return;
    }
    setSummary((current) => ({ ...current, [key]: value || current[key] }));
  }

  return (
    <section className="editable-summary-card" onKeyDown={onKeyDown}>
      <div className="editable-summary-card__head">
        <div>
          <h2>Summary Request Info</h2>
          <p>{submitted ? "Submitted requests are read-only" : "Double-click any field to edit"}</p>
        </div>
        <button className="square-submit-button" type="button" onClick={onSubmit} disabled={submitting || submitted}>
          {submitting ? "Submitting..." : submitted ? "Submitted" : "Submit to manager"}
        </button>
      </div>
      {submitError ? <div className="square-submit-error">{submitError}</div> : null}
      {uniqueMissingFields.length ? (
        <div className="summary-required-panel">
          <div className="summary-required-panel__notice">
            Missing required fields: {uniqueMissingFields.map(fieldLabel).join(", ")}
          </div>
          <div className="summary-required-panel__grid">
            {uniqueMissingFields.map((fieldKey) => (
              <label className="summary-required-field" key={fieldKey}>
                <span>{fieldLabel(fieldKey)}</span>
                <input
                  value={fields?.[fieldKey] || ""}
                  placeholder={fieldPlaceholder(fieldKey)}
                  disabled={submitted}
                  onChange={(event) => onFieldChange(fieldKey, event.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="editable-summary-card__meta">
        <div>
          <span>Form Name</span>
          <EditableCell
            value={summary.formName}
            onChange={(value) => updateField("formName", value)}
            ariaLabel="Edit form name"
            readOnly
          />
        </div>
        <div>
          <span>Quote Number</span>
          <EditableCell
            value={summary.quoteNumber}
            onChange={(value) => updateField("quoteNumber", value)}
            ariaLabel="Edit quote number"
            readOnly
          />
        </div>
        {summaryFieldKeys.map((fieldKey) => (
          <label className="summary-meta-field" key={fieldKey}>
            <span>{fieldLabel(fieldKey)}</span>
            <input
              value={fields?.[fieldKey] || ""}
              placeholder={fieldPlaceholder(fieldKey)}
              disabled={submitted}
              onChange={(event) => onFieldChange(fieldKey, event.target.value)}
            />
          </label>
        ))}
      </div>

      <div className="editable-summary-table" role="table" aria-label="Summary request table">
        <div className="editable-summary-table__row editable-summary-table__row--head" role="row">
          <div role="columnheader">No</div>
          <div role="columnheader">Description</div>
          <div role="columnheader">Qty</div>
          <div role="columnheader">Price</div>
          <div role="columnheader">Amount</div>
        </div>
        <div className="editable-summary-table__row" role="row">
          <EditableCell value={summary.no} onChange={(value) => updateField("no", value)} ariaLabel="Edit row number" readOnly={submitted} />
          <EditableCell
            value={summary.description}
            onChange={(value) => updateField("description", value)}
            className="editable-cell--description"
            ariaLabel="Edit description"
            readOnly={submitted}
          />
          <EditableCell value={summary.qty} onChange={(value) => updateField("qty", value)} ariaLabel="Edit quantity" readOnly={submitted} />
          <EditableCell value={summary.price} onChange={(value) => updateField("price", value)} ariaLabel="Edit price" readOnly={submitted} />
          <EditableCell value={summary.amount} onChange={(value) => updateField("amount", value)} ariaLabel="Edit amount" readOnly={submitted} />
        </div>
        <div className="editable-summary-table__row editable-summary-table__row--total" role="row">
          <div>Total Amount</div>
          <EditableCell
            value={summary.total}
            onChange={(value) => updateField("total", value)}
            className="editable-cell--total"
            ariaLabel="Edit total amount"
            readOnly={submitted}
          />
        </div>
      </div>
    </section>
  );
}

export function ChatInput({
  message,
  isRecording,
  recordingSeconds,
  recordingStatus,
  onMessageChange,
  onSend,
  onQuickAction,
  onToggleRecording,
  onUploadAudio,
}) {
  const fileInputRef = useRef(null);

  return (
    <section className="square-chat-input">
      {isRecording || recordingStatus ? (
        <div className={`square-recording-status ${isRecording ? "is-recording" : ""}`}>
          <div className="square-recording-status__wave" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="square-recording-status__copy">
            <strong>{isRecording ? `Recording ${formatDuration(recordingSeconds)}` : recordingStatus}</strong>
            <span>{isRecording ? "Audio is being recorded. Transcription starts after you stop." : "Please wait while the audio is transcribed."}</span>
          </div>
        </div>
      ) : null}

      <div className="square-chat-input__bar">
        <button type="button" aria-label="Add attachment">
          <PlusIcon />
        </button>
        <input
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder="Add more details, ask a question, or continue your request..."
          aria-label="Request message"
        />
        <button
          className={isRecording ? "is-recording" : ""}
          type="button"
          onClick={onToggleRecording}
          aria-label={isRecording ? "Stop recording" : "Record voice"}
        >
          <MicrophoneIcon />
        </button>
        <button className="square-chat-input__send" type="button" onClick={onSend} aria-label="Send message">
          <SendIcon />
        </button>
      </div>

      <div className="square-chat-input__chips" aria-label="Quick actions">
        {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
          <button
            type="button"
            key={label}
            onClick={() => {
              if (label === "Upload audio") {
                fileInputRef.current?.click();
                return;
              }
              onQuickAction(label);
            }}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept={AUDIO_ACCEPT}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onUploadAudio(file);
          }
          event.target.value = "";
        }}
      />
    </section>
  );
}

export default function SquareSpeechRequestMockup({ currentUser, requests, onThemeToggle, onLogout }) {
  const [message, setMessage] = useState("");
  const [activeTranscript, setActiveTranscript] = useState(TRANSCRIPT_TEXT);
  const [activeSummary, setActiveSummary] = useState(DEFAULT_SUMMARY);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedRequestId, setSelectedRequestId] = useState(13);
  const [isEmptyRequest, setIsEmptyRequest] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState("");
  const [submitStatus, setSubmitStatus] = useState("draft");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [activeFields, setActiveFields] = useState(createEmptyRequestFields);
  const [activeMissingFields, setActiveMissingFields] = useState([]);
  const [activeFormType, setActiveFormType] = useState(DEFAULT_SUMMARY.formName);
  const [developmentAsr, setDevelopmentAsr] = useState({ candidates: [], selectedModel: null });
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const chunksRef = useRef([]);
  const hasResponse = Boolean(activeTranscript && activeSummary && !isEmptyRequest);

  useEffect(() => {
    return () => {
      window.clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current?.stop?.();
      mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    };
  }, []);

  function handleNewRequest() {
    setMessage("");
    setActiveTranscript("");
    setActiveSummary(null);
    setSelectedRequestId(null);
    setIsEmptyRequest(true);
    setSubmitStatus("draft");
    setSubmitError("");
    setActiveFields(createEmptyRequestFields());
    setActiveMissingFields([]);
    setActiveFormType("");
    setDevelopmentAsr({ candidates: [], selectedModel: null });
  }

  function handleSend() {
    const text = message.trim() || TRANSCRIPT_TEXT;
    const normalizedText = text.replace(/[.!?]*$/, ".");
    setActiveTranscript(normalizedText);
    setActiveSummary(normalizedText === TRANSCRIPT_TEXT ? DEFAULT_SUMMARY : buildSummaryFromText(normalizedText));
    setMessage("");
    setSelectedRequestId(null);
    setIsEmptyRequest(false);
    setSubmitStatus("draft");
    setSubmitError("");
    setActiveFields((current) => ({
      ...current,
      reason: normalizedText.replace(/[.!?]+$/, ""),
      purpose: normalizedText.replace(/[.!?]+$/, ""),
    }));
    setActiveFormType(normalizedText === TRANSCRIPT_TEXT ? DEFAULT_SUMMARY.formName : buildSummaryFromText(normalizedText).formName);
    setActiveMissingFields([]);
    setDevelopmentAsr({ candidates: [], selectedModel: null });
  }

  async function handleAudioFile(file) {
    setRecordingStatus("Transcribing...");
    try {
      const response = await api.createFromAudio(file);
      const transcript = response?.asr?.selected_transcript || response?.llm?.cleaned_transcript || "";
      setActiveTranscript(transcript ? transcript.replace(/[.!?]*$/, ".") : "No transcript returned.");
      setActiveSummary(summaryFromAudioResponse(response));
      setMessage("");
      setSelectedRequestId(response?.request_id || null);
      setIsEmptyRequest(false);
      setSubmitStatus("draft");
      setSubmitError("");
      setActiveFields(toDraftFields(response?.llm?.fields || {}));
      setActiveMissingFields(response?.llm?.missing_fields || []);
      setActiveFormType(response?.llm?.form_type || "");
      setDevelopmentAsr({
        candidates: response?.asr?.all_candidates || [],
        selectedModel: response?.asr?.selected_model || null,
      });
      setRecordingStatus("Transcription complete");
      window.setTimeout(() => setRecordingStatus(""), 1800);
    } catch (error) {
      setRecordingStatus(error?.message || "Audio transcription failed.");
    }
  }

  function finishRecording() {
    window.clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
    setIsRecording(false);
  }

  async function startRecording() {
    setRecordingStatus("Requesting microphone access...");
    chunksRef.current = [];

    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordingStatus("Microphone recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      if (window.MediaRecorder) {
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };
        recorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          chunksRef.current = [];
          try {
            const file = await convertRecordingToWav(blob);
            await handleAudioFile(file);
          } catch (error) {
            setRecordingStatus(error?.message || "Recording conversion failed.");
          }
        };
        recorder.start();
      }

      setRecordingSeconds(0);
      setIsRecording(true);
      setRecordingStatus("");
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((current) => current + 1);
      }, 1000);
    } catch (error) {
      setIsRecording(false);
      setRecordingStatus(error?.name === "NotAllowedError" ? "Microphone permission was blocked." : "Could not start microphone recording.");
    }
  }

  function handleToggleRecording() {
    if (isRecording) {
      finishRecording();
      return;
    }

    void startRecording();
  }

  function handleRequestSelect(request) {
    const summary = buildSummaryFromRequest(request);
    setActiveTranscript(summaryToTranscript(summary));
    setActiveSummary(summary);
    setSelectedRequestId(request.id);
    setIsEmptyRequest(false);
    setSubmitStatus(request.status === "Submitted" ? "submitted" : "draft");
    setSubmitError("");
    setActiveFields(toDraftFields(request.fields || {}));
    setActiveMissingFields(request.missing_fields || []);
    setActiveFormType(request.form_type || "");
    setDevelopmentAsr({
      candidates: request.asr_candidates || [],
      selectedModel: request.selected_model || null,
    });
  }

  function handleRequiredFieldChange(fieldKey, value) {
    setActiveFields((current) => {
      const next = { ...current, [fieldKey]: value };
      if (fieldKey === "province_or_city") {
        next.location = value;
      }
      if (fieldKey === "location") {
        next.province_or_city = value;
      }
      if (fieldKey === "reason") {
        next.purpose = value;
      }
      if (fieldKey === "purpose") {
        next.reason = value;
      }

      const validation = validateRequestDetails(activeFormType, next);
      setActiveMissingFields(Object.keys(validation.errors));
      return next;
    });
    if (["amount", "currency", "reason", "purpose"].includes(fieldKey)) {
      setActiveSummary((current) => {
        if (!current) {
          return current;
        }

        const next = { ...current };
        if (fieldKey === "amount") {
          const currency = activeFields.currency || "USD";
          next.price = value || current.price;
          next.amount = [value || current.price, currency].filter(Boolean).join(" ");
          next.total = next.amount;
        }
        if (fieldKey === "currency") {
          const amount = activeFields.amount || current.price;
          next.amount = [amount, value].filter(Boolean).join(" ");
          next.total = next.amount;
        }
        if (fieldKey === "reason" || fieldKey === "purpose") {
          next.description = value || current.description;
        }
        return next;
      });
    }
    setSubmitError("");
  }

  function handleSummaryKeyDown(event) {
    if ((event.ctrlKey || event.metaKey || event.shiftKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
    }
  }

  async function handleSubmitRequest() {
    if (!activeTranscript?.trim()) {
      setSubmitError("Create a transcript before submitting.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      let requestId = selectedRequestId;
      if (!requestId) {
        const created = await api.createFromText(activeTranscript);
        requestId = created.request_id;
        setSelectedRequestId(requestId);
        setActiveFormType(created?.llm?.form_type || activeFormType);
      }

      const formType = activeFormType || activeSummary?.formName || null;
      const serializedFields = serializeFieldsForApi(formType, activeFields);
      const updated = await api.updateFields(requestId, serializedFields, formType);
      setActiveFields(toDraftFields(updated.fields || {}));
      setActiveMissingFields(updated.missing_fields || []);
      setActiveFormType(updated.form_type || formType || "");
      if (updated.missing_fields?.length) {
        setSubmitError(`Missing required fields: ${updated.missing_fields.map(fieldLabel).join(", ")}`);
        return;
      }

      await api.submitRequest(requestId);
      setSubmitStatus("submitted");
    } catch (error) {
      setSubmitError(error?.message || "Could not submit this request.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleQuickAction(label) {
    if (label === "Record voice") {
      void startRecording();
      return;
    }

    const templates = {
      "Cash Advance": "I want to request $100 cash advance for a business activity.",
      "Expense Claim": "I want to claim $100 for my business trip expense.",
      "Material Request": "I want to request office material for my team.",
      "Record voice": TRANSCRIPT_TEXT,
    };
    setMessage(templates[label] || TRANSCRIPT_TEXT);
  }

  return (
    <div className="square-mockup-page">
      <div className={`square-mobile-scrim ${drawerOpen ? "is-open" : ""}`} onClick={() => setDrawerOpen(false)} />
      <div className="square-mockup">
        <header className="square-mobile-header">
          <button className="square-mobile-header__menu" type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <span />
            <span />
            <span />
          </button>
          <div>
            <strong>Speech Request System</strong>
            <span>Employee workspace</span>
          </div>
          <div className="square-mobile-header__avatar">{(currentUser?.name || "P").slice(0, 1)}</div>
        </header>

        <Sidebar
          currentUser={currentUser}
          requests={requests}
          activeFilter={activeFilter}
          selectedRequestId={selectedRequestId}
          drawerOpen={drawerOpen}
          onFilterSelect={setActiveFilter}
          onRequestSelect={handleRequestSelect}
          onNewRequest={handleNewRequest}
          onCloseDrawer={() => setDrawerOpen(false)}
          onThemeToggle={onThemeToggle}
          onLogout={onLogout}
        />

        <main className="square-main">
          <header className="square-main__header">
            <div>
              <h1>Smart request assistant</h1>
              <p>Your speech has been transcribed and converted into a structured request.</p>
            </div>
            <span>Draft ready</span>
          </header>

          <div className="square-response-stack">
            {hasResponse ? (
              <div className="square-response-layout">
                <div className="square-response-main">
                  <TranscriptCard text={activeTranscript} />
                <EditableSummaryCard
                  key={`${activeSummary.quoteNumber}-${activeSummary.description}`}
                  summary={activeSummary}
                  fields={activeFields}
                  missingFields={activeMissingFields}
                  onFieldChange={handleRequiredFieldChange}
                  onSubmit={() => void handleSubmitRequest()}
                  submitting={submitting}
                  submitted={submitStatus === "submitted"}
                  submitError={submitError}
                  onKeyDown={handleSummaryKeyDown}
                />
                </div>
                {developmentAsr.candidates.length ? (
                  <aside className="square-development-rail">
                    <details className="square-development-panel" open>
                      <summary>Development</summary>
                      <TranscriptComparison
                        candidates={developmentAsr.candidates}
                        selectedModel={developmentAsr.selectedModel}
                      />
                    </details>
                  </aside>
                ) : null}
              </div>
            ) : (
              <section className="square-empty-state">
                <button
                  className={`square-empty-state__mark ${isRecording ? "is-recording" : ""}`}
                  type="button"
                  onClick={handleToggleRecording}
                  aria-label={isRecording ? "Stop recording" : "Start recording"}
                >
                  <MicrophoneIcon />
                </button>
                <h2>Start a new request</h2>
                <p>Type a request, record voice, or choose a quick action. The assistant will return the transcript and structured request summary here.</p>
              </section>
            )}
          </div>

          <ChatInput
            message={message}
            isRecording={isRecording}
            recordingSeconds={recordingSeconds}
            recordingStatus={recordingStatus}
            onMessageChange={setMessage}
            onSend={handleSend}
            onQuickAction={handleQuickAction}
            onToggleRecording={handleToggleRecording}
            onUploadAudio={(file) => void handleAudioFile(file)}
          />
        </main>
      </div>
    </div>
  );
}
