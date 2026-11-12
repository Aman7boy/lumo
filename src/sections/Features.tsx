import { motion } from 'motion/react'
import type { ReactElement } from 'react'
import { BookOpen, Check, Lock, ShieldCheck } from 'lucide-react'

import { Container } from '../components/Container'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { features } from '../content'
import { cx } from '../lib/cx'

const visuals: Record<string, () => ReactElement> = {
  engine: EngineVisual,
  knowledge: KnowledgeVisual,
  tools: ToolsVisual,
  isolation: IsolationVisual,
}

export function Features() {
  return (
    <section id="platform" className="scroll-mt-24 border-t border-line py-24 sm:py-32">
      <Container>
        <SectionHeading eyebrow={features.eyebrow} title={features.title} description={features.description} />
        <div className="mt-14 grid auto-rows-[300px] grid-cols-1 gap-4 md:grid-cols-3">
          {features.items.map((item, i) => {
            const Visual = visuals[item.key]
            return (
              <Reveal key={item.key} delay={(i % 3) * 0.08} className={cx(item.span === 2 && 'md:col-span-2')}>
                <article className="depth group relative flex h-full flex-col overflow-hidden rounded-card bg-surface shadow-glow transition-colors duration-300 hover:[--depth-edge:rgb(255_236_224/0.22)]">
                  <div className="relative min-h-0 flex-1 overflow-hidden">
                    <Visual />
                  </div>
                  <div className="relative shrink-0 border-t border-line px-6 py-4">
                    <h3 className="text-[16px] font-semibold tracking-tight">{item.title}</h3>
                    <p className="mt-1 text-[14px] leading-snug text-muted">{item.description}</p>
                  </div>
                </article>
              </Reveal>
            )
          })}
        </div>
      </Container>
    </section>
  )
}

const engineAgents = [
  { name: 'Atlas', role: 'Business', hue: 24 },
  { name: 'Scout', role: 'Research', hue: 145 },
  { name: 'Vera', role: 'Executive', hue: 275 },
  { name: 'Pitch', role: 'Sales', hue: 42 },
]

function EngineVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          {engineAgents.map((agent, i) => (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.5 }}
              className="depth relative flex w-[136px] items-center gap-2 rounded-[12px] bg-bg/50 px-2.5 py-2"
            >
              <span
                className="round grid size-5 place-items-center text-[9px] font-semibold text-black/70"
                style={{ background: `hsl(${agent.hue} 78% 66%)` }}
              >
                {agent.name[0]}
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-medium leading-tight">{agent.name}</span>
                <span className="block text-[9px] text-faint">{agent.role}</span>
              </span>
              <span className="ml-auto size-1.5 rounded-full bg-emerald-400/80" />
            </motion.div>
          ))}
        </div>

        <svg aria-hidden viewBox="0 0 120 200" className="h-full w-[74px] shrink-0 overflow-visible">
          <path d="M0 26 C40 26 30 100 66 100" fill="none" stroke="rgba(255,122,69,0.35)" strokeWidth="1.5" />
          <path d="M0 76 C40 76 30 100 66 100" fill="none" stroke="rgba(255,122,69,0.25)" strokeWidth="1.5" />
          <path d="M0 126 C40 126 30 100 66 100" fill="none" stroke="rgba(255,122,69,0.25)" strokeWidth="1.5" />
          <path d="M0 176 C40 176 30 100 66 100" fill="none" stroke="rgba(255,122,69,0.35)" strokeWidth="1.5" />
          <circle cx="66" cy="100" r="4" fill="#ffb547" />
        </svg>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="depth relative flex flex-1 flex-col rounded-[14px] bg-white/[0.03] p-3"
        >
          <p className="text-[10px] font-medium text-accent">Agent engine</p>
          <p className="mt-1 text-[11px] leading-snug text-muted">
            Reads the agent row: instructions, model, tools, memory, knowledge and autonomy.
          </p>
          <div className="mt-3 space-y-1.5">
            {['Model layer', 'Memory', 'Retrieval', 'Tool runner'].map((layer) => (
              <div key={layer} className="flex items-center justify-between rounded-[7px] bg-black/20 px-2 py-1 text-[9.5px]">
                <span className="text-fg/75">{layer}</span>
                <span className="text-emerald-400">ready</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function KnowledgeVisual() {
  return (
    <div className="absolute inset-0 flex flex-col gap-2 p-6">
      {[
        { title: 'Product catalogue 2026', meta: '18 passages' },
        { title: 'Quotation policy', meta: '6 passages' },
        { title: 'Supplier list', meta: '4 passages' },
      ].map((doc, i) => (
        <motion.div
          key={doc.title}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 + i * 0.1, duration: 0.45 }}
          className="depth relative flex items-center gap-2 rounded-[11px] bg-bg/50 px-2.5 py-2"
        >
          <BookOpen className="size-3.5 shrink-0 text-accent-2" />
          <span className="min-w-0 flex-1 truncate text-[11px] text-fg/85">{doc.title}</span>
          <span className="shrink-0 text-[9px] text-faint">{doc.meta}</span>
        </motion.div>
      ))}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.55, duration: 0.45 }}
        className="mt-auto rounded-[10px] border-l-2 border-accent/60 bg-accent/[0.06] px-3 py-2 text-[10px] leading-relaxed text-muted"
      >
        “P-28 24 g: 11.40 ETB per unit, minimum 10,000 units.”
        <span className="mt-1 block text-[9px] text-accent/80">Cited from Product catalogue 2026</span>
      </motion.div>
    </div>
  )
}

