import { ArrowRight, ShieldCheck } from 'lucide-react'

import { Container } from '../components/Container'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { useCases } from '../content'

export function UseCases() {
  return (
    <section className="border-t border-line py-24 sm:py-32">
      <Container>
        <SectionHeading eyebrow={useCases.eyebrow} title={useCases.title} />
        <div className="mt-14 grid gap-3 lg:grid-cols-3">
          {useCases.items.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.08}>
              <article className="depth relative flex h-full flex-col rounded-card bg-surface p-6 shadow-glow">
                <div className="flex items-center justify-between">
                  <span
                    className="round grid size-9 place-items-center rounded-[12px] text-[12px] font-semibold text-black/70"
                    style={{ background: `linear-gradient(135deg, hsl(${item.hue} 82% 68%), hsl(${item.hue + 35} 74% 52%))` }}
                  >
                    {item.title[0]}
                  </span>
                  <span className="text-[11px] text-faint">{item.title}</span>
                </div>
                <h3 className="mt-5 text-[18px] font-semibold tracking-tight">{item.subtitle}</h3>
                <p className="mt-3 rounded-[12px] bg-white/[0.03] p-3 text-[12.5px] leading-relaxed text-muted">
                  “{item.prompt}”
                </p>
                <ul className="mt-4 flex flex-col gap-2">
                  {item.outputs.map((output) => (
                    <li key={output} className="flex items-center gap-2 text-[13px] text-fg/85">
                      <span className="size-1 rounded-full bg-accent" /> {output}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex items-center gap-2 border-t border-line pt-4 text-[11px] text-muted">
                  <ShieldCheck className="size-3.5 text-emerald-400" />
                  Approval before anything leaves the workspace
                </div>
              </article>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.1} className="mt-6 text-center">
          <a href="/app/templates" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent-2">
            Browse ready-made starting configurations <ArrowRight className="size-3.5" />
          </a>
        </Reveal>
      </Container>
    </section>
  )
}
