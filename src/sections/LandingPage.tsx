import { useEffect, useRef, useState, type FormEvent } from 'react'

import { navigate } from '../lib/router'
import '../landing.css'

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m4 12.5 5 5L20 6.5" />
  </svg>
)

const features = [
  {
    title: 'Deep reasoning',
    body: 'Multi-step planning with Z.ai and switchable providers. Your agent decides, adapts and explains itself.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a4 4 0 0 0-4 4v1a3 3 0 0 0 0 6v1a4 4 0 0 0 8 0v-1a3 3 0 0 0 0-6V7a4 4 0 0 0-4-4Z" />
        <path d="M12 3v18" />
      </svg>
    ),
  },
  {
    title: 'Research & scraping',
    body: 'High-recall web research, clean content extraction and structured data from any public page.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </svg>
    ),
  },
  {
    title: 'Browser automation',
    body: 'Navigate, fill forms, click and submit with Playwright, Stagehand and Browser-Use inside the tool layer.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
        <path d="M8 21h8M12 17v4" />
        <path d="m7.5 10 2.5 2.5L13 9l3.5 3.5" />
      </svg>
    ),
  },
  {
    title: 'Voice conversations',
    body: 'Natural speech-to-text and text-to-speech with Sagale.ai — in the browser and on Telegram.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="2.5" width="6" height="11" rx="3" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
      </svg>
    ),
  },
  {
    title: 'Connected tools',
    body: 'Gmail, Telegram, Calendar, Sheets and more through Composio — with fine-grained permissions.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 7H6a3 3 0 0 0 0 6h3M15 17h3a3 3 0 0 0 0-6h-3" />
        <path d="M8 12h8" />
      </svg>
    ),
  },
  {
    title: 'Private knowledge',
    body: "Upload catalogues, policies and price lists. Each agent answers from your data — never someone else's.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z" />
        <path d="M4 8h16M8 12h7M8 16h5" />
      </svg>
    ),
  },
]

const steps = [
  { n: '01', title: 'Describe', body: 'Say what the agent should do, in ordinary language. It becomes a structured configuration.' },
  { n: '02', title: 'Configure', body: 'Review its instructions, name and responsibilities. Adjust anything in plain English.' },
  { n: '03', title: 'Connect', body: 'Pick the tools and documents it may use. Permissions stay scoped to one agent.' },
  { n: '04', title: 'Deploy', body: 'Test in chat, then launch it to your website, Telegram, or internal workspace.' },
]

