import type { Variants } from 'framer-motion'

export function fadeInVariants(duration = 0.6, y = 12, fromScale = 0.94): Variants {
  return {
    hidden: { opacity: 0, y, scale: fromScale },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration, ease: 'easeOut' } },
  }
}

export function staggerContainer(staggerChildren = 0.1) {
  return { show: { transition: { staggerChildren } } }
}
