import ChatMessage from "./ChatMessage";

function valueOrFallback(value) {
  return value || "Not detected";
}

export default function TranscriptMessage({ createdAt, transcript }) {
  return (
    <ChatMessage role="assistant" createdAt={createdAt} bubbleClassName="chat-bubble--structured">
      <div className="agent-card">
        <div className="agent-card__eyebrow">I transcribed your audio.</div>
        <div className="agent-card__title">Transcript</div>
        <div className="agent-card__body mono">{valueOrFallback(transcript)}</div>
      </div>
    </ChatMessage>
  );
}