const toolChips = ['Gmail', 'Telegram', 'Web search', 'Browser', 'Sheets', 'Calendar', 'Files', 'Database']

function ToolsVisual() {
  return (
    <div className="absolute inset-0 flex flex-col p-6">
      <div className="flex flex-wrap gap-1.5">
        {toolChips.map((tool, i) => (
          <motion.span
            key={tool}
            initial={{ opacity: 0, scale: 0.92 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.05, duration: 0.35 }}
            className={cx(
              'rounded-[7px] px-2 py-1 text-[10px]',
              i < 5 ? 'bg-accent/10 text-accent' : 'bg-white/[0.06] text-muted',
            )}
          >
            {tool}
          </motion.span>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-2">
        <div className="flex items-start gap-2 rounded-[10px] bg-amber-400/[0.07] px-2.5 py-2 text-[10px] leading-snug text-amber-200/90">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          Draft email to Zewditu Beverages — waiting for approval
        </div>
        <div className="flex items-center gap-1.5 text-[9.5px] text-faint">
          <Check className="size-3 text-emerald-400" /> Nothing leaves the workspace without you
        </div>
      </div>
    </div>
  )
}

function IsolationVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-4 p-6">
      {[
        { name: 'Selam Packaging', agents: 3, hue: 24 },
        { name: 'Northwind Studio', agents: 2, hue: 210 },
        { name: 'Your workspace', agents: 1, hue: 145 },
      ].map((tenant, i) => (
        <motion.div
          key={tenant.name}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.12 + i * 0.12, duration: 0.5 }}
          className="depth relative flex w-[124px] flex-col rounded-[13px] bg-bg/50 p-3"
        >
          <span className="round grid size-6 place-items-center" style={{ background: `hsl(${tenant.hue} 70% 60% / 0.16)` }}>
            <Lock className="size-3" style={{ color: `hsl(${tenant.hue} 80% 72%)` }} />
          </span>
          <span className="mt-2 truncate text-[10.5px] font-medium">{tenant.name}</span>
          <span className="text-[9px] text-faint">{tenant.agents} agents · isolated</span>
          <div className="mt-2 flex gap-1">
            {Array.from({ length: tenant.agents }).map((_, index) => (
              <span key={index} className="h-1 flex-1 rounded-full" style={{ background: `hsl(${tenant.hue} 70% 60% / 0.35)` }} />
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
