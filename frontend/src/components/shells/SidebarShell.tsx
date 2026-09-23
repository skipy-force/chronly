import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { SCREENS, useUiStore } from '../../store/uiStore'
import { SCREEN_ICONS } from '../../lib/screenIcons'
import { useT } from '../../lib/i18n'
import { Avatar } from '../Avatar'

export function SidebarShell({ children }: { children: ReactNode }) {
  const { activeScreen, setActiveScreen, displayName, avatarDataUri } = useUiStore()
  const t = useT()
  return (
    <div className="flex h-screen bg-surface text-on-surface">
      <nav className="flex w-44 flex-col gap-1 bg-surface-container/40 p-3">
        <div className="mb-3 flex items-center gap-2 px-2">
          <Avatar displayName={displayName} avatarDataUri={avatarDataUri} size={36} />
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
              <span className="relative">{t(screen.labelKey)}</span>
            </button>
          )
        })}
      </nav>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
