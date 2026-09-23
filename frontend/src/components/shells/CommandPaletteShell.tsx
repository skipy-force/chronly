import { ReactNode, useEffect, useState } from 'react'
import { SCREENS, useUiStore } from '../../store/uiStore'
import { useT } from '../../lib/i18n'

export function CommandPaletteShell({ children }: { children: ReactNode }) {
  const { setActiveScreen } = useUiStore()
  const t = useT()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="relative h-screen bg-surface text-on-surface">
      <main className="h-full overflow-auto">{children}</main>
      {open && (
        <div className="absolute inset-0 flex items-start justify-center bg-black/50 pt-24">
          <div className="w-96 rounded-lg bg-surface-container-high p-2 shadow-xl">
            {SCREENS.map((screen) => (
              <button
                key={screen.id}
                onClick={() => {
                  setActiveScreen(screen.id)
                  setOpen(false)
                }}
                className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-container"
              >
                {t(screen.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
