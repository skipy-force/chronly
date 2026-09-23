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
const ORBIT_DURATION = 140
const WAVE_AMPLITUDE = 10

function pointAt(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return { x: CENTER + Math.cos(rad) * radius, y: CENTER + Math.sin(rad) * radius }
}

// A gentle S-wave from hub to satellite: one cubic bezier whose two control
// points sit at 1/3 and 2/3 along the ray, nudged to opposite sides
// perpendicular to it, instead of a straight chord.
function wavePath(angleDeg: number): string {
  const rad = (angleDeg * Math.PI) / 180
  const dirX = Math.cos(rad)
  const dirY = Math.sin(rad)
  const perpX = -dirY
  const perpY = dirX

  const start = pointAt(angleDeg, RAY_START)
  const end = pointAt(angleDeg, RAY_END)
  const oneThird = RAY_START + (RAY_END - RAY_START) / 3
  const twoThirds = RAY_START + ((RAY_END - RAY_START) * 2) / 3

  const c1x = CENTER + dirX * oneThird + perpX * WAVE_AMPLITUDE
  const c1y = CENTER + dirY * oneThird + perpY * WAVE_AMPLITUDE
  const c2x = CENTER + dirX * twoThirds - perpX * WAVE_AMPLITUDE
  const c2y = CENTER + dirY * twoThirds - perpY * WAVE_AMPLITUDE

  return `M ${start.x} ${start.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`
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
          left: CENTER - HUB_RADIUS,
          top: CENTER - HUB_RADIUS,
          width: HUB_RADIUS * 2,
          height: HUB_RADIUS * 2,
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
            <path key={s.id} d={wavePath(s.angleDeg)} className="fill-none stroke-primary/50" strokeWidth="1" />
          ))}
        </svg>

        {satellites.map((s) => {
          const { x, y } = pointAt(s.angleDeg, RAY_END)
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
