'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronsLeft, ScanSearch } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navItems, activeNav } from '@/lib/nav'

interface AppSidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname()
  const current = activeNav(pathname)

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      {/* Brand / logo area */}
      <div
        className={cn(
          'flex h-16 items-center gap-3 border-b border-sidebar-border px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
          <ScanSearch className="size-5 text-white" strokeWidth={2} />
        </span>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-white">Proposal Intelligence</p>
            <p className="truncate text-xs text-sidebar-muted">Procurement Portal</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar">
        {!collapsed && (
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
            Workspace
          </p>
        )}
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = current?.href === item.href
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    collapsed && 'justify-center px-0',
                    isActive
                      ? 'bg-sidebar-accent text-white shadow-sm'
                      : 'text-sidebar-foreground hover:bg-white/5 hover:text-white',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    className={cn('size-4.5 shrink-0', isActive ? 'text-white' : 'text-sidebar-muted group-hover:text-white')}
                    strokeWidth={2}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-white/5 hover:text-white',
            collapsed && 'justify-center px-0',
          )}
        >
          <ChevronsLeft
            className={cn('size-4.5 shrink-0 transition-transform', collapsed && 'rotate-180')}
            strokeWidth={2}
          />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
