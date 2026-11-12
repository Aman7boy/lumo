import { useId } from 'react'

import { cx } from '../lib/cx'
import { brand } from '../content'

export function LogoMark({ className }: { className?: string }) {
  // A gradient id must be unique per instance: several logos can be mounted at
  // once (sidebar, top bar, footer), and duplicate ids make the stroke resolve
  // to the wrong paint server.
  const gradientId = `logo-g-${useId().replace(/:/g, '')}`

  return (
    <span
      aria-hidden
      className={cx(
        'depth relative grid size-8 shrink-0 place-items-center rounded-[11px] bg-gradient-to-br from-surface-2 to-raised',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke={`url(#${gradientId})`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff9a6b" />
            <stop offset="1" stopColor="#ffc46b" />
          </linearGradient>
        </defs>
        <path d="M8.5 5.5v13H17" />
      </svg>
    </span>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <a href="/" className={cx('inline-flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-fg', className)}>
      <LogoMark />
      {brand.name}
    </a>
  )
}
