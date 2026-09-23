import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string | null
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
}

export function Select({ value, onChange, options, placeholder = 'Select', className = '' }: SelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-pill bg-surface-container-high py-1.5 pl-3 pr-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
      >
        <span className={selected ? '' : 'text-on-surface-variant'}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className="shrink-0 text-on-surface-variant" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 min-w-full overflow-hidden rounded-lg bg-surface-container-high shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={`block w-full whitespace-nowrap px-3 py-2 text-left text-sm ${
                option.value === value ? 'bg-primary text-surface' : 'text-on-surface hover:bg-surface-container'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
