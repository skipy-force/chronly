import { useUiStore, type Lang } from '../store/uiStore'

const dict: Record<Lang, Record<string, string>> = {
  en: {
    'nav.today': 'Today',
    'nav.timeline': 'Timeline',
    'nav.projects': 'Projects',
    'nav.rules': 'Rules',
    'nav.settings': 'Settings',

    'settings.section.welcome': 'Welcome',
    'settings.section.general': 'General',
    'settings.section.profile': 'Profile',
    'settings.section.appearance': 'Appearance',
    'settings.section.tracking': 'Tracking',
    'settings.section.developer': 'Developer',

    'welcome.by': 'by',
    'welcome.viewOnGithub': 'View on GitHub',

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
    'common.create': 'Create',
    'common.loading': 'Loading...',

    'weekday.mon': 'Mon',
    'weekday.tue': 'Tue',
    'weekday.wed': 'Wed',
    'weekday.thu': 'Thu',
    'weekday.fri': 'Fri',
    'weekday.sat': 'Sat',
    'weekday.sun': 'Sun',
    'weekday.short.mon': 'Mo',
    'weekday.short.tue': 'Tu',
    'weekday.short.wed': 'We',
    'weekday.short.thu': 'Th',
    'weekday.short.fri': 'Fr',
    'weekday.short.sat': 'Sa',
    'weekday.short.sun': 'Su',

    'greeting.morning': 'Good morning',
    'greeting.afternoon': 'Good afternoon',
    'greeting.evening': 'Good evening',
    'greeting.night': 'Good night',

    'time.justNow': 'just now',
    'time.minutesAgo': '{n}m ago',
    'time.hoursAgo': '{n}h ago',
    'time.daysAgo': '{n}d ago',

    'today.viewingHistory': 'Viewing history',
    'today.weeklyAverage': 'Weekly average',
    'today.selectedDay': 'Selected day',
    'today.idle': 'Idle',
    'today.apps': 'Apps',
    'today.noActivityYet': 'No activity yet',
    'today.paused': 'Paused',
    'today.pause': 'Pause',
    'today.resume': 'Resume',

    'appDetail.vsYesterday': 'vs yesterday',
    'appDetail.dailyUsage': 'Daily usage',

    'appBreakdown.empty': 'No activity tracked yet today',

    'timeline.total': 'Total:',
    'timeline.byTime': 'By time',
    'timeline.byApp': 'By app',
    'timeline.descByTime':
      "Every card below is one tracked activity. Tap a card to assign it to a project — a red card isn't assigned yet.",
    'timeline.descByApp': 'Apps you used today, most recently active first.',
    'timeline.empty': 'No activity tracked on this day',
    'timeline.notAssigned': 'not assigned yet',
    'timeline.assignToProject': 'Assign to project',
    'timeline.lastActive': 'last active',

    'projects.title': 'Projects',
    'projects.new': 'New',
    'projects.tasks': 'Tasks',
    'projects.newProjectName': 'Project name',
    'projects.newTaskName': 'Task name',
    'projects.estimateOptional': 'Estimate, minutes (optional)',
    'editProject.title': 'Edit project',
    'editProject.color': 'Color',
    'editProject.archive': 'Archive',
    'editProject.unarchive': 'Unarchive',

    'rules.pattern': 'Pattern (app name substring)',
    'rules.project': 'Project',
    'rules.priority': 'Priority',
    'rules.addRule': 'Add rule',
    'editRule.title': 'Edit rule',
    'rulesGraph.edit': 'edit',
    'rulesGraph.delete': 'delete',
    'rulesGraph.resetView': 'Reset view',

    'select.placeholder': 'Select',
  },
  ru: {
    'nav.today': 'Сегодня',
    'nav.timeline': 'Таймлайн',
    'nav.projects': 'Проекты',
    'nav.rules': 'Правила',
    'nav.settings': 'Настройки',

    'settings.section.welcome': 'Добро пожаловать',
    'settings.section.general': 'Общие',
    'settings.section.profile': 'Профиль',
    'settings.section.appearance': 'Внешний вид',
    'settings.section.tracking': 'Трекинг',
    'settings.section.developer': 'Разработчик',

    'welcome.by': 'от',
    'welcome.viewOnGithub': 'Репозиторий на GitHub',

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
    'common.create': 'Создать',
    'common.loading': 'Загрузка...',

    'weekday.mon': 'Пн',
    'weekday.tue': 'Вт',
    'weekday.wed': 'Ср',
    'weekday.thu': 'Чт',
    'weekday.fri': 'Пт',
    'weekday.sat': 'Сб',
    'weekday.sun': 'Вс',
    'weekday.short.mon': 'Пн',
    'weekday.short.tue': 'Вт',
    'weekday.short.wed': 'Ср',
    'weekday.short.thu': 'Чт',
    'weekday.short.fri': 'Пт',
    'weekday.short.sat': 'Сб',
    'weekday.short.sun': 'Вс',

    'greeting.morning': 'Доброе утро',
    'greeting.afternoon': 'Добрый день',
    'greeting.evening': 'Добрый вечер',
    'greeting.night': 'Доброй ночи',

    'time.justNow': 'только что',
    'time.minutesAgo': '{n}м назад',
    'time.hoursAgo': '{n}ч назад',
    'time.daysAgo': '{n}д назад',

    'today.viewingHistory': 'Просмотр истории',
    'today.weeklyAverage': 'Среднее за неделю',
    'today.selectedDay': 'Выбранный день',
    'today.idle': 'Простой',
    'today.apps': 'Приложения',
    'today.noActivityYet': 'Пока нет активности',
    'today.paused': 'На паузе',
    'today.pause': 'Пауза',
    'today.resume': 'Продолжить',

    'appDetail.vsYesterday': 'по сравнению со вчера',
    'appDetail.dailyUsage': 'Использование по часам',

    'appBreakdown.empty': 'Активность за сегодня пока не отслежена',

    'timeline.total': 'Всего:',
    'timeline.byTime': 'По времени',
    'timeline.byApp': 'По приложениям',
    'timeline.descByTime':
      'Каждая карточка ниже — один отслеженный отрезок активности. Нажми, чтобы назначить проект — красная карточка ещё не назначена.',
    'timeline.descByApp': 'Приложения, которыми ты пользовался сегодня, сначала самые недавние.',
    'timeline.empty': 'За этот день активность не отслежена',
    'timeline.notAssigned': 'ещё не назначено',
    'timeline.assignToProject': 'Назначить проект',
    'timeline.lastActive': 'последняя активность',

    'projects.title': 'Проекты',
    'projects.new': 'Новый',
    'projects.tasks': 'Задачи',
    'projects.newProjectName': 'Название проекта',
    'projects.newTaskName': 'Название задачи',
    'projects.estimateOptional': 'Оценка, минут (необязательно)',
    'editProject.title': 'Редактировать проект',
    'editProject.color': 'Цвет',
    'editProject.archive': 'Архивировать',
    'editProject.unarchive': 'Разархивировать',

    'rules.pattern': 'Паттерн (подстрока имени приложения)',
    'rules.project': 'Проект',
    'rules.priority': 'Приоритет',
    'rules.addRule': 'Добавить правило',
    'editRule.title': 'Редактировать правило',
    'rulesGraph.edit': 'изменить',
    'rulesGraph.delete': 'удалить',
    'rulesGraph.resetView': 'Сбросить вид',

    'select.placeholder': 'Выбрать',
  },
}

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  let str = dict[lang][key] ?? dict.en[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, String(v))
    }
  }
  return str
}

export function useT() {
  const language = useUiStore((s) => s.language)
  return (key: string, params?: Record<string, string | number>) => translate(language, key, params)
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export function useWeekdayLabels(short = false): string[] {
  const t = useT()
  return WEEKDAY_KEYS.map((k) => t(short ? `weekday.short.${k}` : `weekday.${k}`))
}
