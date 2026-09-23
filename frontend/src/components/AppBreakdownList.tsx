import { memo } from 'react'
import { motion } from 'framer-motion'
import { formatHoursMinutes } from '../lib/dates'
import { AppIconBadge } from '../lib/appIcons'
import { prettyAppName } from '../lib/appNames'
import { useT } from '../lib/i18n'

interface AppBreakdownEntry {
  appName: string
  minutes: number
}

interface AppBreakdownListProps {
  entries: AppBreakdownEntry[]
  onSelectApp?: (appName: string) => void
}

export const AppBreakdownList = memo(function AppBreakdownList({ entries, onSelectApp }: AppBreakdownListProps) {
  const t = useT()
  const max = Math.max(1, ...entries.map((e) => e.minutes))

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-surface-container p-6 text-sm text-on-surface-variant">
        {t('appBreakdown.empty')}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry, i) => (
        <button
          key={entry.appName}
          onClick={() => onSelectApp?.(entry.appName)}
          className={`flex items-center gap-3 rounded-lg bg-surface-container p-3 text-left ${
            onSelectApp ? 'hover:bg-surface-container-high' : ''
          }`}
        >
          <AppIconBadge appName={entry.appName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{prettyAppName(entry.appName)}</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-pill bg-surface-container-high">
              <motion.div
                className="h-full rounded-pill bg-primary"
                initial={{ width: '0%' }}
                animate={{ width: `${(entry.minutes / max) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.05 }}
              />
            </div>
          </div>
          <span className="shrink-0 font-mono text-sm text-on-surface-variant">
            {formatHoursMinutes(entry.minutes)}
          </span>
        </button>
      ))}
    </div>
  )
})
