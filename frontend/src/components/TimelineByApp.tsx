import type { Block } from '../lib/api'
import { AppIconBadge } from '../lib/appIcons'
import { formatHoursMinutes, formatRelativeTime } from '../lib/dates'

interface TimelineByAppProps {
  blocks: Block[]
}

interface AppGroup {
  appName: string
  totalMinutes: number
  lastEnd: Date
}

export function TimelineByApp({ blocks }: TimelineByAppProps) {
  const now = new Date()
  const groups = new Map<string, AppGroup>()

  for (const block of blocks) {
    const appName = block.AppName || 'Unknown'
    const start = new Date(block.StartTime)
    const end = new Date(block.EndTime)
    const minutes = Math.max(0, (end.getTime() - start.getTime()) / 60000)
    const existing = groups.get(appName)
    if (existing) {
      existing.totalMinutes += minutes
      if (end > existing.lastEnd) existing.lastEnd = end
    } else {
      groups.set(appName, { appName, totalMinutes: minutes, lastEnd: end })
    }
  }

  const sorted = Array.from(groups.values()).sort((a, b) => b.lastEnd.getTime() - a.lastEnd.getTime())

  if (sorted.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg bg-surface-container text-sm text-on-surface-variant">
        No activity tracked on this day
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((group) => (
        <div key={group.appName} className="flex items-center gap-4 rounded-lg bg-surface-container p-4">
          <AppIconBadge appName={group.appName} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-medium">{group.appName}</p>
            <p className="text-sm text-on-surface-variant">last active {formatRelativeTime(group.lastEnd, now)}</p>
          </div>
          <span className="shrink-0 font-mono text-lg font-semibold">{formatHoursMinutes(group.totalMinutes)}</span>
        </div>
      ))}
    </div>
  )
}
