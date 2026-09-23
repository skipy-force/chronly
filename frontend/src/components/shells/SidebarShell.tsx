import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { SCREENS, useUiStore } from '../../store/uiStore'

export function SidebarShell({ children }: { children: ReactNode }) {
  const { activeScreen, setActiveScreen } = useUiStore()
  return (
    <div className="flex h-screen bg-surface text-on-surface">
      <nav className="flex w-16 flex-col items-center gap-2 border-r border-outline py-4">
        {SCREENS.map((screen) => (
          <button
            key={screen.id}
            onClick={() => setActiveScreen(screen.id)}
            className={`relative w-12 rounded-pill py-2 text-xs ${
              activeScreen === screen.id ? 'text-surface' : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {activeScreen === screen.id && (
              <motion.div
                layoutId="sidebar-active-pill"
                className="absolute inset-0 rounded-pill bg-primary"
                transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
              />
            )}
            <span className="relative">{screen.label.slice(0, 2)}</span>
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
