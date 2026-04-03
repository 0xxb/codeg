"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import type { AppearanceSettings } from "./types"
import {
  ACCENT_PRESETS,
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  DENSITY_VALUES,
} from "./constants"
import type { ReactNode } from "react"
import { createElement } from "react"

interface AppearanceContextType {
  settings: AppearanceSettings
  update: <K extends keyof AppearanceSettings>(
    key: K,
    value: AppearanceSettings[K]
  ) => void
}

const AppearanceContext = createContext<AppearanceContextType>({
  settings: DEFAULT_APPEARANCE,
  update: () => {},
})

function loadSettings(): AppearanceSettings {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (!raw) return DEFAULT_APPEARANCE
    return { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

function saveSettings(settings: AppearanceSettings) {
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(settings))
}

function applyToDOM(settings: AppearanceSettings) {
  const root = document.documentElement.style
  const isDark = document.documentElement.classList.contains("dark")

  // Accent color
  const accent = ACCENT_PRESETS[settings.accentColor]
  const accentValue = isDark ? accent.dark : accent.light
  root.setProperty("--primary", accentValue)
  root.setProperty("--ring", accentValue)
  root.setProperty("--sidebar-primary", accentValue)

  // Fonts
  root.setProperty("--font-sans", settings.uiFont)
  root.setProperty("--font-code", settings.codeFont)

  // Font sizes
  root.setProperty("--font-size-base", `${settings.uiFontSize}px`)
  root.setProperty("--font-size-code", `${settings.codeFontSize}px`)

  // Density
  const density = DENSITY_VALUES[settings.density]
  root.setProperty("--density-padding", density.padding)
  root.setProperty("--density-gap", density.gap)
  root.setProperty("--density-line-height", density.lineHeight)

  // Reduce motion
  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches
  const shouldReduce =
    settings.reduceMotion === "on" ||
    (settings.reduceMotion === "system" && prefersReduced)
  root.setProperty("--transition-duration", shouldReduce ? "0s" : "")
  root.setProperty("--animation-duration", shouldReduce ? "0s" : "")
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppearanceSettings>(loadSettings)

  // Apply CSS variables whenever settings or theme class changes
  useEffect(() => {
    applyToDOM(settings)

    // Re-apply when dark/light class changes (accent color depends on it)
    const observer = new MutationObserver(() => applyToDOM(settings))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => observer.disconnect()
  }, [settings])

  // Cross-tab sync
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === APPEARANCE_STORAGE_KEY && e.newValue) {
        try {
          setSettings({ ...DEFAULT_APPEARANCE, ...JSON.parse(e.newValue) })
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener("storage", handler)
    return () => window.removeEventListener("storage", handler)
  }, [])

  const update = useCallback(
    <K extends keyof AppearanceSettings>(
      key: K,
      value: AppearanceSettings[K]
    ) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value }
        saveSettings(next)
        return next
      })
    },
    []
  )

  return createElement(
    AppearanceContext.Provider,
    { value: { settings, update } },
    children
  )
}

export function useAppearance() {
  return useContext(AppearanceContext)
}
