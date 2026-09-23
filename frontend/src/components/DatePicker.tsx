import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, localDateKey, startOfMonth, startOfWeek, localeForLang } from '../lib/dates'
import { useWeekdayLabels } from '../lib/i18n'
import { useUiStore } from '../store/uiStore'

interface DatePickerProps {
  dateKey: string
  onChange: (dateKey: string) => void
}

function parseDateKey(dateKey: string): Date {
  return new Date(dateKey + 'T00:00:00')
}

export function DatePicker({ dateKey, onChange }: DatePickerProps) {
  const weekdayLabels = useWeekdayLabels(true)
  const locale = localeForLang(useUiStore((s) => s.language))
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseDateKey(dateKey)))
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setViewMonth(startOfMonth(parseDateKey(dateKey)))
  }, [open, dateKey])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const gridStart = startOfWeek(viewMonth)
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const selectedKey = dateKey

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-pill bg-surface-container px-3 py-1.5 text-sm hover:bg-surface-container-high"
      >
        {parseDateKey(dateKey).toLocaleDateString(locale, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-64 rounded-lg bg-surface-container-high p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              onClick={() => setViewMonth((m) => startOfMonth(addDays(m, -1)))}
              className="rounded-pill p-1 text-on-surface-variant hover:bg-surface-container"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-medium">
              {viewMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => setViewMonth((m) => startOfMonth(addDays(m, 32)))}
              className="rounded-pill p-1 text-on-surface-variant hover:bg-surface-container"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-on-surface-variant">
            {weekdayLabels.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((day) => {
              const key = localDateKey(day)
              const inMonth = day.getMonth() === viewMonth.getMonth()
              const selected = key === selectedKey
              return (
                <button
                  key={key}
                  onClick={() => {
                    onChange(key)
                    setOpen(false)
                  }}
                  className={`rounded-md py-1 text-xs ${
                    selected
                      ? 'bg-primary text-surface'
                      : inMonth
                        ? 'text-on-surface hover:bg-surface-container'
                        : 'text-on-surface-variant/40 hover:bg-surface-container'
                  }`}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
