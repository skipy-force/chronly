import { memo, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { api, type Block } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { useElapsedSince } from '../lib/useTicker'
import { WeekBarChart } from '../components/WeekBarChart'
import { MonthHeatmap } from '../components/MonthHeatmap'
import { AppBreakdownList } from '../components/AppBreakdownList'
import { DatePicker } from '../components/DatePicker'
import { prettyAppName } from '../lib/appNames'
import { localDateKey, startOfWeek, addDays, startOfMonth, daysInMonth, formatHoursMinutes } from '../lib/dates'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function endOfDay(d: Date): Date {
  const end = new Date(d)
  end.setHours(23, 59, 59, 999)
  return end
}

function blockMinutes(b: Block): number {
  return (new Date(b.EndTime).getTime() - new Date(b.StartTime).getTime()) / 60000
}

export function TodayScreen() {
  const queryClient = useQueryClient()
  const actualNow = useMemo(() => new Date(), [])
  const actualTodayKey = localDateKey(actualNow)

  const [selectedKey, setSelectedKey] = useState(actualTodayKey)
  const selectedDate = useMemo(() => new Date(selectedKey + 'T00:00:00'), [selectedKey])
  const isViewingToday = selectedKey === actualTodayKey

  const monthStart = startOfMonth(selectedDate)
  const monthEnd = addDays(monthStart, daysInMonth(selectedDate) - 1)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = addDays(startOfWeek(monthEnd), 6)

  const rangeStartIso = gridStart.toISOString()
  const rangeEndIso = endOfDay(actualNow < gridEnd ? actualNow : gridEnd).toISOString()

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

  const minutesByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of blocks) {
      const key = localDateKey(new Date(b.StartTime))
      map.set(key, (map.get(key) ?? 0) + blockMinutes(b))
    }
    return map
  }, [blocks])

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

  const weekStart = startOfWeek(selectedDate)
  const weekMinutes = Array.from({ length: 7 }, (_, i) => minutesByDay.get(localDateKey(addDays(weekStart, i))) ?? 0)
  const selectedIndexInWeek = Math.floor((selectedDate.getTime() - weekStart.getTime()) / 86400000)
  const daysElapsedThisWeek = Math.min(
    Math.max(1, Math.floor((actualNow.getTime() - weekStart.getTime()) / 86400000) + 1),
    7,
  )
  const weeklyAverageMinutes =
    weekMinutes.slice(0, daysElapsedThisWeek).reduce((sum, m) => sum + m, 0) / daysElapsedThisWeek

  const heatmapWeeks = useMemo(() => {
    const weeks: { key: string; minutes: number; inMonth: boolean; isToday: boolean; isSelected: boolean }[][] = []
    let cursor = gridStart
    while (cursor <= gridEnd) {
      const week: { key: string; minutes: number; inMonth: boolean; isToday: boolean; isSelected: boolean }[] = []
      for (let i = 0; i < 7; i++) {
        const key = localDateKey(cursor)
        week.push({
          key,
          minutes: minutesByDay.get(key) ?? 0,
          inMonth: cursor.getMonth() === monthStart.getMonth(),
          isToday: key === actualTodayKey,
          isSelected: key === selectedKey,
        })
        cursor = addDays(cursor, 1)
      }
      weeks.push(week)
    }
    return weeks
  }, [gridStart, gridEnd, minutesByDay, monthStart, actualTodayKey, selectedKey])

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

  const sectionVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  }

  return (
    <motion.div
      className="flex h-full flex-col gap-4 overflow-y-auto p-6"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.08 } } }}
    >
      <motion.div variants={sectionVariants} className="flex items-center justify-between">
        <div>
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
        {isViewingToday && (
          <button
            onClick={() => pauseMutation.mutate(!appState?.TrackingPaused)}
            className="flex items-center gap-2 rounded-pill bg-surface-container px-4 py-2 text-sm hover:bg-surface-container-high"
          >
            {tracking ? <Pause size={16} /> : <Play size={16} />}
            {tracking ? 'Pause' : 'Resume'}
          </button>
        )}
      </motion.div>

      <motion.div variants={sectionVariants} className="grid grid-cols-3 gap-4">
        <StatCard label="Weekly average" value={formatHoursMinutes(weeklyAverageMinutes)} />
        <StatCard label={isViewingToday ? 'Today' : 'Selected day'} value={formatHoursMinutes(selectedTotalMinutes)} />
        <StatCard label="Idle" value={formatHoursMinutes(idleSelectedMinutes)} />
      </motion.div>

      <motion.div variants={sectionVariants} className="grid grid-cols-2 gap-4">
        <WeekBarChart minutesByDay={weekMinutes} labels={WEEKDAY_LABELS} activeIndex={selectedIndexInWeek} />
        <MonthHeatmap
          monthLabel={selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          weeks={heatmapWeeks}
          onSelectDay={setSelectedKey}
        />
      </motion.div>

      <motion.div variants={sectionVariants}>
        <h2 className="mb-2 text-sm font-semibold text-on-surface-variant">Apps</h2>
        <AppBreakdownList entries={appBreakdown} />
      </motion.div>
    </motion.div>
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
