export type ThemePresetId = 'auto' | 'dracula' | 'nord' | 'catppuccin'

export interface ThemePresetColors {
  primary: string
  secondary: string
  tertiary: string
  surface: string
  surfaceContainer: string
  surfaceContainerHigh: string
  onSurface: string
  onSurfaceVariant: string
  outline: string
  error: string
}

export const THEME_PRESETS: Record<Exclude<ThemePresetId, 'auto'>, { name: string; colors: ThemePresetColors }> = {
  dracula: {
    name: 'Dracula',
    colors: {
      primary: '#bd93f9',
      secondary: '#ff79c6',
      tertiary: '#8be9fd',
      surface: '#282a36',
      surfaceContainer: '#343746',
      surfaceContainerHigh: '#44475a',
      onSurface: '#f8f8f2',
      onSurfaceVariant: '#bfbfd1',
      outline: '#6272a4',
      error: '#ff5555',
    },
  },
  nord: {
    name: 'Nord',
    colors: {
      primary: '#88c0d0',
      secondary: '#81a1c1',
      tertiary: '#b48ead',
      surface: '#2e3440',
      surfaceContainer: '#3b4252',
      surfaceContainerHigh: '#434c5e',
      onSurface: '#eceff4',
      onSurfaceVariant: '#d8dee9',
      outline: '#4c566a',
      error: '#bf616a',
    },
  },
  catppuccin: {
    name: 'Catppuccin',
    colors: {
      primary: '#cba6f7',
      secondary: '#f5c2e7',
      tertiary: '#94e2d5',
      surface: '#1e1e2e',
      surfaceContainer: '#292c3c',
      surfaceContainerHigh: '#313244',
      onSurface: '#cdd6f4',
      onSurfaceVariant: '#a6adc8',
      outline: '#6c7086',
      error: '#f38ba8',
    },
  },
}

const CSS_VAR_MAP: Record<keyof ThemePresetColors, string> = {
  primary: '--color-primary',
  secondary: '--color-secondary',
  tertiary: '--color-tertiary',
  surface: '--color-surface',
  surfaceContainer: '--color-surface-container',
  surfaceContainerHigh: '--color-surface-container-high',
  onSurface: '--color-on-surface',
  onSurfaceVariant: '--color-on-surface-variant',
  outline: '--color-outline',
  error: '--color-error',
}

export function applyThemePreset(presetId: ThemePresetId) {
  const root = document.documentElement.style
  if (presetId === 'auto') {
    for (const cssVar of Object.values(CSS_VAR_MAP)) root.removeProperty(cssVar)
    return
  }
  const preset = THEME_PRESETS[presetId]
  for (const key of Object.keys(CSS_VAR_MAP) as (keyof ThemePresetColors)[]) {
    root.setProperty(CSS_VAR_MAP[key], preset.colors[key])
  }
}
