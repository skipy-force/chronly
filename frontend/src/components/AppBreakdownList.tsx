import { formatHoursMinutes } from '../lib/dates'

interface AppBreakdownEntry {
  appName: string
  minutes: number
}

interface AppBreakdownListProps {
  entries: AppBreakdownEntry[]
}

export function AppBreakdownList({ entries }: AppBreakdownListProps) {
  const max = Math.max(1, ...entries.map((e) => e.minutes))

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-surface-container p-6 text-sm text-on-surface-variant">
        No activity tracked yet today
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <div key={entry.appName} className="flex items-center gap-3 rounded-lg bg-surface-container p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-xs font-semibold uppercase text-on-surface-variant">
            {entry.appName.charAt(0) || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{entry.appName || 'Unknown'}</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-pill bg-surface-container-high">
              <div className="h-full rounded-pill bg-primary" style={{ width: `${(entry.minutes / max) * 100}%` }} />
            </div>
          </div>
          <span className="shrink-0 font-mono text-sm text-on-surface-variant">
            {formatHoursMinutes(entry.minutes)}
          </span>
        </div>
      ))}
    </div>
  )
}
