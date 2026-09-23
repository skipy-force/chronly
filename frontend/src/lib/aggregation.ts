import type { Block } from './api'
import { localDateKey, startOfWeek, addDays, startOfMonth, daysInMonth } from './dates'

export function blockMinutes(b: Block): number {
  return (new Date(b.EndTime).getTime() - new Date(b.StartTime).getTime()) / 60000
}

export function minutesByDayFromBlocks(blocks: Block[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const b of blocks) {
    const key = localDateKey(new Date(b.StartTime))
    map.set(key, (map.get(key) ?? 0) + blockMinutes(b))
  }
  return map
}

export interface MonthGridBounds {
  monthStart: Date
  gridStart: Date
  gridEnd: Date
}

export function monthGridBounds(selectedDate: Date): MonthGridBounds {
  const monthStart = startOfMonth(selectedDate)
  const monthEnd = addDays(monthStart, daysInMonth(selectedDate) - 1)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = addDays(startOfWeek(monthEnd), 6)
  return { monthStart, gridStart, gridEnd }
}

export interface HeatmapDay {
  key: string
  minutes: number
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
}

export function buildMonthGrid(
  bounds: MonthGridBounds,
  minutesByDay: Map<string, number>,
  actualTodayKey: string,
  selectedKey: string,
  locale = 'en-US',
): { monthLabel: string; weeks: HeatmapDay[][] } {
  const weeks: HeatmapDay[][] = []
  let cursor = bounds.gridStart
  while (cursor <= bounds.gridEnd) {
    const week: HeatmapDay[] = []
    for (let i = 0; i < 7; i++) {
      const key = localDateKey(cursor)
      week.push({
        key,
        minutes: minutesByDay.get(key) ?? 0,
        inMonth: cursor.getMonth() === bounds.monthStart.getMonth(),
        isToday: key === actualTodayKey,
        isSelected: key === selectedKey,
      })
      cursor = addDays(cursor, 1)
    }
    weeks.push(week)
  }

  return {
    monthLabel: bounds.monthStart.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
    weeks,
  }
}

export function buildWeekMinutes(
  selectedDate: Date,
  minutesByDay: Map<string, number>,
): { weekMinutes: number[]; weekStart: Date; selectedIndexInWeek: number } {
  const weekStart = startOfWeek(selectedDate)
  const weekMinutes = Array.from({ length: 7 }, (_, i) => minutesByDay.get(localDateKey(addDays(weekStart, i))) ?? 0)
  const selectedIndexInWeek = Math.floor((selectedDate.getTime() - weekStart.getTime()) / 86400000)
  return { weekMinutes, weekStart, selectedIndexInWeek }
}

export function weeklyAverageMinutes(weekMinutes: number[], weekStart: Date, actualNow: Date): number {
  const daysElapsed = Math.min(
    Math.max(1, Math.floor((actualNow.getTime() - weekStart.getTime()) / 86400000) + 1),
    7,
  )
  return weekMinutes.slice(0, daysElapsed).reduce((sum, m) => sum + m, 0) / daysElapsed
}

export function hourlyMinutesForDay(blocks: Block[], dayKey: string): number[] {
  const hours = new Array(24).fill(0)
  for (const b of blocks) {
    const start = new Date(b.StartTime)
    if (localDateKey(start) !== dayKey) continue
    hours[start.getHours()] += blockMinutes(b)
  }
  return hours
}

export interface PeakHourRange {
  startHour: number
  endHour: number
}

export function computePeakHourRange(blocks: Block[]): PeakHourRange | null {
  if (blocks.length === 0) return null
  const totals = new Array(24).fill(0)
  for (const b of blocks) {
    totals[new Date(b.StartTime).getHours()] += blockMinutes(b)
  }
  const max = Math.max(...totals)
  if (max <= 0) return null

  const peakHour = totals.indexOf(max)
  let start = peakHour
  let end = peakHour
  while (start > 0 && totals[start - 1] >= max * 0.5) start--
  while (end < 23 && totals[end + 1] >= max * 0.5) end++
  return { startHour: start, endHour: end }
}
