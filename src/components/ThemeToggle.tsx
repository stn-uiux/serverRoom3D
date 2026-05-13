import { useTheme } from "../contexts/ThemeContext";

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div
      className="theme-toggle"
      onClick={toggleTheme}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && toggleTheme()}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      <span className="theme-toggle-icon">
        {theme === "light" ? "☀️" : "🌙"}
      </span>
      <div className="theme-toggle-track">
        <div className="theme-toggle-knob" />
      </div>
      <span className="theme-toggle-label">
        {theme === "light" ? "Light" : "Dark"}
      </span>
    </div>
  );
};
