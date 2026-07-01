import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";

export default function MockEmailPanel({ requestId }) {
  const [emails, setEmails] = useState([]);
  const [error, setError] = useState(null);

  async function load() {
    setError(null);
    try {
      const rows = await api.listEmails();
      setEmails(rows);
    } catch (e) {
      setError(e?.message || String(e));
    }
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!requestId) return emails;
    return emails.filter((e) => e.request_id === requestId);
  }, [emails, requestId]);

  return (
    <div className="card">
      <div className="row row-between">
        <div className="card-title">Mock emails {requestId ? `(Request ${requestId})` : ""}</div>
        <button className="btn btn-secondary" onClick={load}>
          Refresh
        </button>
      </div>
      {error ? <div className="error">{error}</div> : null}
      {filtered.length === 0 ? <div className="muted">No emails yet.</div> : null}
      <div className="emails">
        {filtered.map((e) => (
          <div key={e.id} className="email">
            <div className="email-head">
              <div className="email-subject">{e.subject}</div>
              <div className="muted">To: {e.audience}</div>
              <div className="muted">{new Date(e.created_at).toLocaleString()}</div>
            </div>
            <pre className="email-body">{e.body}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
