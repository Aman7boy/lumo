import { motion } from 'motion/react'
import { ArrowUp, Check, Plus, ShieldCheck, Sparkles } from 'lucide-react'

import { LogoMark } from './Logo'
import { cx } from '../lib/cx'

const agents = [
  { name: 'Atlas', role: 'Supplier and market desk', hue: 24, active: true },
  { name: 'Scout', role: 'Competitor research', hue: 145 },
  { name: 'Vera', role: 'Executive assistant', hue: 275 },
]

const chips = ['Business agent', 'Web search', 'Gmail drafts', 'Sheets', 'Approval required']

export function StudioMock() {
  return (
    <div className="depth relative flex aspect-[16/10] w-full overflow-hidden rounded-window bg-surface text-left shadow-glow sm:aspect-[16/9]">
      <aside className="hidden w-[188px] shrink-0 flex-col border-r border-line bg-bg/60 p-3 sm:flex">
        <div className="flex items-center gap-2 px-1.5 py-1">
          <LogoMark className="size-6 rounded-[8px]" />
          <span className="text-[12px] font-semibold">Selam Packaging</span>
        </div>
        <div className="mt-3 flex h-7 items-center gap-1.5 rounded-[9px] bg-white/[0.05] px-2 text-[11px] text-muted">
          <Plus className="size-3" /> New agent
        </div>
        <p className="mt-4 px-1.5 text-[10px] uppercase tracking-wide text-faint">Agents</p>
        <ul className="mt-1.5 flex flex-col gap-1">
          {agents.map((agent, i) => (
            <motion.li
              key={agent.name}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + i * 0.12, duration: 0.4 }}
              className={cx(
                'flex items-center gap-2 rounded-[10px] p-1.5',
                agent.active ? 'bg-white/[0.07]' : 'text-muted',
              )}
            >
              <span
                className="round grid size-5 shrink-0 place-items-center text-[9px] font-semibold text-black/70"
                style={{ background: `linear-gradient(135deg, hsl(${agent.hue} 80% 66%), hsl(${agent.hue + 30} 72% 52%))` }}
              >
                {agent.name[0]}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-medium text-fg/90">{agent.name}</span>
                <span className="block truncate text-[9.5px] text-faint">{agent.role}</span>
              </span>
            </motion.li>
          ))}
        </ul>
        <div className="mt-auto rounded-[10px] border border-line p-2">
          <p className="text-[10px] font-medium text-fg/80">Professional</p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full w-[30%] rounded-full bg-accent" />
          </div>
          <p className="mt-1 text-[9.5px] text-faint">3 of 10 agents</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            <span className="text-[12px] font-medium">Atlas</span>
            <span className="rounded-[6px] bg-emerald-400/10 px-1.5 py-0.5 text-[9.5px] text-emerald-300">Deployed</span>
          </div>
          <span className="hidden text-[10px] text-faint sm:inline">private workspace · Selam Packaging</span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="depth relative rounded-[14px] bg-white/[0.02] p-3"
          >
            <div className="flex items-center gap-1.5 text-[10px] text-accent">
              <Sparkles className="size-3" /> Builder analysis
              <span className="ml-auto rounded-[5px] bg-accent/10 px-1.5 py-0.5 text-[9px] text-accent">92% match</span>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-fg/85 sm:text-[12px]">
              “I need an agent that researches competitors, checks product prices, emails suppliers, drafts quotations and
              reports market changes.”
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1">
              {chips.map((chip) => (
                <span key={chip} className="rounded-[6px] bg-white/[0.06] px-2 py-0.5 text-[9px] text-muted">
                  {chip}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="depth relative flex min-h-0 flex-1 flex-col rounded-[14px] bg-bg/40 p-3"
          >
            <div className="flex items-center gap-2">
              <span className="round grid size-5 place-items-center bg-gradient-to-br from-[#ffb06b] to-[#ff7a45] text-[9px] font-semibold text-black/70">
                A
              </span>
              <span className="text-[12px] font-medium">Atlas</span>
              <span className="text-[9.5px] text-faint">grounded in 4 documents</span>
            </div>

            <div className="mt-2.5 max-w-[92%] rounded-[10px] rounded-tl-[4px] bg-white/[0.05] p-2.5 text-[10.5px] leading-relaxed text-fg/85">
              <p className="font-medium text-fg">Quote basis — P-28 preforms</p>
              <p className="mt-1 text-muted">
                11.40 ETB per unit from the 2026 catalogue. At 12,000 units the 5% volume band applies.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-[8px] bg-black/20 p-2 text-[9.5px]">
                <span className="text-faint">List price</span>
                <span className="text-right tabular-nums">136,800.00 ETB</span>
                <span className="text-faint">Discount 5%</span>
                <span className="text-right tabular-nums text-emerald-300">−6,840.00</span>
                <span className="text-faint">VAT 15%</span>
                <span className="text-right tabular-nums">19,494.00</span>
                <span className="font-medium text-fg/80">Total</span>
                <span className="text-right font-medium tabular-nums text-fg">149,454.00 ETB</span>
              </div>
              <p className="mt-2 flex items-center gap-1 text-[9.5px] text-faint">
                <ShieldCheck className="size-3 text-accent-2" /> Draft in Tasks — waiting for your approval
              </p>
            </div>

            <div className="mt-auto flex items-center gap-2 rounded-[10px] border border-line bg-surface px-2.5 py-1.5">
              <span className="text-[10px] text-faint">Ask Atlas for a quote, a supplier email or a market brief…</span>
              <span className="ml-auto grid size-6 place-items-center rounded-[7px] bg-fg text-bg">
                <ArrowUp className="size-3.5" />
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.6 }}
            className="hidden items-center gap-2 text-[9.5px] text-faint sm:flex"
          >
            <Check className="size-3 text-emerald-400" /> 4 knowledge passages cited
            <span className="size-1 rounded-full bg-white/20" />
            <Check className="size-3 text-emerald-400" /> Gmail connected
            <span className="size-1 rounded-full bg-white/20" />
            <span>Approval before send</span>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
