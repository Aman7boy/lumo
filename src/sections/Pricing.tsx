import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { useState } from 'react'

import { Button } from '../components/Button'
import { Container } from '../components/Container'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { pricing } from '../content'
import { cx } from '../lib/cx'
import { plans } from '../shared/catalog'

const etb = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function Pricing() {
  const [yearly, setYearly] = useState(false)
  return (
    <section id="pricing" className="scroll-mt-24 border-t border-line py-24 sm:py-32">
      <Container>
        <SectionHeading eyebrow={pricing.eyebrow} title={pricing.title} description={pricing.description} />

        <Reveal className="mt-9 flex justify-center">
          <div role="radiogroup" aria-label="Billing period" className="depth relative grid h-11 grid-cols-2 rounded-control bg-surface p-1 text-[13px]">
            {(['monthly', 'yearly'] as const).map((period) => {
              const selected = (period === 'yearly') === yearly
              return (
                <button
                  key={period}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setYearly(period === 'yearly')}
                  className={cx(
                    'relative z-10 flex items-center justify-center gap-2 rounded-[10px] px-5 capitalize transition-colors',
                    selected ? 'text-fg' : 'text-muted hover:text-fg',
                  )}
                >
                  {selected && (
                    <motion.span
                      layoutId="billing-pill"
                      className="absolute inset-0 -z-10 rounded-[10px] bg-white/[0.08]"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                  {period}
                  {period === 'yearly' && (
                    <span className="rounded-[6px] bg-accent-2/15 px-1.5 py-0.5 text-[10px] text-accent-2">{pricing.yearlyNote}</span>
                  )}
                </button>
              )
            })}
          </div>
        </Reveal>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {plans.map((tier, i) => {
            const price = tier.price === null ? null : yearly ? tier.price * 10 : tier.price
            return (
              <Reveal key={tier.key} delay={(i % 5) * 0.05} className="h-full">
                <article
                  className={cx(
                    'depth relative flex h-full flex-col rounded-card-sm bg-surface p-5',
                    tier.popular
                      ? '[--depth-edge:rgb(255_122_69/0.5)] [--depth-highlight:rgb(255_181_71/0.28)] shadow-[0_30px_70px_-40px_rgb(255_122_69/0.5)]'
                      : 'shadow-glow',
                  )}
                >
                  {tier.popular && (
                    <span className="absolute right-4 top-4 rounded-[6px] bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">Popular</span>
                  )}
                  <h3 className="text-[15px] font-semibold">{tier.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    {price === null ? (
                      <span className="text-[26px] font-semibold tracking-tight">Custom</span>
                    ) : (
                      <>
                        <span className="text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{etb.format(price)}</span>
                        <span className="text-[11px] text-muted">ETB</span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-faint">
                    {price === null ? 'tailored scope' : price === 0 ? 'forever, no card' : yearly ? 'per year' : 'per month'}
                  </p>
                  <p className="mt-3 min-h-[38px] text-[12px] leading-snug text-muted">{tier.blurb}</p>
                  <Button
                    variant={tier.popular ? 'primary' : 'secondary'}
                    href={tier.key === 'enterprise' ? 'mailto:hello@lumo.et' : '/signup'}
                    className="mt-4 h-9 w-full rounded-[11px] px-3 text-[12px]"
                  >
                    {tier.key === 'enterprise' ? 'Talk to us' : price === 0 ? 'Start free' : 'Choose plan'}
                  </Button>
                  <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-[11.5px] leading-snug text-fg/85">
                        <span className="mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-[5px] bg-white/[0.08]">
                          <Check className="size-2.5" />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            )
          })}
        </div>
        <p className="mt-6 text-center text-[12px] text-faint">
          Prices are proposals for testing, not validated market rates. Plan changes are self-serve inside Settings.
        </p>
      </Container>
    </section>
  )
}
