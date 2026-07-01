import { MoonIcon, SunIcon } from "./Icons";

export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";

  return (
    <button className="theme-toggle" type="button" onClick={onToggle} aria-label="Toggle color theme">
      <span className="theme-toggle__icon">{isDark ? <SunIcon /> : <MoonIcon />}</span>
      <span className="theme-toggle__text">
        <strong>{isDark ? "Light mode" : "Night mode"}</strong>
        <span>{isDark ? "Switch to the white workspace" : "Switch to the dark workspace"}</span>
      </span>
    </button>
  );
}
