import { GetThemeCSS } from '../../wailsjs/go/main/App'
import { EventsOn } from '../../wailsjs/runtime/runtime'

const STYLE_TAG_ID = 'matugen-theme'

function applyThemeCSS(css: string) {
  let tag = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null
  if (!css) {
    tag?.remove()
    return
  }
  if (!tag) {
    tag = document.createElement('style')
    tag.id = STYLE_TAG_ID
    document.head.appendChild(tag)
  }
  tag.textContent = css
}

export function installMatugenTheme(): () => void {
  GetThemeCSS().then(applyThemeCSS).catch(() => {})
  const unsubscribe = EventsOn('theme:changed', (css: string) => applyThemeCSS(css))
  return unsubscribe
}
