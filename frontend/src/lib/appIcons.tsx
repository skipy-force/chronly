import { useQuery } from '@tanstack/react-query'
import {
  AppWindow,
  Code2,
  Folder,
  Gamepad2,
  Globe,
  Image,
  Mail,
  MessageCircle,
  Monitor,
  Music,
  FileText,
  Terminal,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { api } from './api'

interface AppIconMatch {
  keywords: string[]
  icon: LucideIcon
  accent: 'primary' | 'secondary' | 'tertiary'
}

const MATCHES: AppIconMatch[] = [
  { keywords: ['chrome', 'chromium', 'firefox', 'brave', 'zen', 'librewolf'], icon: Globe, accent: 'secondary' },
  {
    keywords: ['kitty', 'alacritty', 'foot', 'wezterm', 'konsole', 'terminal', 'tmux', 'xterm'],
    icon: Terminal,
    accent: 'tertiary',
  },
  {
    keywords: ['code', 'zed', 'vim', 'neovim', 'emacs', 'sublime', 'idea', 'pycharm', 'webstorm', 'clion', 'goland'],
    icon: Code2,
    accent: 'primary',
  },
  { keywords: ['slack', 'discord', 'telegram', 'signal', 'element'], icon: MessageCircle, accent: 'secondary' },
  { keywords: ['thunderbird', 'mail', 'outlook'], icon: Mail, accent: 'tertiary' },
  { keywords: ['spotify', 'rhythmbox', 'audacious'], icon: Music, accent: 'primary' },
  { keywords: ['vlc', 'mpv', 'obs', 'kdenlive'], icon: Video, accent: 'secondary' },
  { keywords: ['nautilus', 'dolphin', 'thunar', 'files', 'pcmanfm'], icon: Folder, accent: 'tertiary' },
  { keywords: ['obsidian', 'notion', 'libreoffice', 'writer', 'notes'], icon: FileText, accent: 'primary' },
  { keywords: ['gimp', 'inkscape', 'krita', 'blender'], icon: Image, accent: 'secondary' },
  { keywords: ['steam', 'lutris', 'heroic'], icon: Gamepad2, accent: 'tertiary' },
]

const ACCENT_CLASSES: Record<AppIconMatch['accent'], string> = {
  primary: 'bg-primary/15 text-primary',
  secondary: 'bg-secondary/15 text-secondary',
  tertiary: 'bg-tertiary/15 text-tertiary',
}

export function resolveAppIcon(appName: string): { Icon: LucideIcon; className: string } {
  if (!appName) return { Icon: Monitor, className: 'bg-surface-container-high text-on-surface-variant' }
  const lower = appName.toLowerCase()
  const match = MATCHES.find((m) => m.keywords.some((k) => lower.includes(k)))
  if (match) return { Icon: match.icon, className: ACCENT_CLASSES[match.accent] }
  return { Icon: AppWindow, className: 'bg-surface-container-high text-on-surface-variant' }
}

export function AppIconBadge({ appName, size = 32 }: { appName: string; size?: number }) {
  const { Icon, className } = resolveAppIcon(appName)
  const { data: iconDataUri } = useQuery({
    queryKey: ['appIcon', appName],
    queryFn: () => api.getAppIcon(appName),
    enabled: !!appName,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  if (iconDataUri) {
    return (
      <img
        src={iconDataUri}
        alt=""
        className="shrink-0 rounded-full object-contain"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.55)} />
    </div>
  )
}
