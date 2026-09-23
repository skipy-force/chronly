import { motion } from 'framer-motion'

interface Satellite {
  id: string
  label: string
  value: string
  angleDeg: number
}

interface RadialHubProps {
  centerLabel: string
  centerValue: string
  satellites: Satellite[]
  onCenterClick?: () => void
}

function rayPath(angleDeg: number): string {
  const rad = (angleDeg * Math.PI) / 180
  const startX = 100 + Math.cos(rad) * 90
  const startY = 100 + Math.sin(rad) * 90
  const endX = 100 + Math.cos(rad) * 170
  const endY = 100 + Math.sin(rad) * 170
  const midX = 100 + Math.cos(rad) * 130 + Math.sin(rad) * 12
  const midY = 100 + Math.sin(rad) * 130 - Math.cos(rad) * 12
  return `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`
}

export function RadialHub({ centerLabel, centerValue, satellites, onCenterClick }: RadialHubProps) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 200 200" className="pointer-events-none absolute h-[420px] w-[420px]">
        <circle cx="100" cy="100" r="70" className="fill-none stroke-outline/30" strokeWidth="1" />
        <circle cx="100" cy="100" r="95" className="fill-none stroke-outline/15" strokeWidth="1" />
        {satellites.map((s) => (
          <motion.path
            key={s.id}
            d={rayPath(s.angleDeg)}
            className="fill-none stroke-primary/40"
            strokeWidth="1.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        ))}
      </svg>

      <motion.button
        onClick={onCenterClick}
        whileHover={{ scale: 1.03 }}
        className="z-10 flex h-52 w-52 flex-col items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-surface shadow-2xl"
      >
        <span className="text-lg font-semibold">{centerLabel}</span>
        <span className="mt-1 text-3xl font-mono">{centerValue}</span>
      </motion.button>

      {satellites.map((s) => {
        const rad = (s.angleDeg * Math.PI) / 180
        const x = 210 + Math.cos(rad) * 170
        const y = 210 + Math.sin(rad) * 170
        return (
          <div
            key={s.id}
            className="absolute flex items-center gap-2 rounded-pill bg-surface-container px-4 py-2 text-sm shadow-lg"
            style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
          >
            <span className="text-on-surface-variant">{s.label}</span>
            <span className="font-medium">{s.value}</span>
          </div>
        )
      })}
    </div>
  )
}

export type { Satellite }
