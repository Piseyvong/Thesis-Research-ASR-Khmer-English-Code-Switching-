export default function StatusBadge({ status }) {
  const s = status || "-";
  const cls = {
    Draft: "badge",
    Submitted: "badge badge-blue",
    Approved: "badge badge-green",
    Rejected: "badge badge-red",
    Returned: "badge badge-amber",
    "Needs clarification": "badge badge-amber",
  }[s] || "badge";

  return <span className={cls}>{s}</span>;
}
