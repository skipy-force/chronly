import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { SCREENS, useUiStore } from '../../store/uiStore'
import { SCREEN_ICONS } from '../../lib/screenIcons'
import { useT } from '../../lib/i18n'

export function TabsShell({ children }: { children: ReactNode }) {
  const { activeScreen, setActiveScreen } = useUiStore()
  const t = useT()
  return (
    <div className="flex h-screen flex-col bg-surface text-on-surface">
      <nav className="flex gap-1 bg-surface-container/40 p-2">
        {SCREENS.map((screen) => {
          const Icon = SCREEN_ICONS[screen.id]
          return (
            <button
              key={screen.id}
              onClick={() => setActiveScreen(screen.id)}
              className={`relative flex items-center gap-2 rounded-pill px-4 py-1.5 text-sm ${
                activeScreen === screen.id ? 'text-surface' : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {activeScreen === screen.id && (
                <motion.div
                  layoutId="tabs-active-pill"
                  className="absolute inset-0 rounded-pill bg-primary"
                  transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
                />
              )}
              <Icon size={16} className="relative shrink-0" />
              <span className="relative">{t(screen.labelKey)}</span>
            </button>
          )
        })}
      </nav>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
