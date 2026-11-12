import { ArrowRight, BookOpen, Brain, Check, ShieldCheck } from 'lucide-react'

import { Container } from '../components/Container'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { channels, tools } from '../shared/catalog'
import { cx } from '../lib/cx'

const groupTone: Record<string, string> = {
  Communication: 'text-sky-300',
  Research: 'text-emerald-300',
  Data: 'text-amber-300',
  Automation: 'text-accent',
  Interface: 'text-fuchsia-300',
}

export function Tools() {
  return (
    <section className="border-t border-line py-24 sm:py-32">
      <Container>
        <SectionHeading
          eyebrow="Capabilities"
          title="Give each agent only the reach it needs"
          description="Not every agent should have every tool. Enable them one by one, connect the account, and decide whether the agent may act or must ask."
        />

        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool, i) => (
            <Reveal key={tool.key} delay={(i % 3) * 0.05}>
              <article className="depth relative flex h-full items-start gap-3 rounded-card-sm bg-surface p-4 shadow-glow">
                <span className={cx('round grid size-9 shrink-0 place-items-center rounded-[11px] bg-white/[0.05] font-semibold', groupTone[tool.group])}>
                  {tool.name[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-medium">{tool.name}</h3>
                    {tool.status === 'beta' && <span className="rounded-[5px] bg-accent/10 px-1.5 py-0.5 text-[9px] text-accent">Beta</span>}
                    {tool.status === 'soon' && <span className="rounded-[5px] bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-faint">Soon</span>}
                  </div>
                  <p className="mt-1 text-[12.5px] leading-snug text-muted">{tool.capability}</p>
                  <p className="mt-1.5 text-[10px] uppercase tracking-wide text-faint">{tool.group}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {[
            {
              icon: BookOpen,
              title: 'Private knowledge',
              body: 'Every agent has its own document scope. Chunks are retrieved per question and cited, so answers can be checked.',
              points: ['PDF, Word, Excel, CSV', 'Workspace-wide or agent-only', 'Passage-level citations'],
            },
            {
              icon: Brain,
              title: 'Long-term memory',
              body: 'Facts you tell an agent are stored per agent and per workspace, then used in later conversations. You can read and delete them.',
              points: ['“Remember our prices”', 'Preferences and instructions', 'Removable at any time'],
            },
            {
              icon: ShieldCheck,
              title: 'Approval guardrails',
              body: 'In approval mode, external actions become tasks. Nothing is sent, booked or submitted until a person approves it.',
              points: ['Draft, then approve', 'Full activity log', 'Per-agent autonomy'],
            },
          ].map(({ icon: Icon, title, body, points }, i) => (
            <Reveal key={title} delay={i * 0.07}>
              <div className="depth relative flex h-full flex-col rounded-card-sm bg-white/[0.02] p-6">
                <Icon className="size-5 text-accent" />
                <h3 className="mt-4 text-[15px] font-semibold">{title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{body}</p>
                <ul className="mt-4 flex flex-col gap-1.5">
                  {points.map((point) => (
                    <li key={point} className="flex items-center gap-2 text-[12px] text-fg/80">
                      <Check className="size-3 text-emerald-400" /> {point}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1} className="mt-12">
          <div className="depth relative flex flex-col gap-4 rounded-card-sm bg-surface px-6 py-5 sm:flex-row sm:items-center">
            <div className="sm:w-52">
              <p className="text-[13px] font-medium">Deploy where the work happens</p>
              <p className="mt-1 text-[12px] text-muted">Website, Telegram, API, internal, or voice later.</p>
            </div>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {channels.map((channel) => (
                <span
                  key={channel.key}
                  className={cx(
                    'rounded-[7px] px-2.5 py-1 text-[11px]',
                    channel.key === 'whatsapp' || channel.key === 'voice'
                      ? 'bg-white/[0.04] text-faint'
                      : 'bg-white/[0.06] text-fg/80',
                  )}
                >
                  {channel.name}
                  {(channel.key === 'whatsapp' || channel.key === 'voice') && ' · later'}
                </span>
              ))}
            </div>
            <a href="/signup" className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent-2">
              Try it <ArrowRight className="size-3.5" />
            </a>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
