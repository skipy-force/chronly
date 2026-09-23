import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { installMatugenTheme } from './lib/theme'
import { useQueryEvents } from './lib/api'

function AppShell() {
  useQueryEvents()
  return (
    <div className="flex h-screen items-center justify-center bg-surface text-on-surface">
      <p>chronly</p>
    </div>
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
