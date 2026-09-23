import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useUiStore, type NavStyle } from '../store/uiStore'

const TIER_LABELS: Record<string, string> = {
  wayland: 'Wayland (ext-idle-notify-v1)',
  evdev: 'Raw input devices (mouse + keyboard)',
  none: 'Unavailable — window tracking only, no AFK detection',
}

export function SettingsScreen() {
  const { navStyle, setNavStyle } = useUiStore()
  const { data: tier } = useQuery({
    queryKey: ['idleDetectorTier'],
    queryFn: async () => api.getIdleDetectorTier(),
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">Navigation style</h2>
        <div className="flex gap-2">
          {(['sidebar', 'tabs', 'palette'] as NavStyle[]).map((style) => (
            <button
              key={style}
              onClick={() => setNavStyle(style)}
              className={`rounded-pill px-4 py-1.5 text-sm ${
                navStyle === style ? 'bg-primary text-surface' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">Idle detection</h2>
        <div
          className={`rounded-lg p-3 text-sm ${
            tier === 'none' ? 'bg-error/10 text-error' : 'bg-surface-container'
          }`}
        >
          {tier ? TIER_LABELS[tier] ?? tier : 'Loading...'}
        </div>
      </section>
    </div>
  )
}
