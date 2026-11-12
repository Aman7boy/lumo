import { ArrowRight, LayoutGrid } from 'lucide-react'
import { motion } from 'motion/react'

import { Container } from '../components/Container'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { categories } from '../shared/catalog'

export function Categories() {
  return (
    <section id="agents" className="scroll-mt-24 border-t border-line py-24 sm:py-32">
      <Container>
        <SectionHeading
          eyebrow="Agent categories"
          title="Start from a job, not from a blank page"
          description="Pick the closest category and describe your own version. The builder still asks what the agent should do, who it serves and what it may touch."
        />

        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category, i) => (
            <Reveal key={category.key} delay={(i % 4) * 0.05}>
              <article className="depth group relative flex h-full flex-col rounded-card-sm bg-surface p-5 transition-colors hover:bg-white/[0.03]">
                <div className="flex items-start justify-between">
                  <span
                    className="round grid size-9 place-items-center rounded-[12px]"
                    style={{ background: `${category.color}1f`, color: category.color }}
                  >
                    <span className="text-[13px] font-semibold">{category.name[0]}</span>
                  </span>
                  {category.key === 'custom' && (
                    <span className="rounded-[6px] bg-white/[0.06] px-2 py-0.5 text-[10px] text-muted">Anything</span>
                  )}
                </div>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{category.name}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{category.blurb}</p>
                <p className="mt-auto pt-4 text-[11px] text-faint">{category.examples.join(' · ')}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1} className="mt-6">
          <div className="depth relative flex flex-col items-start gap-4 rounded-card-sm bg-gradient-to-r from-accent/[0.08] via-surface to-surface p-6 sm:flex-row sm:items-center">
            <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-accent/10 text-accent">
              <LayoutGrid className="size-4" />
            </span>
            <div className="flex-1">
              <p className="text-[15px] font-medium">Nothing fits? Describe your own agent.</p>
              <p className="mt-1 text-[13px] text-muted">
                “Watch tender portals, fill the forms we always fill, and alert me when a deadline moves.” That becomes a configured agent, not a chat reply.
              </p>
            </div>
            <a
              href="/signup"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent transition-colors hover:text-accent-2"
            >
              Build it <ArrowRight className="size-3.5" />
            </a>
          </div>
        </Reveal>

        <div className="mt-14 flex items-center gap-3">
          <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} className="h-px flex-1 origin-left bg-line" />
          <span className="text-[11px] uppercase tracking-[0.16em] text-faint">Tools, knowledge, guardrails</span>
          <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} className="h-px flex-1 bg-line" />
        </div>
      </Container>
    </section>
  )
}
