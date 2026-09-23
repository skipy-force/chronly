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

const SIZE = 480
const CENTER = SIZE / 2
const HUB_RADIUS = 104
const RAY_START = HUB_RADIUS + 6
const RAY_END = 200
const ORBIT_DURATION = 50

function rayPath(angleDeg: number): string {
  const rad = (angleDeg * Math.PI) / 180
  const startX = CENTER + Math.cos(rad) * RAY_START
  const startY = CENTER + Math.sin(rad) * RAY_START
  const endX = CENTER + Math.cos(rad) * RAY_END
  const endY = CENTER + Math.sin(rad) * RAY_END
  const midX = CENTER + Math.cos(rad) * ((RAY_START + RAY_END) / 2) + Math.sin(rad) * 14
  const midY = CENTER + Math.sin(rad) * ((RAY_START + RAY_END) / 2) - Math.cos(rad) * 14
  return `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`
}

export function RadialHub({ centerLabel, centerValue, satellites, onCenterClick }: RadialHubProps) {
  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="pointer-events-none absolute inset-0">
        <circle cx={CENTER} cy={CENTER} r={HUB_RADIUS + 40} className="fill-none stroke-outline/30" strokeWidth="1" />
        <circle cx={CENTER} cy={CENTER} r={HUB_RADIUS + 65} className="fill-none stroke-outline/15" strokeWidth="1" />
      </svg>

      <motion.button
        onClick={onCenterClick}
        whileHover={{ scale: 1.03 }}
        className="absolute z-10 flex flex-col items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-surface shadow-2xl"
        style={{
          left: CENTER,
          top: CENTER,
          width: HUB_RADIUS * 2,
          height: HUB_RADIUS * 2,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <span className="text-lg font-semibold">{centerLabel}</span>
        <span className="mt-1 text-3xl font-mono">{centerValue}</span>
      </motion.button>

      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: ORBIT_DURATION, ease: 'linear' }}
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="absolute inset-0">
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

        {satellites.map((s) => {
          const rad = (s.angleDeg * Math.PI) / 180
          const x = CENTER + Math.cos(rad) * RAY_END
          const y = CENTER + Math.sin(rad) * RAY_END
          return (
            <div
              key={s.id}
              className="pointer-events-auto absolute"
              style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
            >
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: ORBIT_DURATION, ease: 'linear' }}
                className="flex items-center gap-2 rounded-pill bg-surface-container px-4 py-2 text-sm shadow-lg"
              >
                <span className="text-on-surface-variant">{s.label}</span>
                <span className="font-medium">{s.value}</span>
              </motion.div>
            </div>
          )
        })}
      </motion.div>
    </div>
  )
}

export type { Satellite }
