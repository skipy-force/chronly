import type { Block } from '../lib/api'

interface BlockChainProps {
  blocks: Block[]
  durationLabel: (block: Block) => string
  onSelect: (index: number) => void
}

const NODE_SPACING = 150
const TOP_Y = 64
const BOTTOM_Y = 176
const ROW_HEIGHT = 240

function nodeY(index: number): number {
  return index % 2 === 0 ? TOP_Y : BOTTOM_Y
}

function connectorPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2
  const controlY = (y1 + y2) / 2
  return `M ${x1} ${y1} Q ${midX} ${controlY} ${x2} ${y2}`
}

export function BlockChain({ blocks, durationLabel, onSelect }: BlockChainProps) {
  const width = Math.max(blocks.length * NODE_SPACING + NODE_SPACING, 600)

  return (
    <div className="overflow-x-auto">
      <div className="relative" style={{ width, height: ROW_HEIGHT }}>
        <svg width={width} height={ROW_HEIGHT} className="pointer-events-none absolute inset-0">
          {blocks.slice(1).map((_, i) => {
            const x1 = NODE_SPACING * (i + 1)
            const y1 = nodeY(i)
            const x2 = NODE_SPACING * (i + 2)
            const y2 = nodeY(i + 1)
            return (
              <path
                key={i}
                d={connectorPath(x1, y1, x2, y2)}
                className="fill-none stroke-outline/40"
                strokeWidth="1.5"
                strokeDasharray="4 5"
              />
            )
          })}
        </svg>

        {blocks.map((block, i) => {
          const unsorted = block.TaskID == null
          const x = NODE_SPACING * (i + 1)
          const y = nodeY(i)
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={`absolute flex h-20 w-28 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-center shadow-lg transition-colors ${
                unsorted
                  ? 'bg-error/10 hover:bg-error/20'
                  : 'bg-surface-container hover:bg-surface-container-high'
              }`}
              style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
            >
              <span className="truncate text-xs font-medium">{block.AppName || 'Unknown'}</span>
              <span className="font-mono text-sm text-on-surface-variant">{durationLabel(block)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
