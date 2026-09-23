const OVERRIDES: Record<string, string> = {
  'dev.zed.zed': 'Zed',
  zed: 'Zed',
  code: 'VS Code',
  'code-oss': 'VS Code Insiders',
  codium: 'VSCodium',
  kitty: 'Kitty',
  alacritty: 'Alacritty',
  'org.wezfurlong.wezterm': 'WezTerm',
  'com.mitchellh.ghostty': 'Ghostty',
  'org.kde.konsole': 'Konsole',
  'org.gnome.console': 'Console',
  foot: 'Foot',
  firefox: 'Firefox',
  'firefoxdeveloperedition': 'Firefox Developer Edition',
  'org.mozilla.firefox': 'Firefox',
  librewolf: 'LibreWolf',
  chromium: 'Chromium',
  'google-chrome': 'Chrome',
  'brave-browser': 'Brave',
  'org.gnome.nautilus': 'Files',
  'org.kde.dolphin': 'Dolphin',
  thunar: 'Thunar',
  pcmanfm: 'PCManFM',
  'com.spotify.client': 'Spotify',
  spotify: 'Spotify',
  discord: 'Discord',
  'com.discordapp.discord': 'Discord',
  'org.telegram.desktop': 'Telegram',
  'telegram-desktop': 'Telegram',
  slack: 'Slack',
  'com.slack.slack': 'Slack',
  'org.kde.kate': 'Kate',
  'org.gnome.texteditor': 'Text Editor',
  steam: 'Steam',
  obsidian: 'Obsidian',
  'md.obsidian.obsidian': 'Obsidian',
  'org.gimp.gimp': 'GIMP',
  'org.inkscape.inkscape': 'Inkscape',
  vlc: 'VLC',
  'org.videolan.vlc': 'VLC',
  mpv: 'mpv',
  'com.obsproject.studio': 'OBS Studio',
  'com.gabm.satty': 'Satty',
  thunderbird: 'Thunderbird',
  'org.mozilla.thunderbird': 'Thunderbird',
  'hyprland-share-picker': 'Screen Share Picker',
}

function titleCaseFromSegment(raw: string): string {
  const segment = raw.includes('.') ? raw.split('.').pop() || raw : raw
  const cleaned = segment.replace(/[-_]+/g, ' ').trim()
  if (!cleaned) return raw
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase())
}

export function prettyAppName(raw: string): string {
  if (!raw) return ''
  const lower = raw.toLowerCase()
  if (OVERRIDES[lower]) return OVERRIDES[lower]
  return titleCaseFromSegment(raw)
}
