import { FolderKanban, Network, Settings as SettingsIcon, Sun, Waypoints, type LucideIcon } from 'lucide-react'
import type { ScreenId } from '../store/uiStore'

export const SCREEN_ICONS: Record<ScreenId, LucideIcon> = {
  today: Sun,
  timeline: Waypoints,
  projects: FolderKanban,
  rules: Network,
  settings: SettingsIcon,
}
