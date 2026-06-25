import { useEffect, useState } from "react";
import { AttachmentsDashboard } from "./attachments/AttachmentsDashboard";
import { getEmbeddedTheme, isEmbeddedMode, subscribeToEmbeddedTheme } from "./lib/chatwoot";

type Theme = "light" | "dark";

export function App() {
  const embedded = isEmbeddedMode();
  const [systemTheme, setSystemTheme] = useState<Theme>(() => getSystemTheme());
  const [embeddedTheme, setEmbeddedTheme] = useState<Theme | null>(() => (embedded ? getEmbeddedTheme() : null));

  const theme = embedded ? embeddedTheme ?? systemTheme : systemTheme;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    setSystemTheme(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    if (!embedded) {
      setEmbeddedTheme(null);
      return;
    }

    setEmbeddedTheme(getEmbeddedTheme());
    return subscribeToEmbeddedTheme(setEmbeddedTheme);
  }, [embedded]);

  return (
    <>
      <AttachmentsDashboard />
    </>
  );
}

function getSystemTheme(): Theme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
