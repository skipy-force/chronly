import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useUiStore, type ScreenId } from '../store/uiStore'
import { SCREEN_ICONS } from '../lib/screenIcons'
import { useT } from '../lib/i18n'
import chronlyLogo from '../assets/images/icon.svg'

const SLIDE_SCREENS: ScreenId[] = ['today', 'timeline', 'projects', 'rules', 'settings']

export function OnboardingModal() {
  const hasSeenOnboarding = useUiStore((s) => s.hasSeenOnboarding)
  const setHasSeenOnboarding = useUiStore((s) => s.setHasSeenOnboarding)
  const t = useT()
  const [index, setIndex] = useState(0)

  if (hasSeenOnboarding) return null

  const isLast = index === SLIDE_SCREENS.length - 1
  const screenId = SLIDE_SCREENS[index]
  const Icon = SCREEN_ICONS[screenId]

  const finish = () => setHasSeenOnboarding(true)
  const next = () => (isLast ? finish() : setIndex((i) => i + 1))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="flex w-96 flex-col items-center gap-6 rounded-lg bg-surface-container-high p-8 text-center">
        <img src={chronlyLogo} alt="chronly" className="h-12 w-12" />

        <AnimatePresence mode="wait">
          <motion.div
            key={screenId}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex flex-col items-center gap-3"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Icon size={28} />
            </div>
            <p className="text-lg font-semibold">{t(`nav.${screenId}`)}</p>
            <p className="text-sm text-on-surface-variant">{t(`onboarding.${screenId}.desc`)}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-1.5">
          {SLIDE_SCREENS.map((s, i) => (
            <span
              key={s}
              className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-primary' : 'bg-surface-container'}`}
            />
          ))}
        </div>

        <div className="flex w-full items-center justify-between">
          <button onClick={finish} className="text-sm text-on-surface-variant hover:text-on-surface">
            {t('onboarding.skip')}
          </button>
          <button onClick={next} className="rounded-pill bg-primary px-4 py-1.5 text-sm text-surface">
            {isLast ? t('onboarding.getStarted') : t('onboarding.next')}
          </button>
        </div>
      </div>
    </div>
  )
}
