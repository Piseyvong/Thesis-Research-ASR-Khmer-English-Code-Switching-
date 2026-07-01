import { useEffect, useRef, useState } from "react";

export default function AudioRecorder({ disabled, onRecorded }) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(null);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    return () => {
      if (mediaRef.current && mediaRef.current.state !== "inactive") {
        mediaRef.current.stop();
      }
    };
  }, []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const file = new File([blob], `recording.${(mr.mimeType || "audio/webm").includes("ogg") ? "ogg" : "webm"}`, {
          type: blob.type,
        });
        onRecorded?.(file);
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      setError(e?.message || String(e));
    }
  }

  function stop() {
    if (!mediaRef.current) return;
    try {
      mediaRef.current.stop();
    } finally {
      setRecording(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Record audio</div>
      <div className="row">
        {!recording ? (
          <button className="btn" disabled={disabled} onClick={start}>
            Start recording
          </button>
        ) : (
          <button className="btn btn-danger" onClick={stop}>
            Stop
          </button>
        )}
        <div className="hint">Recording uses MediaRecorder. Unsupported audio formats are reported as an error.</div>
      </div>
      {error ? <div className="error">{error}</div> : null}
    </div>
  );
}
