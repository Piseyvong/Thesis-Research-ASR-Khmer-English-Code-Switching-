const BAR_HEIGHTS = [18, 28, 20, 36, 24, 40, 22, 32, 18, 30];

export default function AnimatedWaveform({ active = true }) {
  return (
    <div className={`waveform ${active ? "is-active" : ""}`} aria-hidden="true">
      {BAR_HEIGHTS.map((height, index) => (
        <span key={`${height}-${index}`} style={{ "--wave-height": `${height}px`, "--wave-index": index }} />
      ))}
    </div>
  );
}
