import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, View, useColorScheme as useSystemColorScheme } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { SchemeColors, type ColorScheme } from "@/constants/theme";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  themePreference: 'light' | 'dark' | 'system';
  setThemePreference: (preference: 'light' | 'dark' | 'system') => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? "light";
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(systemScheme);
  const [themePreference, setThemePreferenceState] = useState<'light' | 'dark' | 'system'>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load theme preference from storage
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const stored = await AsyncStorage.getItem('themePreference');
        if (stored) {
          setThemePreferenceState(stored as 'light' | 'dark' | 'system');
        }
      } catch (error) {
        console.error('Error loading theme preference:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadThemePreference();
  }, []);

  const applyScheme = useCallback((scheme: ColorScheme) => {
    nativewindColorScheme.set(scheme);
    Appearance.setColorScheme?.(scheme);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      const palette = SchemeColors[scheme];
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, value);
      });
    }
  }, []);

  const getEffectiveScheme = useCallback((): ColorScheme => {
    if (themePreference === 'system') {
      return systemScheme;
    }
    return themePreference as ColorScheme;
  }, [themePreference, systemScheme]);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    applyScheme(scheme);
  }, [applyScheme]);

  const setThemePreference = useCallback(async (preference: 'light' | 'dark' | 'system') => {
    setThemePreferenceState(preference);
    try {
      await AsyncStorage.setItem('themePreference', preference);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
    // Apply the new theme immediately
    const effectiveScheme = preference === 'system' ? systemScheme : (preference as ColorScheme);
    setColorScheme(effectiveScheme);
  }, [systemScheme, setColorScheme]);

  // Apply scheme when theme preference or system scheme changes
  useEffect(() => {
    if (isLoaded) {
      const effectiveScheme = getEffectiveScheme();
      applyScheme(effectiveScheme);
      setColorSchemeState(effectiveScheme);
    }
  }, [themePreference, systemScheme, isLoaded, applyScheme, getEffectiveScheme]);

  const themeVariables = useMemo(
    () =>
      vars({
        "color-primary": SchemeColors[colorScheme].primary,
        "color-background": SchemeColors[colorScheme].background,
        "color-surface": SchemeColors[colorScheme].surface,
        "color-foreground": SchemeColors[colorScheme].foreground,
        "color-muted": SchemeColors[colorScheme].muted,
        "color-border": SchemeColors[colorScheme].border,
        "color-success": SchemeColors[colorScheme].success,
        "color-warning": SchemeColors[colorScheme].warning,
        "color-error": SchemeColors[colorScheme].error,
      }),
    [colorScheme],
  );

  const value = useMemo(
    () => ({
      colorScheme,
      setColorScheme,
      themePreference,
      setThemePreference,
    }),
    [colorScheme, setColorScheme, themePreference, setThemePreference],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}
