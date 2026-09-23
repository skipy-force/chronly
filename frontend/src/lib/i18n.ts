import { useUiStore, type Lang } from '../store/uiStore'

const dict: Record<Lang, Record<string, string>> = {
  en: {
    'nav.today': 'Today',
    'nav.timeline': 'Timeline',
    'nav.projects': 'Projects',
    'nav.rules': 'Rules',
    'nav.settings': 'Settings',

    'settings.section.general': 'General',
    'settings.section.profile': 'Profile',
    'settings.section.appearance': 'Appearance',
    'settings.section.tracking': 'Tracking',
    'settings.section.developer': 'Developer',

    'settings.language': 'Language',
    'settings.showDeveloperSettings': 'Show developer settings',
    'settings.showDeveloperSettings.desc':
      'Expose the Developer section, with database path, app version, and diagnostics.',

    'settings.navStyle.title': 'Navigation style',
    'settings.navStyle.sidebar': 'Sidebar',
    'settings.navStyle.sidebar.desc': 'A vertical panel on the left with icons and labels, always visible.',
    'settings.navStyle.tabs': 'Tabs',
    'settings.navStyle.tabs.desc': 'A horizontal bar of tabs across the top, like browser tabs.',
    'settings.navStyle.palette': 'Command palette',
    'settings.navStyle.palette.desc': 'No visible nav bar — press Ctrl/Cmd+K anywhere to jump to a section.',

    'settings.profile.name': 'Name',
    'settings.profile.namePlaceholder': 'Your name',
    'settings.profile.hint': 'Shows in the sidebar and in the Today greeting.',
    'settings.profile.avatar': 'Avatar',
    'settings.profile.uploadAvatar': 'Upload avatar',
    'settings.profile.removeAvatar': 'Remove',

    'settings.appearance.uiScale': 'Interface size',

    'settings.tracking.afkThreshold': 'AFK threshold',
    'settings.tracking.afkThresholdDesc': 'minutes of inactivity before a block is split',
    'settings.tracking.idleDetection': 'Idle detection',
    'idle.wayland': 'Wayland (ext-idle-notify-v1)',
    'idle.evdev': 'Raw input devices (mouse + keyboard)',
    'idle.none': 'Unavailable — window tracking only, no AFK detection',

    'settings.developer.diagnostics': 'Diagnostics',
    'settings.developer.database': 'Database',
    'settings.developer.version': 'Version',
    'settings.developer.openFolder': 'Open data folder',

    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.loading': 'Loading...',
  },
  ru: {
    'nav.today': 'Сегодня',
    'nav.timeline': 'Таймлайн',
    'nav.projects': 'Проекты',
    'nav.rules': 'Правила',
    'nav.settings': 'Настройки',

    'settings.section.general': 'Общие',
    'settings.section.profile': 'Профиль',
    'settings.section.appearance': 'Внешний вид',
    'settings.section.tracking': 'Трекинг',
    'settings.section.developer': 'Разработчик',

    'settings.language': 'Язык',
    'settings.showDeveloperSettings': 'Показывать настройки разработчика',
    'settings.showDeveloperSettings.desc': 'Открыть раздел «Разработчик» — путь к базе, версия, диагностика.',

    'settings.navStyle.title': 'Стиль навигации',
    'settings.navStyle.sidebar': 'Боковая панель',
    'settings.navStyle.sidebar.desc': 'Вертикальная панель слева с иконками и подписями, всегда видна.',
    'settings.navStyle.tabs': 'Вкладки',
    'settings.navStyle.tabs.desc': 'Горизонтальная полоса вкладок сверху, как в браузере.',
    'settings.navStyle.palette': 'Командная палитра',
    'settings.navStyle.palette.desc': 'Без видимой панели — жми Ctrl/Cmd+K в любом месте, чтобы перейти в раздел.',

    'settings.profile.name': 'Имя',
    'settings.profile.namePlaceholder': 'Твоё имя',
    'settings.profile.hint': 'Отображается в сайдбаре и в приветствии на «Сегодня».',
    'settings.profile.avatar': 'Аватар',
    'settings.profile.uploadAvatar': 'Загрузить аватар',
    'settings.profile.removeAvatar': 'Убрать',

    'settings.appearance.uiScale': 'Масштаб интерфейса',

    'settings.tracking.afkThreshold': 'Порог AFK',
    'settings.tracking.afkThresholdDesc': 'минут бездействия до разделения блока',
    'settings.tracking.idleDetection': 'Определение простоя',
    'idle.wayland': 'Wayland (ext-idle-notify-v1)',
    'idle.evdev': 'Устройства ввода напрямую (мышь + клавиатура)',
    'idle.none': 'Недоступно — только трекинг окон, без определения AFK',

    'settings.developer.diagnostics': 'Диагностика',
    'settings.developer.database': 'База данных',
    'settings.developer.version': 'Версия',
    'settings.developer.openFolder': 'Открыть папку с данными',

    'common.save': 'Сохранить',
    'common.cancel': 'Отмена',
    'common.loading': 'Загрузка...',
  },
}

export function translate(lang: Lang, key: string): string {
  return dict[lang][key] ?? dict.en[key] ?? key
}

export function useT() {
  const language = useUiStore((s) => s.language)
  return (key: string) => translate(language, key)
}
