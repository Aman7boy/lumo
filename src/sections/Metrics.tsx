import { useEffect, useState } from 'react'

import { Container } from '../components/Container'
import { Reveal } from '../components/Reveal'
import { metrics } from '../content'

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let frame = 0
    const started = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 1100)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(value * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <span className="tabular-nums">{Math.round(display)}</span>
}

export function Metrics() {
  return (
    <section className="border-t border-line py-16">
      <Container>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
          {metrics.map((m, i) => (
            <Reveal key={m.label} delay={i * 0.07}>
              <div className="flex flex-col gap-2 md:items-center md:text-center">
                <dd className="order-1 text-[40px] font-semibold leading-none tracking-[-0.03em] sm:text-[46px]">
                  <CountUp value={m.value} />
                </dd>
                <dt className="order-2 max-w-[180px] text-[13px] leading-snug text-muted">{m.label}</dt>
              </div>
            </Reveal>
          ))}
        </dl>
      </Container>
    </section>
  )
}
