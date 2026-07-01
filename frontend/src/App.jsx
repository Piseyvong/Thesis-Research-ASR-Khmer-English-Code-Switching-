import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";

import LoginScreen from "./components/LoginScreen";
import EmployeeChatPage from "./pages/EmployeeChatPage";
import ManagerDashboard from "./pages/ManagerDashboard";
import RequestDetailPage from "./pages/RequestDetailPage";
import { api, getStoredMockUserId, setApiMockUser } from "./services/api";

const THEME_KEY = "speech-request-theme";

function resolveInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") {
    return saved;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [theme, setTheme] = useState(resolveInitialTheme);
  const [users, setUsers] = useState([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(getStoredMockUserId);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    (async () => {
      setSessionLoading(true);
      setSessionError(null);
      try {
        const nextUsers = await api.listMockUsers();
        setUsers(nextUsers);
        if (currentUserId && !nextUsers.some((user) => user.id === currentUserId)) {
          setApiMockUser(null);
          setCurrentUserId(null);
        }
      } catch (error) {
        setSessionError(error?.message || String(error));
      } finally {
        setSessionLoading(false);
      }
    })();
  }, [currentUserId]);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) || null,
    [users, currentUserId]
  );
  const managers = useMemo(() => users.filter((user) => user.role === "manager"), [users]);

  async function handleLogin(credentials) {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const user = await api.loginMockUser(credentials.email, credentials.password);
      setApiMockUser(user.id);
      setCurrentUserId(user.id);
    } catch (error) {
      setLoginError(error?.message || String(error));
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    setApiMockUser(null);
    setCurrentUserId(null);
    setLoginError(null);
  }

  const sharedThemeProps = {
    theme,
    onThemeToggle: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
  };

  if (!currentUser) {
    return (
      <div className="app">
        <LoginScreen
          loading={sessionLoading || loginLoading}
          error={loginError || sessionError}
          onLogin={(credentials) => void handleLogin(credentials)}
        />
      </div>
    );
  }

  return (
    <div className="app">
      {currentUser.role === "employee" ? (
        <Routes>
          <Route path="/" element={<Navigate to="/employee" replace />} />
          <Route
            path="/employee"
            element={
              <EmployeeChatPage
                {...sharedThemeProps}
                currentUser={currentUser}
                managers={managers}
                onLogout={handleLogout}
              />
            }
          />
          <Route path="*" element={<Navigate to="/employee" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/" element={<Navigate to="/manager" replace />} />
          <Route
            path="/manager"
            element={
              <ManagerDashboard
                {...sharedThemeProps}
                currentUser={currentUser}
                onLogout={handleLogout}
              />
            }
          />
          <Route
            path="/manager/requests/:id"
            element={
              <RequestDetailPage
                {...sharedThemeProps}
                currentUser={currentUser}
                onLogout={handleLogout}
              />
            }
          />
          <Route path="*" element={<Navigate to="/manager" replace />} />
        </Routes>
      )}
    </div>
  );
}
