import { ArrowUpRight, BookOpen, ListChecks, MessagesSquare } from 'lucide-react'

import { Link } from '../lib/router'
import { relativeTime } from '../lib/format'
import { categoryMap } from '../shared/catalog'
import type { Agent } from '../shared/types'
import { Badge, Dot } from './ui'

export function AgentCard({ agent, compact = false }: { agent: Agent; compact?: boolean }) {
  const category = categoryMap[agent.category] ?? categoryMap.custom
  const status =
    agent.status === 'deployed'
      ? { label: 'Deployed', tone: 'success' as const }
      : agent.status === 'paused'
        ? { label: 'Paused', tone: 'warning' as const }
        : agent.status === 'testing'
          ? { label: 'Testing', tone: 'info' as const }
          : { label: 'Draft', tone: 'neutral' as const }

  return (
    <Link
      href={`/app/agents/${agent.id}`}
      className="depth group relative flex h-full flex-col rounded-card-sm bg-surface p-4 transition-colors hover:bg-white/[0.025] hover:[--depth-edge:rgb(255_236_224/0.2)]"
    >
      <div className="flex items-start gap-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-[11px] text-[13px] font-semibold text-black/75"
          style={{ background: `linear-gradient(135deg, ${category.color}, ${category.color}aa)` }}
        >
          {agent.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[14px] font-semibold tracking-tight">{agent.name}</h3>
            <Dot tone={status.tone === 'success' ? 'success' : status.tone === 'warning' ? 'warning' : 'neutral'} />
          </div>
          <p className="mt-0.5 truncate text-[11.5px] text-muted">{agent.tagline}</p>
        </div>
        <ArrowUpRight className="size-3.5 shrink-0 text-faint transition-colors group-hover:text-fg" />
      </div>

      {!compact && (
        <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-muted">
          {agent.tasks.slice(0, 2).join(' · ') || agent.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge tone="neutral">{category.name}</Badge>
        <Badge tone={status.tone}>{status.label}</Badge>
        {agent.autonomy === 'approval' && <Badge tone="warning">Approval</Badge>}
      </div>

      {!compact && (
        <div className="mt-auto flex items-center gap-4 border-t border-line pt-3 text-[10.5px] text-faint">
          <span className="inline-flex items-center gap-1">
            <MessagesSquare className="size-3" /> {agent.stats.conversations}
          </span>
          <span className="inline-flex items-center gap-1">
            <ListChecks className="size-3" /> {agent.stats.tasksPending} pending
          </span>
          <span className="inline-flex items-center gap-1">
            <BookOpen className="size-3" /> {agent.stats.knowledgeDocs} docs
          </span>
          <span className="ml-auto">{relativeTime(agent.updatedAt)}</span>
        </div>
      )}
    </Link>
  )
}
