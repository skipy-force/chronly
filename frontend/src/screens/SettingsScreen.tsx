import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Droplet, ExternalLink, FolderOpen, RefreshCw, Upload, X } from 'lucide-react'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { useUiStore, type NavStyle, type Lang, type ThemePresetId } from '../store/uiStore'
import { useT } from '../lib/i18n'
import { fadeInVariants, staggerContainer } from '../lib/motion'
import { THEME_PRESETS } from '../lib/themePresets'
import { Avatar } from '../components/Avatar'
import chronlyLogo from '../assets/images/icon.svg'

type Section = 'welcome' | 'general' | 'profile' | 'appearance' | 'tracking' | 'developer'

const REPO_URL = 'https://github.com/skipy-force/chronly'

const UI_SCALE_PRESETS = [90, 100, 110, 125, 150]
const DEV_UNLOCK_HOLD_MS = 1400

const sectionVariants = fadeInVariants(0.35, 10)

const NAV_STYLE_INFO: Record<NavStyle, { labelKey: string; descKey: string }> = {
  sidebar: { labelKey: 'settings.navStyle.sidebar', descKey: 'settings.navStyle.sidebar.desc' },
  tabs: { labelKey: 'settings.navStyle.tabs', descKey: 'settings.navStyle.tabs.desc' },
  palette: { labelKey: 'settings.navStyle.palette', descKey: 'settings.navStyle.palette.desc' },
}

