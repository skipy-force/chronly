import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { installMatugenTheme } from './lib/theme'
import { useQueryEvents } from './lib/api'
import { Shell } from './components/shells'
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
  return (
    <Shell>
      <ActiveScreen />
    </Shell>
  )
}

export default function App() {
  useEffect(() => installMatugenTheme(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  )
}
