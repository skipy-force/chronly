import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Block } from '../lib/api'
import { AppIconBadge } from '../lib/appIcons'
import { prettyAppName } from '../lib/appNames'
import { formatClockTime, formatHoursMinutes } from '../lib/dates'
import { useT } from '../lib/i18n'

interface TimelineListProps {
  blocks: Block[]
  onSelect: (index: number) => void
}

const ROW_HEIGHT = 80

export function TimelineList({ blocks, onSelect }: TimelineListProps) {
  const t = useT()
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  })

  if (blocks.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg bg-surface-container text-sm text-on-surface-variant">
        {t('timeline.empty')}
      </div>
    )
  }

  return (
    <div ref={parentRef} className="h-full overflow-y-auto">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const block = blocks[virtualRow.index]
          const start = new Date(block.StartTime)
          const end = new Date(block.EndTime)
          const minutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))
          const unsorted = block.ProjectID == null

          return (
            <button
              key={virtualRow.key}
              onClick={() => onSelect(virtualRow.index)}
              className={`absolute left-0 top-0 flex w-full items-center gap-4 rounded-lg border p-4 text-left ${
                unsorted
                  ? 'border-error bg-error/10 hover:bg-error/20'
                  : 'border-transparent bg-surface-container hover:bg-surface-container-high'
              }`}
              style={{ height: ROW_HEIGHT - 8, transform: `translateY(${virtualRow.start}px)` }}
            >
              <AppIconBadge appName={block.AppName || ''} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium">{prettyAppName(block.AppName)}</p>
                <p className="text-sm text-on-surface-variant">
                  {formatClockTime(start)} – {formatClockTime(end)}
                  {unsorted && ` · ${t('timeline.notAssigned')}`}
                </p>
              </div>
              <span className="shrink-0 font-mono text-lg font-semibold">{formatHoursMinutes(minutes)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
