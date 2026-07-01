export default function ChatMessage({ role, content, createdAt, children, bubbleClassName = "", labelOverride }) {
  const side = role === "employee" ? "chat chat-right" : role === "manager" ? "chat chat-manager" : "chat";
  const label = labelOverride || (role === "employee" ? "Employee" : role === "manager" ? "Manager" : "Assistant");
  const bubbleClass = `${role === "employee" ? "chat-bubble is-employee" : role === "manager" ? "chat-bubble is-manager" : "chat-bubble"} ${bubbleClassName}`.trim();

  return (
    <div className={side}>
      <div className="chat-meta">
        <span className="chat-role">{label}</span>
        {createdAt ? <span className="chat-time">{new Date(createdAt).toLocaleString()}</span> : null}
      </div>
      <div className={bubbleClass}>{children || content}</div>
    </div>
  );
}
