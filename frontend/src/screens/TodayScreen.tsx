import { memo, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { useElapsedSince } from '../lib/useTicker'
import { useUiStore } from '../store/uiStore'
import { WeekBarChart } from '../components/WeekBarChart'
import { MonthHeatmap } from '../components/MonthHeatmap'
import { AppBreakdownList } from '../components/AppBreakdownList'
import { AppDetailView } from '../components/AppDetailView'
import { DatePicker } from '../components/DatePicker'
import { prettyAppName } from '../lib/appNames'
import { fadeInVariants, staggerContainer } from '../lib/motion'
import { localDateKey, addDays, formatHoursMinutes, greeting } from '../lib/dates'
import {
  blockMinutes,
  minutesByDayFromBlocks,
  monthGridBounds,
  buildMonthGrid,
  buildWeekMinutes,
  weeklyAverageMinutes,
} from '../lib/aggregation'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function endOfDay(d: Date): Date {
  const end = new Date(d)
  end.setHours(23, 59, 59, 999)
  return end
}

export function TodayScreen() {
  const queryClient = useQueryClient()
  const { displayName } = useUiStore()
  const actualNow = useMemo(() => new Date(), [])
  const actualTodayKey = localDateKey(actualNow)

  const [selectedKey, setSelectedKey] = useState(actualTodayKey)
  const selectedDate = useMemo(() => new Date(selectedKey + 'T00:00:00'), [selectedKey])
  const isViewingToday = selectedKey === actualTodayKey

  const bounds = useMemo(() => monthGridBounds(selectedDate), [selectedDate])

  const rangeStartIso = bounds.gridStart.toISOString()
  const rangeEndIso = endOfDay(actualNow < bounds.gridEnd ? actualNow : bounds.gridEnd).toISOString()

  const { data: appState } = useQuery({
    queryKey: queryKeys.appState,
    queryFn: api.getAppState,
  })
  const { data: blocks = [] } = useQuery({
    queryKey: queryKeys.activityBlocks(rangeStartIso, rangeEndIso),
    queryFn: () => api.listActivityBlocksForRange(rangeStartIso, rangeEndIso),
  })

  const pauseMutation = useMutation({
    mutationFn: (paused: boolean) => api.setTrackingPaused(paused),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.appState }),
  })

  const minutesByDay = useMemo(() => minutesByDayFromBlocks(blocks), [blocks])

  const selectedDayBlocks = useMemo(
    () =>
      blocks
        .filter((b) => localDateKey(new Date(b.StartTime)) === selectedKey)
        .sort((a, b) => new Date(a.StartTime).getTime() - new Date(b.StartTime).getTime()),
    [blocks, selectedKey],
  )

  const selectedTotalMinutes = minutesByDay.get(selectedKey) ?? 0

  const idleSelectedMinutes = useMemo(() => {
    let idle = 0
    for (let i = 1; i < selectedDayBlocks.length; i++) {
      const gap =
        (new Date(selectedDayBlocks[i].StartTime).getTime() - new Date(selectedDayBlocks[i - 1].EndTime).getTime()) /
        60000
      if (gap > 0) idle += gap
    }
    return idle
  }, [selectedDayBlocks])

  const { weekMinutes, weekStart, selectedIndexInWeek } = useMemo(
    () => buildWeekMinutes(selectedDate, minutesByDay),
    [selectedDate, minutesByDay],
  )
  const weeklyAverage = useMemo(
    () => weeklyAverageMinutes(weekMinutes, weekStart, actualNow),
    [weekMinutes, weekStart, actualNow],
  )

  const { monthLabel, weeks: heatmapWeeks } = useMemo(
    () => buildMonthGrid(bounds, minutesByDay, actualTodayKey, selectedKey),
    [bounds, minutesByDay, actualTodayKey, selectedKey],
  )

  const appBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of selectedDayBlocks) {
      map.set(b.AppName, (map.get(b.AppName) ?? 0) + blockMinutes(b))
    }
    return Array.from(map.entries())
      .map(([appName, minutes]) => ({ appName, minutes }))
      .sort((a, b) => b.minutes - a.minutes)
  }, [selectedDayBlocks])

  const lastBlock = selectedDayBlocks[selectedDayBlocks.length - 1]
  const tracking = !appState?.TrackingPaused

  const [viewingApp, setViewingApp] = useState<string | null>(null)

  const sectionVariants = fadeInVariants(0.4, 14)

  if (viewingApp !== null) {
    return (
      <AppDetailView
        appName={viewingApp}
        blocks={blocks}
        initialDateKey={selectedKey}
        actualNow={actualNow}
        onBack={() => setViewingApp(null)}
      />
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          {isViewingToday && displayName && (
            <p className="text-xs text-on-surface-variant">
              {greeting(actualNow)}, {displayName}
            </p>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedKey((k) => localDateKey(addDays(new Date(k + 'T00:00:00'), -1)))}
              className="rounded-pill p-1 text-on-surface-variant hover:bg-surface-container"
            >
              <ChevronLeft size={16} />
            </button>
            <h1 className="text-lg font-semibold">{isViewingToday ? 'Today' : selectedKey}</h1>
            <button
              onClick={() => setSelectedKey((k) => localDateKey(addDays(new Date(k + 'T00:00:00'), 1)))}
              disabled={isViewingToday}
              className="rounded-pill p-1 text-on-surface-variant hover:bg-surface-container disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
            <DatePicker dateKey={selectedKey} onChange={setSelectedKey} />
          </div>
          {isViewingToday ? (
            <LiveStatus tracking={tracking} appName={lastBlock?.AppName} startIso={lastBlock?.StartTime} />
          ) : (
            <p className="text-xs text-on-surface-variant">Viewing history</p>
          )}
        </div>
        {isViewingToday && <PauseResumeButton tracking={tracking} onToggle={() => pauseMutation.mutate(tracking)} />}
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
            <StatCard label="Weekly average" value={formatHoursMinutes(weeklyAverage)} />
            <StatCard
              label={isViewingToday ? 'Today' : 'Selected day'}
              value={formatHoursMinutes(selectedTotalMinutes)}
            />
            <StatCard label="Idle" value={formatHoursMinutes(idleSelectedMinutes)} />
          </motion.div>

          <motion.div variants={sectionVariants} className="grid grid-cols-2 gap-4">
            <WeekBarChart minutesByDay={weekMinutes} labels={WEEKDAY_LABELS} activeIndex={selectedIndexInWeek} />
            <MonthHeatmap monthLabel={monthLabel} weeks={heatmapWeeks} onSelectDay={setSelectedKey} />
          </motion.div>

          <motion.div variants={sectionVariants}>
            <h2 className="mb-2 text-sm font-semibold text-on-surface-variant">Apps</h2>
            <AppBreakdownList entries={appBreakdown} onSelectApp={setViewingApp} />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-container p-4">
      <p className="text-xs text-on-surface-variant">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function PauseResumeButton({ tracking, onToggle }: { tracking: boolean; onToggle: () => void }) {
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.94 }}
      className={`relative flex items-center gap-2 overflow-hidden rounded-pill px-4 py-2 text-sm transition-colors duration-300 ${
        tracking
          ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
          : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
      }`}
    >
      {tracking && (
        <motion.span
          className="absolute inset-0 rounded-pill bg-emerald-500/25"
          animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.12, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={tracking ? 'pause' : 'resume'}
          initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
          transition={{ duration: 0.25 }}
          className="relative flex items-center gap-2"
        >
          {tracking ? <Pause size={16} /> : <Play size={16} />}
          {tracking ? 'Pause' : 'Resume'}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

const LiveStatus = memo(function LiveStatus({
  tracking,
  appName,
  startIso,
}: {
  tracking: boolean
  appName?: string
  startIso?: string
}) {
  const elapsed = useElapsedSince(tracking && startIso ? startIso : null)
  return (
    <p className="text-xs text-on-surface-variant">
      {tracking ? (appName ? prettyAppName(appName) : 'No activity yet') : 'Paused'}
      {tracking && elapsed ? ` · ${elapsed}` : ''}
    </p>
  )
})
