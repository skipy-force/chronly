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
      <nav className="flex w-44 flex-col gap-1 border-r border-outline p-3">
        <div className="mb-3 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
            <User size={16} />
          </div>
          <span className="text-sm font-semibold">chronly</span>
        </div>

        {SCREENS.map((screen) => {
          const Icon = ICONS[screen.id]
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
