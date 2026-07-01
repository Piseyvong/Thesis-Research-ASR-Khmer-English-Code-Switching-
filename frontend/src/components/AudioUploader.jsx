export default function AudioUploader({ disabled, onFile }) {
  return (
    <div className="card">
      <div className="card-title">Upload audio</div>
      <input
        type="file"
        accept="audio/*"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <div className="hint">WAV is most reliable. Other formats may require ffmpeg for decoding.</div>
    </div>
  );
}
