import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderOpen } from 'lucide-react'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { useUiStore, type NavStyle } from '../store/uiStore'

const TIER_LABELS: Record<string, string> = {
  wayland: 'Wayland (ext-idle-notify-v1)',
  evdev: 'Raw input devices (mouse + keyboard)',
  none: 'Unavailable — window tracking only, no AFK detection',
}

export function SettingsScreen() {
  const { navStyle, setNavStyle } = useUiStore()
  const queryClient = useQueryClient()

  const { data: tier } = useQuery({
    queryKey: ['idleDetectorTier'],
    queryFn: async () => api.getIdleDetectorTier(),
  })
  const { data: appState } = useQuery({
    queryKey: queryKeys.appState,
    queryFn: api.getAppState,
  })
  const { data: dbPath } = useQuery({
    queryKey: ['dbPath'],
    queryFn: api.getDBPath,
  })
  const { data: appVersion } = useQuery({
    queryKey: ['appVersion'],
    queryFn: api.getAppVersion,
  })

  const [afkMinutes, setAfkMinutes] = useState('')
  useEffect(() => {
    if (appState) setAfkMinutes(String(appState.AFKThresholdMinutes))
  }, [appState])

  const afkMutation = useMutation({
    mutationFn: (minutes: number) => api.setAFKThreshold(minutes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.appState }),
  })

  const openFolderMutation = useMutation({
    mutationFn: () => api.openDataFolder(),
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
        <h2 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">AFK threshold</h2>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={afkMinutes}
            onChange={(e) => setAfkMinutes(e.target.value)}
            className="w-20 rounded-md bg-surface-container px-3 py-1.5 text-sm outline-none [appearance:textfield] focus:ring-1 focus:ring-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-sm text-on-surface-variant">minutes of inactivity before a block is split</span>
          <button
            onClick={() => {
              const minutes = Number(afkMinutes)
              if (Number.isFinite(minutes) && minutes > 0) afkMutation.mutate(minutes)
            }}
            className="rounded-pill bg-surface-container px-3 py-1.5 text-sm hover:bg-surface-container-high"
          >
            Save
          </button>
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

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">Diagnostics</h2>
        <div className="flex flex-col gap-2 rounded-lg bg-surface-container p-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-on-surface-variant">Database</span>
            <span className="truncate font-mono text-xs">{dbPath ?? 'Loading...'}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-on-surface-variant">Version</span>
            <span className="font-mono text-xs">{appVersion ?? 'Loading...'}</span>
          </div>
          <button
            onClick={() => openFolderMutation.mutate()}
            className="mt-1 flex items-center gap-2 self-start rounded-pill bg-surface-container-high px-3 py-1.5 text-sm hover:bg-outline/20"
          >
            <FolderOpen size={14} />
            Open data folder
          </button>
        </div>
      </section>
    </div>
  )
}
