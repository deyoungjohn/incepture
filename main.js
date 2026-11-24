/*
 * UI interactions: theme toggle (light/dark with system fallback) and subtle
 * scroll reveals. Plain JS, zero dependencies.
 */
(() => {
  "use strict";

  const STORAGE_KEY = "incepture-theme";
  const root = document.documentElement;
  const toggle = document.getElementById("theme-toggle");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  function getStoredTheme() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  }

  function resolveTheme() {
    const stored = getStoredTheme();
    if (stored) return stored;
    return systemDark.matches ? "dark" : "light";
  }

  function applyTheme(theme, persist) {
    if (persist) {
      root.setAttribute("data-theme", theme);
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // Ignore storage errors in restricted browsing modes.
      }
    } else {
      const stored = getStoredTheme();
      if (stored) {
        root.setAttribute("data-theme", stored);
      } else {
        root.removeAttribute("data-theme");
      }
    }

    const active = resolveTheme();
    if (toggle) {
      const isDark = active === "dark";
      toggle.setAttribute("aria-pressed", String(isDark));
      toggle.setAttribute(
        "aria-label",
        isDark ? "Switch to light theme" : "Switch to dark theme"
      );
    }

    window.dispatchEvent(
      new CustomEvent("incepture:theme", { detail: { theme: active } })
    );
  }

  applyTheme(resolveTheme(), false);

  if (toggle) {
    toggle.addEventListener("click", () => {
      const next = resolveTheme() === "dark" ? "light" : "dark";
      applyTheme(next, true);
    });
  }

  systemDark.addEventListener("change", () => {
    if (!getStoredTheme()) {
      applyTheme(resolveTheme(), false);
    }
  });

  // Subtle reveal for below-the-fold sections.
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!reducedMotion.matches && "IntersectionObserver" in window) {
    const targets = document.querySelectorAll(".section .container");
    targets.forEach((el) => el.classList.add("reveal"));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach((el) => observer.observe(el));
  }
})();
