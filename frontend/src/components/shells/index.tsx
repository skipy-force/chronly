import { ReactNode } from 'react'
import { useUiStore } from '../../store/uiStore'
import { SidebarShell } from './SidebarShell'
import { TabsShell } from './TabsShell'
import { CommandPaletteShell } from './CommandPaletteShell'

export function Shell({ children }: { children: ReactNode }) {
  const navStyle = useUiStore((s) => s.navStyle)
  if (navStyle === 'tabs') return <TabsShell>{children}</TabsShell>
  if (navStyle === 'palette') return <CommandPaletteShell>{children}</CommandPaletteShell>
  return <SidebarShell>{children}</SidebarShell>
}
