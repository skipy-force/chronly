import { useEffect, useState } from 'react'

export function useElapsedSince(startIso: string | null): string {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!startIso) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [startIso])

  if (!startIso) return '00:00:00'
  const elapsedMs = Math.max(0, now - new Date(startIso).getTime())
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const s = String(totalSeconds % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}
