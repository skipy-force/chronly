import { useEffect } from 'react'
import { installMatugenTheme } from './lib/theme'

export default function App() {
  useEffect(() => installMatugenTheme(), [])

  return (
    <div className="flex h-screen items-center justify-center bg-surface text-on-surface">
      <p>chronly</p>
    </div>
  )
}
