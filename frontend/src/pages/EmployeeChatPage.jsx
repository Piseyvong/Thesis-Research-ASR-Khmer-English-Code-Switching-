import { useEffect, useState } from "react";
import SquareSpeechRequestMockup from "../components/SquareSpeechRequestMockup";
import { api } from "../services/api";

export default function EmployeeChatPage({ currentUser, onLogout, onThemeToggle }) {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadRequests() {
      try {
        const list = await api.listRequests();
        if (!cancelled) {
          setRequests(list);
        }
      } catch {
        if (!cancelled) {
          setRequests([]);
        }
      }
    }

    void loadRequests();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SquareSpeechRequestMockup
      currentUser={currentUser}
      requests={requests}
      onThemeToggle={onThemeToggle}
      onLogout={onLogout}
    />
  );
}
