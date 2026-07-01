import { useRef } from "react";
import { MicrophoneIcon, PlusIcon, SendIcon, UploadIcon } from "./Icons";

export const AUDIO_ACCEPT = ".wav,.flac,.ogg,.m4a,audio/wav,audio/flac,audio/ogg,audio/mp4,audio/x-m4a";

export default function RequestComposer({
  disabled,
  message,
  onMessageChange,
  onSend,
  onSelectFile,
  onOpenVoice,
  canSend,
  fileName,
  showCreateHint,
}) {
  const inputRef = useRef(null);

  function handleChooseFile() {
    inputRef.current?.click();
  }

  return (
    <div className="composer">
      {fileName ? (
        <div className="composer__file">
          <UploadIcon />
          <span>{fileName}</span>
        </div>
      ) : null}

      <div className="composer__bar">
        <button className="icon-button composer__icon" type="button" onClick={handleChooseFile} disabled={disabled} aria-label="Upload audio file">
          <PlusIcon />
        </button>

        <input
          className="composer__input"
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          disabled={disabled}
          placeholder="Paste text, upload audio, or start speaking"
          aria-label="Request message input"
        />

        <div className="composer__actions">
          <span className="composer__mode">Request</span>
          <button className="icon-button composer__icon" type="button" onClick={onOpenVoice} disabled={disabled} aria-label="Start voice input">
            <MicrophoneIcon />
          </button>
          <button className="icon-button icon-button--filled composer__send" type="button" onClick={onSend} disabled={!canSend || disabled} aria-label="Submit request message">
            <SendIcon />
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={AUDIO_ACCEPT}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onSelectFile(file);
          }
          event.target.value = "";
        }}
      />

      <div className="composer__hint">
        {showCreateHint
          ? "Start with typed text, a WAV/FLAC/OGG/M4A upload, or voice input to create a request, then continue the conversation naturally."
          : "Upload WAV/FLAC/OGG/M4A audio, record speech, or refine the extracted request details here."}
      </div>
    </div>
  );
}
