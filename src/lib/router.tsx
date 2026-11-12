// A tiny history router. The Worker serves index.html for every path (SPA
// mode), so client-side routes need no server changes.

import { useEffect, useSyncExternalStore, type AnchorHTMLAttributes, type ReactNode } from 'react'

let current = window.location.pathname + window.location.search
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function read() {
  current = window.location.pathname + window.location.search
  return current
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    read()
    emit()
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLocation(): string {
  return useSyncExternalStore(subscribe, () => current, () => current)
}

export function navigate(to: string, options: { replace?: boolean } = {}) {
  if (to === window.location.pathname + window.location.search) return
  if (options.replace) window.history.replaceState(null, '', to)
  else window.history.pushState(null, '', to)
  read()
  emit()
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
}

export function useNavigation() {
  const location = useLocation()
  const [pathname, search = ''] = location.split('?')
  return { pathname, search, query: new URLSearchParams(search) }
}

export function Link({
  href,
  children,
  onClick,
  ...rest
}: { href: string; children: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
        if (!href.startsWith('/')) return
        event.preventDefault()
        navigate(href)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}

// Focus management for route changes: keep the page title in the tab and move
// focus to the main region so keyboard users do not restart at the sidebar.
export function useRouteFocus(dependency: string) {
  useEffect(() => {
    const main = document.getElementById('app-main')
    if (main) main.focus({ preventScroll: true })
  }, [dependency])
}
