import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ScreenId = 'today' | 'timeline' | 'projects' | 'rules' | 'settings'
export type NavStyle = 'sidebar' | 'tabs' | 'palette'
export type TimelineView = 'time' | 'app'
export type Lang = 'en' | 'ru'

interface UiState {
  activeScreen: ScreenId
  setActiveScreen: (screen: ScreenId) => void
  navStyle: NavStyle
  setNavStyle: (style: NavStyle) => void
  timelineView: TimelineView
  setTimelineView: (view: TimelineView) => void
  displayName: string
  setDisplayName: (name: string) => void
  avatarDataUri: string
  setAvatarDataUri: (uri: string) => void
  uiScale: number
  setUiScale: (scale: number) => void
  language: Lang
  setLanguage: (lang: Lang) => void
  showDeveloperSettings: boolean
  setShowDeveloperSettings: (show: boolean) => void
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
      displayName: '',
      setDisplayName: (name) => set({ displayName: name }),
      avatarDataUri: '',
      setAvatarDataUri: (uri) => set({ avatarDataUri: uri }),
      uiScale: 100,
      setUiScale: (scale) => set({ uiScale: scale }),
      language: 'en',
      setLanguage: (lang) => set({ language: lang }),
      showDeveloperSettings: false,
      setShowDeveloperSettings: (show) => set({ showDeveloperSettings: show }),
    }),
    { name: 'chronly-ui' },
  ),
)

export const SCREENS: { id: ScreenId; labelKey: string }[] = [
  { id: 'today', labelKey: 'nav.today' },
  { id: 'timeline', labelKey: 'nav.timeline' },
  { id: 'projects', labelKey: 'nav.projects' },
  { id: 'rules', labelKey: 'nav.rules' },
  { id: 'settings', labelKey: 'nav.settings' },
]
