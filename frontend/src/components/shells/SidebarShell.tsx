import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { FolderKanban, Network, Settings as SettingsIcon, Sun, User, Waypoints } from 'lucide-react'
import { SCREENS, useUiStore, type ScreenId } from '../../store/uiStore'

const ICONS: Record<ScreenId, typeof Sun> = {
  today: Sun,
  timeline: Waypoints,
  projects: FolderKanban,
  rules: Network,
  settings: SettingsIcon,
}

export function SidebarShell({ children }: { children: ReactNode }) {
  const { activeScreen, setActiveScreen } = useUiStore()
  return (
    <div className="flex h-screen bg-surface text-on-surface">
      <nav className="flex w-16 flex-col items-center gap-2 border-r border-outline py-4">
        <div
          className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant"
          title="chronly"
        >
          <User size={18} />
        </div>

        {SCREENS.map((screen) => {
          const Icon = ICONS[screen.id]
          return (
            <button
              key={screen.id}
              onClick={() => setActiveScreen(screen.id)}
              title={screen.label}
              className={`relative flex w-12 items-center justify-center rounded-pill py-2.5 ${
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
              <Icon size={18} className="relative" />
            </button>
          )
        })}
      </nav>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
