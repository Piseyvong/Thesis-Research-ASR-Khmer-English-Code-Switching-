import { useEffect, useRef, useState } from "react";
import AnimatedWaveform from "./AnimatedWaveform";
import { CloseIcon, MicrophoneIcon } from "./Icons";

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

export default function VoiceInputModal({ open, onClose, onRecorded }) {
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const shouldSubmitRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const onRecordedRef = useRef(onRecorded);

  const [error, setError] = useState(null);
  const [listening, setListening] = useState(false);
  const [stopping, setStopping] = useState(false);

  onCloseRef.current = onClose;
  onRecordedRef.current = onRecorded;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let cancelled = false;

    async function beginRecording() {
      setError(null);
      setStopping(false);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const recorder = new MediaRecorder(stream);
        chunksRef.current = [];
        shouldSubmitRef.current = false;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          setListening(false);
          stream.getTracks().forEach((track) => track.stop());

          if (!shouldSubmitRef.current) {
            onCloseRef.current?.();
            return;
          }

          try {
            const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
            const file = await convertRecordingToWav(blob);
            await onRecordedRef.current?.(file);
            onCloseRef.current?.();
          } catch (conversionError) {
            setStopping(false);
            setError(`Recording conversion failed: ${conversionError?.message || String(conversionError)}`);
          }
        };

        mediaRef.current = recorder;
        recorder.start();
        setListening(true);
      } catch (recordingError) {
        setListening(false);
        setError(recordingError?.message || String(recordingError));
      }
    }

    beginRecording();

    return () => {
      cancelled = true;
      const recorder = mediaRef.current;
      if (recorder && recorder.state !== "inactive") {
        shouldSubmitRef.current = false;
        recorder.stop();
      }
      mediaRef.current = null;
      setListening(false);
      setStopping(false);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        handleDismiss();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function handleDismiss() {
    const recorder = mediaRef.current;
    shouldSubmitRef.current = false;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }

    onCloseRef.current?.();
  }

  function handleStopAndTranscribe() {
    const recorder = mediaRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }

    shouldSubmitRef.current = true;
    setStopping(true);
    recorder.stop();
  }

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={handleDismiss}>
      <div
        className="voice-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-input-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="icon-button icon-button--ghost voice-modal__close" type="button" onClick={handleDismiss} aria-label="Close voice input">
          <CloseIcon />
        </button>

        <div className="voice-modal__badge">
          <MicrophoneIcon />
        </div>

        <h2 id="voice-input-title" className="voice-modal__title">
          Voice Input
        </h2>
        <div className="voice-modal__status">{error ? "Recording failed" : stopping ? "Transcribing" : "Listening"}</div>
        <p className="voice-modal__helper">
          {error || "Speak now. Your speech will be transcribed into the request."}
        </p>

        <AnimatedWaveform active={!error && listening && !stopping} />

        <button
          className="btn btn-primary voice-modal__action"
          type="button"
          onClick={handleStopAndTranscribe}
          disabled={Boolean(error) || !listening || stopping}
        >
          Stop and transcribe
        </button>
      </div>
    </div>
  );
}
