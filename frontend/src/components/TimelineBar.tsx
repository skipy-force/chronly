import type { Block } from '../lib/api'
import { resolveAppIcon } from '../lib/appIcons'

interface TimelineBarProps {
  blocks: Block[]
  dayStartIso: string
  onSelect: (index: number) => void
}

const PX_PER_MIN = 2
const MIN_BLOCK_WIDTH = 6
const HEADER_HEIGHT = 24
const ROW_HEIGHT = 120
const BLOCK_HEIGHT = 104

function minutesFromDayStart(iso: string, dayStartMs: number): number {
  return (new Date(iso).getTime() - dayStartMs) / 60000
}

export function TimelineBar({ blocks, dayStartIso, onSelect }: TimelineBarProps) {
  const dayStartMs = new Date(dayStartIso).getTime()
  const hours = Array.from({ length: 25 }, (_, i) => i)

  return (
    <div className="w-full overflow-x-auto rounded-lg bg-surface-container">
      <div
        className="relative"
        style={{ width: 24 * 60 * PX_PER_MIN, height: HEADER_HEIGHT + ROW_HEIGHT }}
      >
        <div className="absolute inset-x-0 top-0 flex border-b border-outline/30" style={{ height: HEADER_HEIGHT }}>
          {hours.slice(0, 24).map((h) => (
            <div
              key={h}
              className="shrink-0 border-l border-outline/20 pl-1.5 text-xs text-on-surface-variant"
              style={{ width: 60 * PX_PER_MIN }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        <div className="absolute inset-x-0" style={{ top: HEADER_HEIGHT, height: ROW_HEIGHT }}>
          {blocks.map((block, i) => {
            const startMin = minutesFromDayStart(block.StartTime, dayStartMs)
            const endMin = minutesFromDayStart(block.EndTime, dayStartMs)
            const left = startMin * PX_PER_MIN
            const width = Math.max((endMin - startMin) * PX_PER_MIN, MIN_BLOCK_WIDTH)
            const unsorted = block.ProjectID == null
            const durationMin = Math.max(1, Math.round(endMin - startMin))
            const { Icon } = resolveAppIcon(block.AppName || '')

            return (
              <button
                key={i}
                onClick={() => onSelect(i)}
                title={`${block.AppName || 'Unknown'} · ${durationMin}m${unsorted ? ' · unsorted' : ''}`}
                className={`absolute top-2 flex flex-col overflow-hidden rounded-md border px-2 py-1.5 text-left ${
                  unsorted
                    ? 'border-error bg-error/15 hover:bg-error/25'
                    : 'border-outline bg-surface-container-high hover:bg-primary/20'
                }`}
                style={{ left, width, height: BLOCK_HEIGHT }}
              >
                {width > 30 && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <Icon size={14} className="shrink-0" />
                      <p className="truncate text-sm font-medium">{block.AppName || 'Unknown'}</p>
                    </div>
                    <p className="truncate text-xs text-on-surface-variant">{durationMin}m</p>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
