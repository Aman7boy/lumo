import { Container } from '../components/Container'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { steps } from '../content'

export function Steps() {
  return (
    <section id="how" className="scroll-mt-24 border-t border-line py-24 sm:py-32">
      <Container>
        <SectionHeading eyebrow={steps.eyebrow} title={steps.title} />
        <ol className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {steps.items.map((step, i) => (
            <Reveal key={step.title} delay={(i % 3) * 0.07}>
              <li className="depth relative flex h-full flex-col rounded-card-sm bg-surface p-6 shadow-glow">
                <div className="flex items-center gap-3">
                  <span className="depth relative grid size-9 place-items-center rounded-[12px] bg-white/[0.04] text-[13px] font-semibold tabular-nums text-accent-2">
                    {i + 1}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-line-strong to-transparent" />
                </div>
                <h3 className="mt-5 text-[16px] font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{step.description}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  )
}
