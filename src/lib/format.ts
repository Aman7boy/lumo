const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function relativeTime(timestamp: number): string {
  const diff = timestamp - Date.now()
  const minutes = Math.round(diff / 60_000)
  if (Math.abs(minutes) < 1) return 'just now'
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return rtf.format(days, 'day')
  return rtf.format(Math.round(days / 30), 'month')
}

export function formatDate(timestamp: number, withTime = false): string {
  return new Date(timestamp).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export function formatShortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

export function formatEtb(value: number): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function greeting(): string {
  return greeting2()
}

function greeting2() {
  const hour = new Date().getHours()
  if (hour < 5) return 'Working late'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
