import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { installMatugenTheme } from './lib/theme'
import { applyThemePreset } from './lib/themePresets'
import { useQueryEvents } from './lib/api'
import { Shell } from './components/shells'
import { ErrorBoundary } from './components/ErrorBoundary'
import { OnboardingModal } from './components/OnboardingModal'
import { useUiStore } from './store/uiStore'
import { TodayScreen } from './screens/TodayScreen'
import { TimelineScreen } from './screens/TimelineScreen'
import { ProjectsScreen } from './screens/ProjectsScreen'
import { RulesScreen } from './screens/RulesScreen'
import { SettingsScreen } from './screens/SettingsScreen'

function ActiveScreen() {
  const activeScreen = useUiStore((s) => s.activeScreen)
  switch (activeScreen) {
    case 'today':
      return <TodayScreen />
    case 'timeline':
      return <TimelineScreen />
    case 'projects':
      return <ProjectsScreen />
    case 'rules':
      return <RulesScreen />
    case 'settings':
      return <SettingsScreen />
  }
}

function AppShell() {
  useQueryEvents()
  const activeScreen = useUiStore((s) => s.activeScreen)
  return (
    <Shell>
      <ErrorBoundary key={activeScreen}>
        <ActiveScreen />
      </ErrorBoundary>
    </Shell>
  )
}

function useUiScale() {
  const uiScale = useUiStore((s) => s.uiScale)
  useEffect(() => {
    document.documentElement.style.fontSize = `${(16 * uiScale) / 100}px`
  }, [uiScale])
}

function useThemePreset() {
  const themePreset = useUiStore((s) => s.themePreset)
  const customAccentColor = useUiStore((s) => s.customAccentColor)
  useEffect(() => {
    applyThemePreset(themePreset)
    if (customAccentColor) {
      document.documentElement.style.setProperty('--color-primary', customAccentColor)
    }
  }, [themePreset, customAccentColor])
}

export default function App() {
  useEffect(() => installMatugenTheme(), [])
  useUiScale()
  useThemePreset()

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
      <OnboardingModal />
    </QueryClientProvider>
  )
}
