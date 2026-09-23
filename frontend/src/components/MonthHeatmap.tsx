import { memo } from 'react'
import { motion } from 'framer-motion'

interface MonthHeatmapProps {
  monthLabel: string
  weeks: { key: string; minutes: number; inMonth: boolean; isToday: boolean; isSelected?: boolean }[][]
  onSelectDay?: (key: string) => void
}

function intensityClass(minutes: number, max: number): string {
  if (minutes <= 0) return 'bg-surface-container-high'
  const ratio = minutes / max
  if (ratio > 0.75) return 'bg-primary'
  if (ratio > 0.5) return 'bg-primary/70'
  if (ratio > 0.25) return 'bg-primary/40'
  return 'bg-primary/20'
}

export const MonthHeatmap = memo(function MonthHeatmap({ monthLabel, weeks, onSelectDay }: MonthHeatmapProps) {
  const max = Math.max(1, ...weeks.flat().map((d) => d.minutes))

  return (
    <div className="h-full rounded-lg bg-surface-container p-4">
      <p className="mb-3 text-sm text-on-surface-variant">{monthLabel}</p>
      <div className="flex flex-col gap-1.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex gap-1.5">
            {week.map((day, di) => (
              <motion.button
                key={day.key}
                type="button"
                title={day.key}
                disabled={!day.inMonth || !onSelectDay}
                onClick={() => onSelectDay?.(day.key)}
                initial={{ scale: 0.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut', delay: (wi * 7 + di) * 0.008 }}
                className={`h-5 flex-1 rounded ${day.inMonth ? intensityClass(day.minutes, max) : 'bg-transparent'} ${
                  day.isToday ? 'ring-1 ring-primary' : ''
                } ${day.isSelected ? 'outline outline-2 outline-on-surface' : ''} ${
                  day.inMonth && onSelectDay ? 'cursor-pointer hover:brightness-125' : ''
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
})
