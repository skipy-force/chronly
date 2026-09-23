import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ScreenId = 'today' | 'timeline' | 'projects' | 'rules' | 'settings'
export type NavStyle = 'sidebar' | 'tabs' | 'palette'
export type TimelineView = 'time' | 'app'

interface UiState {
  activeScreen: ScreenId
  setActiveScreen: (screen: ScreenId) => void
  navStyle: NavStyle
  setNavStyle: (style: NavStyle) => void
  timelineView: TimelineView
  setTimelineView: (view: TimelineView) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      activeScreen: 'today',
      setActiveScreen: (screen) => set({ activeScreen: screen }),
      navStyle: 'sidebar',
      setNavStyle: (style) => set({ navStyle: style }),
      timelineView: 'time',
      setTimelineView: (view) => set({ timelineView: view }),
    }),
    { name: 'chronly-ui' },
  ),
)

export const SCREENS: { id: ScreenId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'projects', label: 'Projects' },
  { id: 'rules', label: 'Rules' },
  { id: 'settings', label: 'Settings' },
]
