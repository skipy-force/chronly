import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { User } from 'lucide-react'
import { SCREENS, useUiStore } from '../../store/uiStore'
import { SCREEN_ICONS } from '../../lib/screenIcons'

export function SidebarShell({ children }: { children: ReactNode }) {
  const { activeScreen, setActiveScreen, displayName } = useUiStore()
  return (
    <div className="flex h-screen bg-surface text-on-surface">
      <nav className="flex w-44 flex-col gap-1 bg-surface-container/40 p-3">
        <div className="mb-3 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-sm font-semibold text-on-surface-variant">
            {displayName ? displayName.charAt(0).toUpperCase() : <User size={16} />}
          </div>
          <span className="truncate text-sm font-semibold">{displayName || 'chronly'}</span>
        </div>

        {SCREENS.map((screen) => {
          const Icon = SCREEN_ICONS[screen.id]
          return (
            <button
              key={screen.id}
              onClick={() => setActiveScreen(screen.id)}
              className={`relative flex items-center gap-3 rounded-pill px-3 py-2.5 text-sm ${
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
              <Icon size={18} className="relative shrink-0" />
              <span className="relative">{screen.label}</span>
            </button>
          )
        })}
      </nav>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
