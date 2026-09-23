import { memo } from 'react'
import { motion } from 'framer-motion'

interface HourlyUsageChartProps {
  minutesByHour: number[]
}

const LABEL_HOURS = [0, 6, 12, 18, 23]
const CHART_HEIGHT = 340

export const HourlyUsageChart = memo(function HourlyUsageChart({ minutesByHour }: HourlyUsageChartProps) {
  const max = Math.max(1, ...minutesByHour)

  return (
    <div className="rounded-lg bg-surface-container p-4">
      <div className="flex items-end gap-1" style={{ height: CHART_HEIGHT }}>
        {minutesByHour.map((minutes, hour) => (
          <div key={hour} className="flex-1" title={`${String(hour).padStart(2, '0')}:00 — ${Math.round(minutes)}m`}>
            <motion.div
              className={`w-full rounded-sm ${minutes > 0 ? 'bg-primary' : 'bg-surface-container-high'}`}
              initial={{ height: 2 }}
              animate={{ height: Math.max(2, (minutes / max) * CHART_HEIGHT) }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: hour * 0.015 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex text-[10px] text-on-surface-variant">
        {Array.from({ length: 24 }, (_, hour) => (
          <span key={hour} className="flex-1 text-center">
            {LABEL_HOURS.includes(hour) ? `${String(hour).padStart(2, '0')}:00` : ''}
          </span>
        ))}
      </div>
    </div>
  )
})
