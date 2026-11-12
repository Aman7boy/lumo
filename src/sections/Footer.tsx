import { Container } from '../components/Container'
import { Logo } from '../components/Logo'
import { footer } from '../content'

export function Footer() {
  return (
    <footer className="pb-10 pt-20">
      <Container>
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-muted">{footer.blurb}</p>
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-[7px] bg-white/[0.04] px-2 py-1 text-[11px] text-faint">
              <span className="size-1.5 rounded-full bg-emerald-400" /> Phase 1 · builder, engine and studio
            </p>
          </div>
          {footer.columns.map((col) => (
            <div key={col.title}>
              <p className="text-[13px] font-medium text-fg">{col.title}</p>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-[14px] text-muted transition-colors hover:text-fg">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col-reverse items-start justify-between gap-4 border-t border-line pt-6 sm:flex-row sm:items-center">
          <p className="text-[13px] text-faint">{footer.legal}</p>
          <p className="text-[12px] text-faint">Agents run inside your workspace. You decide what they may touch.</p>
        </div>
      </Container>
    </footer>
  )
}
