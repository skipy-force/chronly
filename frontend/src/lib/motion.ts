import type { Variants } from 'framer-motion'

export function fadeInVariants(duration = 0.6, y = 12): Variants {
  return {
    hidden: { opacity: 0, y },
    show: { opacity: 1, y: 0, transition: { duration, ease: 'easeOut' } },
  }
}

export function staggerContainer(staggerChildren = 0.1) {
  return { show: { transition: { staggerChildren } } }
}
