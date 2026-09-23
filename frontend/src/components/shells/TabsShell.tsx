import { ReactNode } from 'react'
import { SCREENS, useUiStore } from '../../store/uiStore'

export function TabsShell({ children }: { children: ReactNode }) {
  const { activeScreen, setActiveScreen } = useUiStore()
  return (
    <div className="flex h-screen flex-col bg-surface text-on-surface">
      <nav className="flex gap-1 border-b border-outline p-2">
        {SCREENS.map((screen) => (
          <button
            key={screen.id}
            onClick={() => setActiveScreen(screen.id)}
            className={`rounded-pill px-4 py-1.5 text-sm ${
              activeScreen === screen.id
                ? 'bg-primary text-surface'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {screen.label}
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
