import { FileAudioIcon } from "./Icons";

export default function DragDropOverlay({ visible }) {
  if (!visible) {
    return null;
  }

  return (
    <div className="drag-overlay" aria-hidden="true">
      <div className="drag-overlay__card">
        <div className="drag-overlay__icon">
          <FileAudioIcon />
        </div>
        <div className="drag-overlay__title">Add audio file</div>
        <div className="drag-overlay__text">Drop an audio file here to create a transcription request</div>
      </div>
    </div>
  );
}
