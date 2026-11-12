import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Bot,
  ChevronDown,
  Database as DatabaseIcon,
  DatabaseBackup,
  ScanLine,
  Volume2,
  LayoutDashboard,
  LayoutTemplate,
  KeyRound,
  ListChecks,
  LogOut,
  Menu,
  MessagesSquare,
  Plug,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { LogoMark } from '../components/Logo'
import { Button } from '../components/Button'
import { api } from '../lib/api'
import { cx } from '../lib/cx'
import { Link, navigate, useNavigation } from '../lib/router'
import { useAuth } from './AuthContext'
import type { AgentTask } from '../shared/types'
import { Spinner } from './ui'

const groups: Array<{ label: string; items: Array<{ label: string; href: string; icon: LucideIcon; exact?: boolean }> }> = [
  {
    label: 'Workspace',
    items: [
      { label: 'Overview', href: '/app', icon: LayoutDashboard, exact: true },
      { label: 'My agents', href: '/app/agents', icon: Bot },
      { label: 'Templates', href: '/app/templates', icon: LayoutTemplate },
      { label: 'Knowledge base', href: '/app/knowledge', icon: BookOpen },
      { label: 'AI Providers', href: '/app/providers', icon: KeyRound },
      { label: 'Integrations', href: '/app/integrations', icon: Plug },
      { label: 'Automations', href: '/app/automations', icon: Workflow },
    ],
  },
  {
    label: 'Data & accounts',
    items: [
      { label: 'Documents', href: '/app/documents', icon: ScanLine },
      { label: 'Connected accounts', href: '/app/settings/accounts', icon: Plug },
      { label: 'Database', href: '/app/settings/database', icon: DatabaseIcon },
      { label: 'Backups', href: '/app/settings/backups', icon: DatabaseBackup },
      { label: 'Voice', href: '/app/settings/voice', icon: Volume2 },
    ],
  },
  {
    label: 'Activity',
    items: [
      { label: 'Conversations', href: '/app/conversations', icon: MessagesSquare },
      { label: 'Tasks', href: '/app/tasks', icon: ListChecks },
      { label: 'Analytics', href: '/app/analytics', icon: BarChart3 },
    ],
  },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { me, loading, signOut } = useAuth()
  const { pathname } = useNavigation()
  const [drawer, setDrawer] = useState(false)
  const [menu, setMenu] = useState(false)
  const [approvals, setApprovals] = useState<AgentTask[]>([])

  useEffect(() => {
    if (!loading && !me) navigate('/login', { replace: true })
  }, [loading, me])

  useEffect(() => {
    setDrawer(false)
    setMenu(false)
  }, [pathname])

  useEffect(() => {
    if (!me) return
    api
      .get<AgentTask[]>('/api/tasks?status=awaiting_approval')
      .then(setApprovals)
      .catch(() => undefined)
  }, [me, pathname])

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <Spinner /> Opening your workspace…
        </div>
      </div>
    )
  }
  if (!me) return null

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <Link href="/app" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-[14px] font-semibold tracking-tight">Lumo</span>
        </Link>
        <span className="ml-auto rounded-[5px] bg-white/[0.06] px-1.5 py-0.5 text-[9.5px] text-faint">beta</span>
      </div>

      <div className="mx-3 mt-1 rounded-[12px] border border-line bg-white/[0.02] px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-[0.1em] text-faint">Workspace</p>
        <p className="mt-1 truncate text-[12.5px] font-medium">{me.workspace.name}</p>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[10.5px] text-muted">{me.plan.name} plan</span>
          <Link href="/app/settings" className="text-[10.5px] text-accent hover:text-accent-2">
            Manage
          </Link>
        </div>
      </div>

      <div className="px-3 pt-3">
        <Button onClick={() => navigate('/app/agents/new')} className="w-full justify-start gap-2 px-3 text-[12.5px]">
          <Plus className="size-3.5" /> Create new agent
        </Button>
      </div>

      <nav className="mt-4 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-2.5 pb-3">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-2 text-[10px] uppercase tracking-[0.12em] text-faint">{group.label}</p>
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cx(
                        'group flex h-8.5 items-center gap-2.5 rounded-[9px] px-2 text-[12.5px] transition-colors',
                        active ? 'bg-white/[0.08] text-fg' : 'text-muted hover:bg-white/[0.04] hover:text-fg',
                      )}
                    >
                      <item.icon className={cx('size-4', active ? 'text-accent' : 'text-faint group-hover:text-muted')} />
                      <span className="flex-1">{item.label}</span>
                      {item.href === '/app/tasks' && approvals.length > 0 && (
                        <span className="rounded-[5px] bg-amber-400/15 px-1.5 py-0.5 text-[9.5px] text-amber-300">{approvals.length}</span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-2.5">
        {me.isAdmin && (
          <Link
            href="/app/admin"
            className="flex h-8.5 items-center gap-2.5 rounded-[9px] px-2 text-[12.5px] text-muted transition-colors hover:bg-white/[0.04] hover:text-fg"
          >
            <ShieldCheck className="size-4 text-faint" /> Platform admin
          </Link>
        )}
        <Link
          href="/app/settings"
          className="flex h-8.5 items-center gap-2.5 rounded-[9px] px-2 text-[12.5px] text-muted transition-colors hover:bg-white/[0.04] hover:text-fg"
        >
          <Settings className="size-4 text-faint" /> Settings
        </Link>
        <div className="relative mt-1">
          <button
            type="button"
            onClick={() => setMenu((value) => !value)}
            className="flex w-full items-center gap-2.5 rounded-[9px] px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
          >
            <span className="round grid size-7 shrink-0 place-items-center bg-gradient-to-br from-accent-2 to-accent text-[10px] font-semibold text-black/75">
              {me.user.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium">{me.user.name}</span>
              <span className="block truncate text-[10px] text-faint">{me.workspace.accountType} account</span>
            </span>
            <ChevronDown className={cx('size-3.5 text-faint transition-transform', menu && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {menu && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="depth absolute bottom-full left-0 right-0 z-20 mb-1 rounded-[11px] bg-surface p-1 shadow-glow"
              >
                <Link href="/app/settings" className="flex items-center gap-2 rounded-[7px] px-2 py-1.5 text-[12px] text-muted hover:bg-white/[0.05] hover:text-fg">
                  <Settings className="size-3.5" /> Account and plan
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut()
                    navigate('/login')
                  }}
                  className="flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-[12px] text-muted hover:bg-white/[0.05] hover:text-fg"
                >
                  <LogOut className="size-3.5" /> Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] border-r border-line bg-bg lg:block">{sidebar}</aside>

      <AnimatePresence>
        {drawer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setDrawer(false)}>
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
              className="h-full w-[264px] border-r border-line bg-bg"
            >
              {sidebar}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawer(true)}
            className="grid size-8 place-items-center rounded-[9px] text-muted hover:bg-white/[0.06] hover:text-fg lg:hidden"
          >
            <Menu className="size-4.5" />
          </button>
          <Link href="/app" className="flex items-center gap-2 text-[12.5px] text-muted hover:text-fg lg:hidden">
            <LogoMark className="size-6 rounded-[8px]" />
            Lumo
          </Link>

          <div className="hidden items-center gap-2 text-[12px] lg:flex">
            <span className="text-faint">Workspace</span>
            <span className="text-faint">/</span>
            <span className="font-medium text-fg/90">{me.workspace.name}</span>
            <span className="ml-2 rounded-[6px] bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-muted">{me.plan.name}</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {approvals.length > 0 && (
              <Link
                href="/app/tasks"
                className="hidden items-center gap-1.5 rounded-[8px] bg-amber-400/10 px-2.5 py-1.5 text-[11.5px] text-amber-300 sm:inline-flex"
              >
                <ShieldCheck className="size-3.5" /> {approvals.length} awaiting approval
              </Link>
            )}
            <span
              className="hidden items-center gap-1.5 rounded-[8px] border border-line px-2.5 py-1.5 text-[11px] text-muted md:inline-flex"
              title={me.engine.externalConfigured ? `External model configured: ${me.engine.model}` : 'Answers run on the built-in engine with your workspace documents as context.'}
            >
              <Sparkles className="size-3 text-accent" />
              {me.engine.externalConfigured ? me.engine.model : 'Lumo Core'}
              <span className={cx('size-1.5 rounded-full', me.engine.externalConfigured ? 'bg-emerald-400' : 'bg-accent-2')} />
            </span>
            <Button onClick={() => navigate('/app/agents/new')} className="h-8 rounded-[9px] px-3 text-[12px]">
              <Plus className="size-3.5" /> New agent
            </Button>
          </div>
        </header>

        <main id="app-main" tabIndex={-1} className="mx-auto w-full max-w-[1220px] px-4 pb-20 pt-5 outline-none sm:px-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export function PageHeader({
  title,
  description,
  action,
  eyebrow,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  eyebrow?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-faint">{eyebrow}</div>}
        <h1 className="text-[24px] font-semibold tracking-[-0.03em] sm:text-[27px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p>}
        {children}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-[12px] text-muted transition-colors hover:text-fg">
      <ArrowLeft className="size-3" /> {children}
    </Link>
  )
}
