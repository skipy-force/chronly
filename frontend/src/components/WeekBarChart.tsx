import { memo } from 'react'
import { motion } from 'framer-motion'

interface WeekBarChartProps {
  minutesByDay: number[]
  labels: string[]
  activeIndex: number
}

export const WeekBarChart = memo(function WeekBarChart({ minutesByDay, labels, activeIndex }: WeekBarChartProps) {
  const max = Math.max(1, ...minutesByDay)

  return (
    <div className="flex h-full items-end gap-3 rounded-lg bg-surface-container p-4">
      {minutesByDay.map((minutes, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-24 w-full items-end overflow-hidden rounded-md bg-surface-container-high">
            <motion.div
              className={`w-full rounded-md ${i === activeIndex ? 'bg-primary' : 'bg-outline/60'}`}
              initial={{ height: '0%' }}
              animate={{ height: `${Math.max(4, (minutes / max) * 100)}%` }}
              transition={{ type: 'spring', bounce: 0.3, duration: 0.6, delay: i * 0.04 }}
            />
          </div>
          <span className={`text-xs ${i === activeIndex ? 'text-on-surface' : 'text-on-surface-variant'}`}>
            {labels[i]}
          </span>
        </div>
      ))}
    </div>
  )
})