export function SettingsScreen() {
  const { showDeveloperSettings } = useUiStore()
  const t = useT()

  const [activeSection, setActiveSection] = useState<Section>('welcome')

  const sections: { id: Section; labelKey: string }[] = [
    { id: 'welcome', labelKey: 'settings.section.welcome' },
    { id: 'general', labelKey: 'settings.section.general' },
    { id: 'profile', labelKey: 'settings.section.profile' },
    { id: 'appearance', labelKey: 'settings.section.appearance' },
    { id: 'tracking', labelKey: 'settings.section.tracking' },
    ...(showDeveloperSettings ? [{ id: 'developer' as Section, labelKey: 'settings.section.developer' }] : []),
  ]

  useEffect(() => {
    if (activeSection === 'developer' && !showDeveloperSettings) setActiveSection('general')
  }, [showDeveloperSettings, activeSection])

  return (
    <div className="flex h-full gap-4 p-6">
      <div className="flex w-44 flex-col gap-1">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`relative rounded-pill px-3 py-2 text-left text-sm ${
              activeSection === s.id ? 'text-surface' : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {activeSection === s.id && (
              <motion.div
                layoutId="settings-section-pill"
                className="absolute inset-0 rounded-pill bg-primary"
                transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
              />
            )}
            <span className="relative">{t(s.labelKey)}</span>
          </button>
        ))}
      </div>

      <motion.div
        key={activeSection}
        className="flex-1 overflow-auto"
        initial="hidden"
        animate="show"
        variants={staggerContainer(0.06)}
      >
        {activeSection === 'welcome' && <WelcomeSection />}
        {activeSection === 'general' && <GeneralSection />}
        {activeSection === 'profile' && <ProfileSection />}
        {activeSection === 'appearance' && <AppearanceSection />}
        {activeSection === 'tracking' && <TrackingSection />}
        {activeSection === 'developer' && showDeveloperSettings && <DeveloperSection />}
      </motion.div>
    </div>
  )
}

function WelcomeSection() {
  const t = useT()
  const { data: appVersion } = useQuery({
    queryKey: ['appVersion'],
    queryFn: api.getAppVersion,
  })

  return (
    <motion.section
      variants={sectionVariants}
      className="flex h-full flex-col items-center justify-center gap-4 text-center"
    >
      <img src={chronlyLogo} alt="chronly" className="h-32 w-32" />
      <div>
        <p className="text-2xl font-semibold">
          chronly <span className="text-base font-normal text-on-surface-variant">v{appVersion ?? '…'}</span>
        </p>
        <p className="text-sm text-on-surface-variant">
          {t('welcome.by')} <span className="font-medium text-on-surface">skipy-force</span>
        </p>
      </div>
      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 rounded-pill bg-surface-container px-4 py-2 text-sm hover:bg-surface-container-high"
      >
        <ExternalLink size={14} />
        {t('welcome.viewOnGithub')}
      </a>
    </motion.section>
  )
}

function GeneralSection() {
  const { navStyle, setNavStyle, language, setLanguage, showDeveloperSettings, setShowDeveloperSettings } =
    useUiStore()
  const t = useT()

  return (
    <div className="flex flex-col gap-6">
      <motion.section variants={sectionVariants}>
        <h2 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">
          {t('settings.navStyle.title')}
        </h2>
        <div className="flex gap-2">
          {(['sidebar', 'tabs', 'palette'] as NavStyle[]).map((style) => (
            <button
              key={style}
              onClick={() => setNavStyle(style)}
              className={`relative rounded-pill px-4 py-1.5 text-sm ${
                navStyle === style ? 'text-surface' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {navStyle === style && (
                <motion.div
                  layoutId="nav-style-pill"
                  className="absolute inset-0 rounded-pill bg-primary"
                  transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
                />
              )}
              <span className="relative">{t(NAV_STYLE_INFO[style].labelKey)}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">{t(NAV_STYLE_INFO[navStyle].descKey)}</p>
      </motion.section>

      <motion.section variants={sectionVariants}>
        <h2 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">{t('settings.language')}</h2>
        <div className="flex gap-2">
          {(['en', 'ru'] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLanguage(l)}
              className={`relative rounded-pill px-4 py-1.5 text-sm ${
                language === l ? 'text-surface' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {language === l && (
                <motion.div
                  layoutId="language-pill"
                  className="absolute inset-0 rounded-pill bg-primary"
                  transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
                />
              )}
              <span className="relative">{l === 'en' ? 'English' : 'Русский'}</span>
            </button>
          ))}
        </div>
      </motion.section>

      <motion.section variants={sectionVariants}>
        <DevUnlockButton showDeveloperSettings={showDeveloperSettings} setShowDeveloperSettings={setShowDeveloperSettings} />
      </motion.section>
    </div>
  )
}

function DevUnlockButton({
  showDeveloperSettings,
  setShowDeveloperSettings,
}: {
  showDeveloperSettings: boolean
  setShowDeveloperSettings: (v: boolean) => void
}) {
  const t = useT()
  const [holdProgress, setHoldProgress] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  const stopHold = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    startRef.current = null
  }

  useEffect(() => stopHold, [])

  const tick = () => {
    if (startRef.current === null) return
    const elapsed = performance.now() - startRef.current
    const progress = Math.min(1, elapsed / DEV_UNLOCK_HOLD_MS)
    setHoldProgress(progress)
    if (progress >= 1) {
      setShowDeveloperSettings(true)
      stopHold()
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const handlePointerDown = () => {
    if (showDeveloperSettings) return
    startRef.current = performance.now()
    rafRef.current = requestAnimationFrame(tick)
  }

  const handlePointerUp = () => {
    stopHold()
    if (!showDeveloperSettings) setHoldProgress(0)
  }

  const handleClick = () => {
    if (showDeveloperSettings) {
      setShowDeveloperSettings(false)
      setHoldProgress(0)
    }
  }

  const fillRatio = showDeveloperSettings ? 1 : holdProgress

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={handleClick}
      className="relative flex h-12 w-full select-none items-center justify-center overflow-hidden rounded-lg bg-surface-container text-sm"
    >
      <motion.div
        className="absolute inset-x-0 bottom-0 bg-sky-500/40"
        initial={false}
        animate={{ height: `${fillRatio * 100}%` }}
        transition={
          holdProgress > 0 && !showDeveloperSettings
            ? { duration: 0.05, ease: 'linear' }
            : { type: 'spring', bounce: 0.4, duration: 0.5 }
        }
      />
      <span className="relative z-10 flex items-center gap-2">
        <Droplet size={14} className={showDeveloperSettings ? 'text-sky-400' : 'text-on-surface-variant'} />
        {showDeveloperSettings ? t('settings.devUnlock.unlocked') : t('settings.devUnlock.locked')}
      </span>
    </button>
  )
}

function ProfileSection() {
  const { displayName, setDisplayName, avatarDataUri, setAvatarDataUri } = useUiStore()
  const t = useT()
  const [nameInput, setNameInput] = useState(displayName)

  const pickAvatarMutation = useMutation({
    mutationFn: () => api.pickAvatar(),
    onSuccess: (uri) => {
      if (uri) setAvatarDataUri(uri)
    },
  })

  return (
    <motion.section variants={sectionVariants} className="flex flex-col gap-6">
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">
          {t('settings.profile.avatar')}
        </h2>
        <div className="flex items-center gap-3">
          <Avatar displayName={displayName} avatarDataUri={avatarDataUri} size={56} />
          <button
            onClick={() => pickAvatarMutation.mutate()}
            className="flex items-center gap-2 rounded-pill bg-surface-container px-3 py-1.5 text-sm hover:bg-surface-container-high"
          >
            <Upload size={14} />
            {t('settings.profile.uploadAvatar')}
          </button>
          {avatarDataUri && (
            <button
              onClick={() => setAvatarDataUri('')}
              className="flex items-center gap-2 rounded-pill bg-surface-container px-3 py-1.5 text-sm hover:bg-surface-container-high"
            >
              <X size={14} />
              {t('settings.profile.removeAvatar')}
            </button>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">{t('settings.profile.name')}</h2>
        <div className="flex items-center gap-2">
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder={t('settings.profile.namePlaceholder')}
            className="w-48 rounded-md bg-surface-container px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={() => setDisplayName(nameInput.trim())}
            className="rounded-pill bg-surface-container px-3 py-1.5 text-sm hover:bg-surface-container-high"
          >
            {t('common.save')}
          </button>
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">{t('settings.profile.hint')}</p>
      </div>
    </motion.section>
  )
}

function AppearanceSection() {
  const { uiScale, setUiScale, customAccentColor, setCustomAccentColor, themePreset, setThemePreset } = useUiStore()
  const t = useT()

  const presetOptions: { id: ThemePresetId; name: string; swatch: string }[] = [
    { id: 'auto', name: t('settings.appearance.themePreset.auto'), swatch: '' },
    ...(Object.keys(THEME_PRESETS) as Exclude<ThemePresetId, 'auto'>[]).map((id) => ({
      id,
      name: THEME_PRESETS[id].name,
      swatch: THEME_PRESETS[id].colors.primary,
    })),
  ]

  return (
    <div className="flex flex-col gap-6">
      <motion.section variants={sectionVariants}>
        <h2 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">
          {t('settings.appearance.themePreset')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {presetOptions.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setThemePreset(preset.id)}
              className={`relative flex items-center gap-2 rounded-pill px-3 py-1.5 text-sm ${
                themePreset === preset.id ? 'text-surface' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {themePreset === preset.id && (
                <motion.div
                  layoutId="theme-preset-pill"
                  className="absolute inset-0 rounded-pill bg-primary"
                  transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                {preset.swatch && (
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: preset.swatch }} />
                )}
                {preset.name}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">{t('settings.appearance.themePresetHint')}</p>
      </motion.section>

      <motion.section variants={sectionVariants}>
        <h2 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">
          {t('settings.appearance.uiScale')}
        </h2>
        <div className="flex gap-2">
          {UI_SCALE_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setUiScale(preset)}
              className={`relative rounded-pill px-4 py-1.5 text-sm ${
                uiScale === preset ? 'text-surface' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {uiScale === preset && (
                <motion.div
                  layoutId="ui-scale-pill"
                  className="absolute inset-0 rounded-pill bg-primary"
                  transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
                />
              )}
              <span className="relative">{preset}%</span>
            </button>
          ))}
        </div>
      </motion.section>

      <motion.section variants={sectionVariants}>
        <h2 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">
          {t('settings.appearance.accentColor')}
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={customAccentColor || '#c4b5fd'}
            onChange={(e) => setCustomAccentColor(e.target.value)}
            className="h-9 w-9 cursor-pointer rounded border border-outline bg-transparent"
          />
          {customAccentColor && (
            <button
              onClick={() => setCustomAccentColor('')}
              className="rounded-pill bg-surface-container px-3 py-1.5 text-sm hover:bg-surface-container-high"
            >
              {t('settings.appearance.resetToTheme')}
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">{t('settings.appearance.accentColorHint')}</p>
      </motion.section>
    </div>
  )
}

function TrackingSection() {
  const t = useT()
  const queryClient = useQueryClient()

  const { data: tier } = useQuery({
    queryKey: ['idleDetectorTier'],
    queryFn: async () => api.getIdleDetectorTier(),
  })
  const { data: appState } = useQuery({
    queryKey: queryKeys.appState,
    queryFn: api.getAppState,
  })

  const [afkMinutes, setAfkMinutes] = useState('')
  useEffect(() => {
    if (appState) setAfkMinutes(String(appState.AFKThresholdMinutes))
  }, [appState])

  const afkMutation = useMutation({
    mutationFn: (minutes: number) => api.setAFKThreshold(minutes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.appState }),
  })

  return (
    <div className="flex flex-col gap-6">
      <motion.section variants={sectionVariants}>
        <h2 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">
          {t('settings.tracking.afkThreshold')}
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={afkMinutes}
            onChange={(e) => setAfkMinutes(e.target.value)}
            className="w-20 rounded-md bg-surface-container px-3 py-1.5 text-sm outline-none [appearance:textfield] focus:ring-1 focus:ring-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-sm text-on-surface-variant">{t('settings.tracking.afkThresholdDesc')}</span>
          <button
            onClick={() => {
              const minutes = Number(afkMinutes)
              if (Number.isFinite(minutes) && minutes > 0) afkMutation.mutate(minutes)
            }}
            className="rounded-pill bg-surface-container px-3 py-1.5 text-sm hover:bg-surface-container-high"
          >
            {t('common.save')}
          </button>
        </div>
      </motion.section>

      <motion.section variants={sectionVariants}>
        <h2 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">
          {t('settings.tracking.idleDetection')}
        </h2>
        <div
          className={`rounded-lg p-3 text-sm ${tier === 'none' ? 'bg-error/10 text-error' : 'bg-surface-container'}`}
        >
          {tier ? t(`idle.${tier}`) : t('common.loading')}
        </div>
      </motion.section>
    </div>
  )
}

function DeveloperSection() {
  const t = useT()
  const { data: dbPath } = useQuery({
    queryKey: ['dbPath'],
    queryFn: api.getDBPath,
  })
  const { data: appVersion } = useQuery({
    queryKey: ['appVersion'],
    queryFn: api.getAppVersion,
  })
  const openFolderMutation = useMutation({
    mutationFn: () => api.openDataFolder(),
  })

  return (
    <motion.section variants={sectionVariants}>
      <h2 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">
        {t('settings.developer.diagnostics')}
      </h2>
      <div className="flex flex-col gap-2 rounded-lg bg-surface-container p-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-on-surface-variant">{t('settings.developer.database')}</span>
          <span className="truncate font-mono text-xs">{dbPath ?? t('common.loading')}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-on-surface-variant">{t('settings.developer.version')}</span>
          <span className="font-mono text-xs">{appVersion ?? t('common.loading')}</span>
        </div>
        <button
          onClick={() => openFolderMutation.mutate()}
          className="mt-1 flex items-center gap-2 self-start rounded-pill bg-surface-container-high px-3 py-1.5 text-sm hover:bg-outline/20"
        >
          <FolderOpen size={14} />
          {t('settings.developer.openFolder')}
        </button>
      </div>

      <LogsViewer />
    </motion.section>
  )
}

function LogsViewer() {
  const t = useT()
  const { data: logs, refetch, isFetching } = useQuery({
    queryKey: ['recentLogs'],
    queryFn: () => api.getRecentLogs(300),
  })

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase text-on-surface-variant">{t('settings.developer.logs')}</h2>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-pill bg-surface-container px-3 py-1 text-xs hover:bg-surface-container-high"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
          {t('settings.developer.refresh')}
        </button>
      </div>
      <pre className="h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-container p-3 font-mono text-xs text-on-surface-variant">
        {logs || t('settings.developer.noLogs')}
      </pre>
    </div>
  )
}