const plans = [
  {
    name: 'Free',
    price: '0',
    desc: 'For trying the platform and building your first agent.',
    items: ['1 agent', 'Chat & conversation history', 'Core web research'],
    featured: false,
    cta: 'Get started',
  },
  {
    name: 'Professional',
    price: '1,500',
    desc: 'For professionals running agents every day.',
    items: ['10 agents', 'Browser automation & form filling', 'Knowledge base uploads', 'Voice & Telegram deployment'],
    featured: true,
    cta: 'Start with Professional',
  },
  {
    name: 'Business',
    price: '5,000',
    desc: 'For teams that run agents across departments.',
    items: ['30 agents', 'Priority execution', 'Advanced integrations', 'Shared team workspace'],
    featured: false,
    cta: 'Talk to sales',
  },
]

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const els = Array.from(root.querySelectorAll<HTMLElement>('.lp-reveal'))
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            io.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!authOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAuthOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [authOpen])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    window.setTimeout(() => {
      setSubmitting(false)
      setAuthOpen(false)
      navigate('/login')
    }, 500)
  }

  return (
    <div className="lp-root" ref={rootRef}>
      <header className="lp-header">
        <div className="lp-wrap">
          <nav className="lp-nav">
            <a className="lp-brand" href="#top">
              <span className="lp-mark">L</span>{' '}
              <b>
                Lu<span>mo</span>
              </b>
            </a>
            <div className="lp-nav-links">
              <a href="#platform">Platform</a>
              <a href="#how">How it works</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div className="lp-nav-cta">
              <a href="#pricing" className="lp-btn lp-btn-ghost lp-btn-sm">
                View plans
              </a>
              <button type="button" className="lp-btn lp-btn-gold lp-btn-sm" onClick={() => setAuthOpen(true)}>
                Sign in
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="lp-hero">
          <div className="lp-wrap">
            <div className="lp-badge">
              <span className="lp-pulse" /> The professional AI agent platform
            </div>
            <h1 className="lp-h1">
              Agents that think,
              <br />
              <span className="lp-shine">and actually do the work.</span>
            </h1>
            <p className="lp-lede">
              Describe the agent you need. Lumo writes its playbook, connects your tools, learns your documents, and
              executes real work across the web — reliably and securely.
            </p>
            <div className="lp-hero-actions">
              <button type="button" className="lp-btn lp-btn-gold" onClick={() => setAuthOpen(true)}>
                Start building free
                <Arrow />
              </button>
              <a href="#platform" className="lp-btn lp-btn-ghost">
                Explore the platform
              </a>
            </div>
            <p className="lp-micro">No credit card required · Free plan · Enterprise-ready isolation</p>

            <div className="lp-demo">
              <div className="lp-demo-shell">
                <div className="lp-demo-inner">
                  <div className="lp-demo-bar">
                    <i /> <i /> <i />
                    <span className="lp-title">Lumo Agent — Live</span>
                  </div>
                  <div className="lp-demo-body">
                    <div className="lp-msg lp-msg-user">Compare our top three competitors' pricing and draft a one-page brief.</div>
                    <div className="lp-msg lp-msg-bot">
                      <div className="lp-chips">
                        <span className="lp-chip">🌐 Browse</span>
                        <span className="lp-chip">🔎 Search</span>
                        <span className="lp-chip">📄 Extract</span>
                      </div>
                      Scanning their pricing pages and product docs now. I'll structure the comparison and flag every
                      change since last month.
                    </div>
                    <div className="lp-msg lp-msg-bot">
                      <span className="lp-typing">
                        <i /> <i /> <i />
                      </span>
                    </div>
                  </div>
                  <div className="lp-composer">
                    <span className="lp-field">Ask Lumo to do something…</span>
                    <span className="lp-send" aria-hidden="true">
                      <Arrow />
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lp-trust">
              <div>
                <strong>Z.ai · OpenAI</strong>
                <small>Switchable models</small>
              </div>
              <div>
                <strong>Per-agent scopes</strong>
                <small>Tool permissions</small>
              </div>
              <div>
                <strong>Private knowledge</strong>
                <small>Isolated memory</small>
              </div>
              <div>
                <strong>Web · Voice</strong>
                <small>Deployment channels</small>
              </div>
            </div>
          </div>
        </section>

        <div className="lp-divider" />

        <section className="lp-section" id="platform">
          <div className="lp-wrap">
            <div className="lp-head lp-reveal">
              <span className="lp-eyebrow">The platform</span>
              <h2 className="lp-h2">One engine. Any agent you can imagine.</h2>
              <p>Every agent draws on the same secure execution core — its own instructions, memory, knowledge and permissions.</p>
            </div>
            <div className="lp-grid-3">
              {features.map((feature) => (
                <article className="lp-card lp-reveal" key={feature.title}>
                  <div className="lp-ico">{feature.icon}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="lp-divider" />

        <section className="lp-section" id="how">
          <div className="lp-wrap">
            <div className="lp-head lp-reveal">
              <span className="lp-eyebrow">How it works</span>
              <h2 className="lp-h2">From a sentence to a deployed agent.</h2>
              <p>No prompt engineering, no technical setup. The builder does the translation.</p>
            </div>
            <div className="lp-steps">
              {steps.map((step) => (
                <div className="lp-step lp-reveal" key={step.n}>
                  <div className="lp-n">{step.n}</div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="lp-divider" />

        <section className="lp-section" id="pricing">
          <div className="lp-wrap">
            <div className="lp-head lp-reveal">
              <span className="lp-eyebrow">Pricing</span>
              <h2 className="lp-h2">Straightforward plans. No surprises.</h2>
              <p>Start free. Upgrade when your agents start earning their keep.</p>
            </div>
            <div className="lp-plans">
              {plans.map((plan) => (
                <article className={`lp-plan lp-reveal${plan.featured ? ' lp-plan-top' : ''}`} key={plan.name}>
                  {plan.featured ? <span className="lp-tag">Most popular</span> : null}
                  <h3>{plan.name}</h3>
                  <div className="lp-price">
                    <strong>{plan.price}</strong>
                    <span>ETB / month</span>
                  </div>
                  <p className="lp-desc">{plan.desc}</p>
                  <ul className="lp-list">
                    {plan.items.map((item) => (
                      <li key={item}>
                        <Check />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <button type="button" className={`lp-btn ${plan.featured ? 'lp-btn-gold' : 'lp-btn-ghost'}`} onClick={() => setAuthOpen(true)}>
                    {plan.cta}
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-wrap">
            <div className="lp-cta lp-reveal">
              <span className="lp-eyebrow">Get started</span>
              <h2 className="lp-h2">Your first agent is minutes away.</h2>
              <p>Describe the work. Lumo handles the configuration, the tools and the execution.</p>
              <div className="lp-cta-actions">
                <button type="button" className="lp-btn lp-btn-gold" onClick={() => setAuthOpen(true)}>
                  Create your account
                  <Arrow />
                </button>
                <a href="#pricing" className="lp-btn lp-btn-ghost">
                  Compare plans
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <div className="lp-foot">
            <a className="lp-brand" href="#top">
              <span className="lp-mark">L</span>{' '}
              <b>
                Lu<span>mo</span>
              </b>
            </a>
            <div className="lp-foot-links">
              <a href="#platform">Platform</a>
              <a href="#how">How it works</a>
              <a href="#pricing">Pricing</a>
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
            </div>
          </div>
          <div className="lp-copy">
            <span>© {new Date().getFullYear()} Lumo. All rights reserved.</span>
            <span>Built for teams who'd rather ship than prompt.</span>
          </div>
        </div>
      </footer>

      <div className={`lp-modal${authOpen ? ' is-open' : ''}`} role="dialog" aria-modal="true" aria-label="Sign in" aria-hidden={!authOpen}>
        <button type="button" className="lp-scrim" aria-label="Close sign in" onClick={() => setAuthOpen(false)} />
        <div className="lp-modal-card">
          <button type="button" className="lp-modal-close" aria-label="Close sign in" onClick={() => setAuthOpen(false)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <h2>Welcome back</h2>
          <p className="lp-sub">Sign in to your Lumo workspace.</p>

          <form onSubmit={handleSubmit}>
            <div className="lp-field-group">
              <label htmlFor="lp-email">Email address</label>
              <div className="lp-input-wrap">
                <svg className="lp-lead-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2.5" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
                <input id="lp-email" name="email" type="email" placeholder="you@company.com" autoComplete="email" required />
              </div>
            </div>

            <div className="lp-field-group">
              <label htmlFor="lp-password">Password</label>
              <div className="lp-input-wrap">
                <svg className="lp-lead-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
                  <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
                  <path d="M12 14.5v2.5" />
                </svg>
                <input
                  id="lp-password"
                  name="password"
                  className="lp-has-eye"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="lp-eye"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 6.1A9.9 9.9 0 0 1 12 6c6.2 0 9.8 6 9.8 6a17 17 0 0 1-3.2 3.9M6.6 6.9A17.2 17.2 0 0 0 2.2 12S5.8 18 12 18a9.7 9.7 0 0 0 3.6-.7" />
                      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.2 12S5.8 5.5 12 5.5 21.8 12 21.8 12 18.2 18.5 12 18.5 2.2 12 2.2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="lp-form-meta">
              <label className="lp-remember">
                <input type="checkbox" name="remember" /> Remember me
              </label>
              <a href="/login">Forgot password?</a>
            </div>

            <button type="submit" className="lp-btn lp-btn-gold" disabled={submitting}>
              {submitting ? 'Opening sign in…' : 'Sign in'}
            </button>
          </form>

          <p className="lp-modal-foot">
            New to Lumo? <a href="/signup">Create an account</a>
          </p>
        </div>
      </div>
    </div>
  )
}
