export function localDateKey(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = (day + 6) % 7
  const start = new Date(d)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - diff)
  return start
}

export function addDays(d: Date, delta: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + delta)
  return next
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

export function formatClockTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export interface TranslationRef {
  key: string
  params?: Record<string, string | number>
}

export function relativeTimeRef(d: Date, now: Date): TranslationRef {
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return { key: 'time.justNow' }
  if (diffMin < 60) return { key: 'time.minutesAgo', params: { n: diffMin } }
  const diffHours = Math.round(diffMin / 60)
  if (diffHours < 24) return { key: 'time.hoursAgo', params: { n: diffHours } }
  const diffDays = Math.round(diffHours / 24)
  return { key: 'time.daysAgo', params: { n: diffDays } }
}

export function greetingKey(now: Date): string {
  const hour = now.getHours()
  if (hour < 5) return 'greeting.night'
  if (hour < 12) return 'greeting.morning'
  if (hour < 18) return 'greeting.afternoon'
  if (hour < 22) return 'greeting.evening'
  return 'greeting.night'
}

export function localeForLang(lang: 'en' | 'ru'): string {
  return lang === 'ru' ? 'ru-RU' : 'en-US'
}

export function formatHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = Math.round(totalMinutes % 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}
