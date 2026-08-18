import {
  BarChart3,
  FileSearch,
  FileText,
  GitCompareArrows,
  LayoutDashboard,
  Plus,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  match?: (path: string) => boolean
}

export const navItems: NavItem[] = [
  { label: 'Home', href: '/', icon: LayoutDashboard, match: (p) => p === '/' },
  {
    label: 'New Evaluation',
    href: '/evaluations/new',
    icon: Plus,
    match: (p) => p.startsWith('/evaluations/new'),
  },
  {
    label: 'Evaluations',
    href: '/evaluations',
    icon: FileText,
    match: (p) =>
      p === '/evaluations' ||
      (p.startsWith('/evaluations/') && !p.startsWith('/evaluations/new')),
  },
  { label: 'RFP Analysis', href: '/rfp-analysis', icon: FileSearch },
  { label: 'Vendor Comparison', href: '/comparison', icon: GitCompareArrows },
  { label: 'Compliance', href: '/compliance', icon: ShieldCheck },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export function activeNav(path: string): NavItem | undefined {
  return navItems.find((item) => (item.match ? item.match(path) : path.startsWith(item.href)))
}
