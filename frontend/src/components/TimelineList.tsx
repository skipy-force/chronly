import type { Block } from '../lib/api'
import { AppIconBadge } from '../lib/appIcons'
import { formatClockTime, formatHoursMinutes } from '../lib/dates'

interface TimelineListProps {
  blocks: Block[]
  onSelect: (index: number) => void
}

export function TimelineList({ blocks, onSelect }: TimelineListProps) {
  if (blocks.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg bg-surface-container text-sm text-on-surface-variant">
        No activity tracked on this day
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, i) => {
        const start = new Date(block.StartTime)
        const end = new Date(block.EndTime)
        const minutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))
        const unsorted = block.ProjectID == null

        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`flex items-center gap-4 rounded-lg border p-4 text-left ${
              unsorted
                ? 'border-error bg-error/10 hover:bg-error/20'
                : 'border-transparent bg-surface-container hover:bg-surface-container-high'
            }`}
          >
            <AppIconBadge appName={block.AppName || ''} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium">{block.AppName || 'Unknown'}</p>
              <p className="text-sm text-on-surface-variant">
                {formatClockTime(start)} – {formatClockTime(end)}
                {unsorted && ' · not assigned yet'}
              </p>
            </div>
            <span className="shrink-0 font-mono text-lg font-semibold">{formatHoursMinutes(minutes)}</span>
          </button>
        )
      })}
    </div>
  )
}
