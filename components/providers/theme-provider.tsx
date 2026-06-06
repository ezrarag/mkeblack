"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";
export type VisitorOrientation = "browsing" | "business" | "events_offers";
export type SetupGuideTaskStatus = "todo" | "complete" | "disabled";
export type SetupGuideAudience = "all" | "visitor" | "business" | "admin";

export type SetupGuideTask = {
  id: string;
  title: string;
  description: string;
  status: SetupGuideTaskStatus;
  audience: SetupGuideAudience;
  action?: ReactNode;
};

type SetupGuideState = {
  dismissed: boolean;
  completedTaskIds: string[];
  orientation: VisitorOrientation | null;
  updatedAt: string | null;
};

type ThemeContextValue = {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setupGuideState: SetupGuideState;
  setupGuideNeedsAttention: boolean;
  setThemePreference: (preference: ThemePreference) => void;
  setVisitorOrientation: (orientation: VisitorOrientation) => void;
  completeSetupTask: (taskId: string) => void;
  dismissSetupGuide: () => void;
  resetSetupGuide: () => void;
};

const THEME_STORAGE_KEY = "mkeblack_theme_preference";
const SETUP_STORAGE_KEY = "mkeblack_setup_guide";

const defaultSetupGuideState: SetupGuideState = {
  dismissed: false,
  completedTaskIds: [],
  orientation: null,
  updatedAt: null
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

function normalizeThemePreference(value: string | null): ThemePreference {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}

function normalizeSetupGuideState(value: string | null): SetupGuideState {
  if (!value) {
    return defaultSetupGuideState;
  }

  try {
    const parsed = JSON.parse(value) as Partial<SetupGuideState>;
    return {
      dismissed: Boolean(parsed.dismissed),
      completedTaskIds: Array.isArray(parsed.completedTaskIds)
        ? parsed.completedTaskIds.filter((item): item is string => typeof item === "string")
        : [],
      orientation:
        parsed.orientation === "browsing" ||
        parsed.orientation === "business" ||
        parsed.orientation === "events_offers"
          ? parsed.orientation
          : null,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null
    };
  } catch {
    return defaultSetupGuideState;
  }
}

function withUpdatedAt(state: SetupGuideState): SetupGuideState {
  return {
    ...state,
    updatedAt: new Date().toISOString()
  };
}

function taskCompleted(state: SetupGuideState, taskId: string) {
  return state.completedTaskIds.includes(taskId);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [setupGuideState, setSetupGuideState] = useState<SetupGuideState>(
    defaultSetupGuideState
  );
  const [storageLoaded, setStorageLoaded] = useState(false);

  useEffect(() => {
    const nextPreference = normalizeThemePreference(
      window.localStorage.getItem(THEME_STORAGE_KEY)
    );
    const nextSetupState = normalizeSetupGuideState(
      window.localStorage.getItem(SETUP_STORAGE_KEY)
    );

    setThemePreferenceState(nextPreference);
    setResolvedTheme(resolveTheme(nextPreference));
    setSetupGuideState(nextSetupState);
    setStorageLoaded(true);
  }, []);

  useEffect(() => {
    if (!storageLoaded) {
      return;
    }

    const nextTheme = resolveTheme(themePreference);
    setResolvedTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.dataset.themePreference = themePreference;
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);

    if (themePreference !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function handleSystemThemeChange() {
      const systemTheme = getSystemTheme();
      setResolvedTheme(systemTheme);
      document.documentElement.dataset.theme = systemTheme;
    }

    media.addEventListener("change", handleSystemThemeChange);
    return () => media.removeEventListener("change", handleSystemThemeChange);
  }, [storageLoaded, themePreference]);

  useEffect(() => {
    if (!storageLoaded) {
      return;
    }

    window.localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(setupGuideState));
  }, [setupGuideState, storageLoaded]);

  const setupGuideNeedsAttention = useMemo(() => {
    if (setupGuideState.dismissed) {
      return false;
    }

    const themeSatisfied =
      themePreference !== "system" || taskCompleted(setupGuideState, "theme");
    const orientationSatisfied = taskCompleted(setupGuideState, "orientation");

    return !themeSatisfied || !orientationSatisfied;
  }, [setupGuideState, themePreference]);

  function setThemePreference(preference: ThemePreference) {
    setThemePreferenceState(preference);
  }

  function completeSetupTask(taskId: string) {
    setSetupGuideState((current) => {
      if (current.completedTaskIds.includes(taskId)) {
        return withUpdatedAt(current);
      }

      return withUpdatedAt({
        ...current,
        completedTaskIds: [...current.completedTaskIds, taskId]
      });
    });
  }

  function setVisitorOrientation(orientation: VisitorOrientation) {
    setSetupGuideState((current) =>
      withUpdatedAt({
        ...current,
        orientation,
        completedTaskIds: Array.from(
          new Set([...current.completedTaskIds, "orientation"])
        )
      })
    );
  }

  function dismissSetupGuide() {
    setSetupGuideState((current) =>
      withUpdatedAt({
        ...current,
        dismissed: true
      })
    );
  }

  function resetSetupGuide() {
    setSetupGuideState(defaultSetupGuideState);
  }

  return (
    <ThemeContext.Provider
      value={{
        themePreference,
        resolvedTheme,
        setupGuideState,
        setupGuideNeedsAttention,
        setThemePreference,
        setVisitorOrientation,
        completeSetupTask,
        dismissSetupGuide,
        resetSetupGuide
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeSettings() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useThemeSettings must be used inside ThemeProvider.");
  }

  return context;
}
