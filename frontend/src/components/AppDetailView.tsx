import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import type { Block } from '../lib/api'
import { AppIconBadge } from '../lib/appIcons'
import { prettyAppName } from '../lib/appNames'
import { DatePicker } from './DatePicker'
import { WeekBarChart } from './WeekBarChart'
import { MonthHeatmap } from './MonthHeatmap'
import { HourlyUsageChart } from './HourlyUsageChart'
import { fadeInVariants, staggerContainer } from '../lib/motion'
import { useT, useWeekdayLabels } from '../lib/i18n'
import { useUiStore } from '../store/uiStore'
import { localDateKey, addDays, formatHoursMinutes, localeForLang } from '../lib/dates'
import {
  minutesByDayFromBlocks,
  monthGridBounds,
  buildMonthGrid,
  buildWeekMinutes,
  weeklyAverageMinutes,
  hourlyMinutesForDay,
} from '../lib/aggregation'

interface AppDetailViewProps {
  appName: string
  blocks: Block[]
  initialDateKey: string
  actualNow: Date
  onBack: () => void
}

export function AppDetailView({ appName, blocks, initialDateKey, actualNow, onBack }: AppDetailViewProps) {
  const t = useT()
  const weekdayLabels = useWeekdayLabels()
  const language = useUiStore((s) => s.language)
  const [selectedKey, setSelectedKey] = useState(initialDateKey)
  const actualTodayKey = localDateKey(actualNow)
  const isViewingToday = selectedKey === actualTodayKey

  const appBlocks = useMemo(() => blocks.filter((b) => b.AppName === appName), [blocks, appName])
  const minutesByDay = useMemo(() => minutesByDayFromBlocks(appBlocks), [appBlocks])
  const selectedDate = useMemo(() => new Date(selectedKey + 'T00:00:00'), [selectedKey])

  const selectedTotal = minutesByDay.get(selectedKey) ?? 0
  const previousDayKey = localDateKey(addDays(selectedDate, -1))
  const previousTotal = minutesByDay.get(previousDayKey) ?? 0
  const delta = selectedTotal - previousTotal

  const bounds = useMemo(() => monthGridBounds(selectedDate), [selectedDate])
  const { monthLabel, weeks: heatmapWeeks } = useMemo(
    () => buildMonthGrid(bounds, minutesByDay, actualTodayKey, selectedKey, localeForLang(language)),
    [bounds, minutesByDay, actualTodayKey, selectedKey, language],
  )
  const { weekMinutes, weekStart, selectedIndexInWeek } = useMemo(
    () => buildWeekMinutes(selectedDate, minutesByDay),
    [selectedDate, minutesByDay],
  )
  const weeklyAverage = useMemo(
    () => weeklyAverageMinutes(weekMinutes, weekStart, actualNow),
    [weekMinutes, weekStart, actualNow],
  )
  const hourly = useMemo(() => hourlyMinutesForDay(appBlocks, selectedKey), [appBlocks, selectedKey])

  const sectionVariants = fadeInVariants(0.4, 14)

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="rounded-pill p-1.5 text-on-surface-variant hover:bg-surface-container">
            <ArrowLeft size={16} />
          </button>
          <AppIconBadge appName={appName} size={24} />
          <h1 className="text-lg font-semibold">
            {prettyAppName(appName)} — {isViewingToday ? t('nav.today') : selectedKey}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSelectedKey((k) => localDateKey(addDays(new Date(k + 'T00:00:00'), -1)))}
            className="rounded-pill p-1 text-on-surface-variant hover:bg-surface-container"
          >
            <ChevronLeft size={16} />
          </button>
          <DatePicker dateKey={selectedKey} onChange={setSelectedKey} />
          <button
            onClick={() => setSelectedKey((k) => localDateKey(addDays(new Date(k + 'T00:00:00'), 1)))}
            disabled={isViewingToday}
            className="rounded-pill p-1 text-on-surface-variant hover:bg-surface-container disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedKey}
          className="flex flex-col gap-4"
          initial="hidden"
          animate="show"
          exit={{ opacity: 0, y: -10, transition: { duration: 0.2, ease: 'easeIn' } }}
          variants={staggerContainer(0.06)}
        >
          <motion.div variants={sectionVariants} className="grid grid-cols-3 gap-4">
            <StatCard label={t('today.weeklyAverage')} value={formatHoursMinutes(weeklyAverage)} />
            <StatCard
              label={isViewingToday ? t('nav.today') : t('today.selectedDay')}
              value={formatHoursMinutes(selectedTotal)}
              big
            />
            <TrendCard delta={delta} />
          </motion.div>

          <motion.div variants={sectionVariants} className="grid grid-cols-2 gap-4">
            <WeekBarChart minutesByDay={weekMinutes} labels={weekdayLabels} activeIndex={selectedIndexInWeek} />
            <MonthHeatmap monthLabel={monthLabel} weeks={heatmapWeeks} onSelectDay={setSelectedKey} />
          </motion.div>

          <motion.div variants={sectionVariants}>
            <h2 className="mb-2 text-sm font-semibold text-on-surface-variant">{t('appDetail.dailyUsage')}</h2>
            <HourlyUsageChart minutesByHour={hourly} />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function StatCard({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="rounded-lg bg-surface-container p-4">
      <p className="text-xs text-on-surface-variant">{label}</p>
      <p className={`mt-1 font-semibold ${big ? 'text-2xl' : 'text-xl'}`}>{value}</p>
    </div>
  )
}

function TrendCard({ delta }: { delta: number }) {
  const t = useT()
  const up = delta >= 0
  return (
    <div className="rounded-lg bg-surface-container p-4">
      <p className="text-xs text-on-surface-variant">{t('appDetail.vsYesterday')}</p>
      <div className="mt-1 flex items-center gap-1.5">
        {up ? <TrendingUp size={16} className="text-primary" /> : <TrendingDown size={16} className="text-error" />}
        <p className="text-xl font-semibold">{formatHoursMinutes(Math.abs(delta))}</p>
      </div>
    </div>
  )
}
