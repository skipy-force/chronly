import type { Block } from '../lib/api'

interface TimelineBarProps {
  blocks: Block[]
  dayStartIso: string
  onSelect: (index: number) => void
}

const PX_PER_MIN = 3
const MIN_BLOCK_WIDTH = 4
const ROW_HEIGHT = 64

function minutesFromDayStart(iso: string, dayStartMs: number): number {
  return (new Date(iso).getTime() - dayStartMs) / 60000
}

export function TimelineBar({ blocks, dayStartIso, onSelect }: TimelineBarProps) {
  const dayStartMs = new Date(dayStartIso).getTime()
  const hours = Array.from({ length: 25 }, (_, i) => i)

  return (
    <div className="h-full w-full overflow-x-auto overflow-y-hidden rounded-lg bg-surface-container">
      <div className="relative" style={{ width: 24 * 60 * PX_PER_MIN, height: '100%' }}>
        <div className="absolute inset-x-0 top-0 flex h-6 border-b border-outline/30">
          {hours.slice(0, 24).map((h) => (
            <div
              key={h}
              className="shrink-0 border-l border-outline/20 pl-1 text-[10px] text-on-surface-variant"
              style={{ width: 60 * PX_PER_MIN }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        <div className="absolute inset-x-0 bottom-0 top-6" style={{ height: ROW_HEIGHT }}>
          {blocks.map((block, i) => {
            const startMin = minutesFromDayStart(block.StartTime, dayStartMs)
            const endMin = minutesFromDayStart(block.EndTime, dayStartMs)
            const left = startMin * PX_PER_MIN
            const width = Math.max((endMin - startMin) * PX_PER_MIN, MIN_BLOCK_WIDTH)
            const unsorted = block.ProjectID == null
            const durationMin = Math.max(1, Math.round(endMin - startMin))

            return (
              <button
                key={i}
                onClick={() => onSelect(i)}
                title={`${block.AppName || 'Unknown'} · ${durationMin}m${unsorted ? ' · unsorted' : ''}`}
                className={`absolute top-1 h-14 overflow-hidden rounded-md border px-1.5 text-left ${
                  unsorted
                    ? 'border-error bg-error/15 hover:bg-error/25'
                    : 'border-outline bg-surface-container-high hover:bg-primary/20'
                }`}
                style={{ left, width }}
              >
                {width > 40 && (
                  <>
                    <p className="truncate text-[11px] font-medium">{block.AppName || 'Unknown'}</p>
                    <p className="truncate text-[10px] text-on-surface-variant">{durationMin}m</p>
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
