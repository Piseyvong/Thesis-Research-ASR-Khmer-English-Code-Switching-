import { useState } from "react";
import ThemeToggle from "./ThemeToggle";
import {
  BrandMark,
  ClockIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  ClipboardIcon,
  LogoutIcon,
  SidebarToggleIcon,
} from "./Icons";

function formatHistoryTitle(request) {
  return request.form_type || request.summary || request.request_number || `Request #${request.id}`;
}

function formatHistoryMeta(request) {
  return [request.status, new Date(request.updated_at || request.created_at).toLocaleDateString()].filter(Boolean).join(" - ");
}

function getInitials(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";
}

export default function Sidebar({
  currentUser,
  portalLabel,
  primaryActionLabel,
  onPrimaryAction,
  filters,
  activeFilter,
  onFilterChange,
  requests,
  selectedRequestId,
  searchValue,
  onSearchChange,
  onSelectRequest,
  historyTitle,
  theme,
  onThemeToggle,
  onLogout,
  showSearch = true,
  showHistory = true,
}) {
  const portalIcon = currentUser?.role === "manager" ? ShieldIcon : ClipboardIcon;
  const PortalIcon = portalIcon;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="sidebar__top">
        <div className="sidebar__header">
          <div className="sidebar__brand">
            <div className="sidebar__logo">
              <BrandMark />
            </div>
            <div className="sidebar__brand-copy">
              <div className="sidebar__brand-name">Speech Request System</div>
              <div className="sidebar__brand-meta">Khmer-English internal workflow</div>
            </div>
            <button
              className="sidebar__toggle"
              type="button"
              onClick={() => setCollapsed((current) => !current)}
              aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
              title={collapsed ? "Open sidebar" : "Close sidebar"}
            >
              <SidebarToggleIcon />
            </button>
          </div>

          {primaryActionLabel ? (
            <button className="sidebar__new-button" type="button" onClick={onPrimaryAction}>
              <PlusIcon />
              <span>{primaryActionLabel}</span>
            </button>
          ) : null}
        </div>

        <div className="sidebar__nav" aria-label="Portal">
          <div className="sidebar__nav-item is-active">
            <PortalIcon />
            <span>{portalLabel}</span>
          </div>
        </div>

        {filters?.length ? (
          <div className="sidebar__filters">
            {filters.map((filter) => (
              <button
                key={filter.key}
                className={`sidebar__filter-chip ${filter.key === activeFilter ? "is-active" : ""}`}
                type="button"
                onClick={() => onFilterChange(filter.key)}
              >
                <span>{filter.label}</span>
                <span>{filter.count}</span>
              </button>
            ))}
          </div>
        ) : null}

        {showSearch ? (
          <label className="sidebar__search">
            <SearchIcon />
            <input
              type="search"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search requests"
              aria-label="Search requests"
            />
          </label>
        ) : null}
      </div>

      {showHistory ? (
        <div className="sidebar__history">
          <div className="sidebar__section-head">
            <span>{historyTitle}</span>
            <span>{requests.length}</span>
          </div>

          <div className="sidebar__history-list sidebar-scroll">
            {requests.length === 0 ? (
              <div className="sidebar__empty">No requests match the current view.</div>
            ) : (
              requests.map((request) => (
                <button
                  key={request.id}
                  className={`sidebar__history-item ${request.id === selectedRequestId ? "is-active" : ""}`}
                  type="button"
                  onClick={() => onSelectRequest(request.id)}
                >
                  <div className="sidebar__history-icon">
                    <ClockIcon />
                  </div>
                  <div className="sidebar__history-copy">
                    <div className="sidebar__history-title">{formatHistoryTitle(request)}</div>
                    <div className="sidebar__history-meta">{formatHistoryMeta(request)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="sidebar__spacer" />
      )}

      <div className="sidebar__footer">
        <div className="sidebar__settings">
          <div className="sidebar__section-head">
            <span>Settings</span>
            <SettingsIcon />
          </div>
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        </div>

        <div className="sidebar__profile">
          <div className="sidebar__profile-avatar">{getInitials(currentUser?.name)}</div>
          <div className="sidebar__profile-copy">
            <div className="sidebar__profile-name">{currentUser?.name}</div>
            <div className="sidebar__profile-meta">{currentUser?.department}</div>
            <div className="sidebar__profile-meta">{currentUser?.email}</div>
          </div>
          <button className="icon-button icon-button--ghost" type="button" onClick={onLogout} aria-label="Log out">
            <LogoutIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}
