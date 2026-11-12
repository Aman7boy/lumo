import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Check, Loader2, Plus, X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

import { cx } from '../lib/cx'

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('depth relative rounded-card-sm bg-surface', className)}>{children}</div>
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex items-start justify-between gap-4 border-b border-line px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-white/[0.06] text-muted',
  accent: 'bg-accent/12 text-accent',
  success: 'bg-emerald-400/10 text-emerald-300',
  warning: 'bg-amber-400/10 text-amber-300',
  danger: 'bg-rose-400/10 text-rose-300',
  info: 'bg-sky-400/10 text-sky-300',
}

export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[10.5px] font-medium leading-tight', toneClasses[tone], className)}>{children}</span>
}

export function Dot({ tone = 'success' }: { tone?: 'success' | 'warning' | 'neutral' | 'danger' }) {
  return (
    <span
      className={cx(
        'size-1.5 shrink-0 rounded-full',
        tone === 'success' && 'bg-emerald-400',
        tone === 'warning' && 'bg-amber-400',
        tone === 'neutral' && 'bg-white/30',
        tone === 'danger' && 'bg-rose-400',
      )}
    />
  )
}

export function StatCard({ label, value, detail, className }: { label: string; value: ReactNode; detail?: ReactNode; className?: string }) {
  return (
    <div className={cx('depth relative rounded-[14px] bg-surface px-4 py-3.5', className)}>
      <p className="text-[11px] uppercase tracking-[0.08em] text-faint">{label}</p>
      <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{value}</p>
      {detail && <p className="mt-1.5 text-[11.5px] leading-snug text-muted">{detail}</p>}
    </div>
  )
}

export function AgentAvatar({ name, color = '#ff7a45', size = 'md' }: { name: string; color?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'size-7 text-[11px] rounded-[9px]', md: 'size-9 text-[13px] rounded-[11px]', lg: 'size-12 text-[16px] rounded-[15px]' }
  return (
    <span
      className={cx('grid shrink-0 place-items-center font-semibold text-black/75', sizes[size])}
      style={{ background: `linear-gradient(135deg, ${color}, ${color}aa)` }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

export const controlClass =
  'w-full rounded-[11px] border border-line-strong bg-bg/50 px-3 py-2 text-[13px] text-fg outline-none transition-colors placeholder:text-faint focus:border-accent/60 focus:bg-bg/80 disabled:opacity-50'

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[12px] font-medium text-fg/85">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] leading-snug text-faint">{hint}</p>}
      {error && <p className="text-[11px] leading-snug text-rose-300">{error}</p>}
    </div>
  )
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(controlClass, className)} {...props} />
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(controlClass, 'resize-y leading-relaxed', className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(controlClass, 'appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 fill=%27none%27 stroke=%27%23a89e97%27 stroke-width=%271.5%27><path d=%27M2 4l4 4 4-4%27/></svg>")] bg-[right_0.75rem_center] bg-no-repeat pr-8', className)} {...props}>
      {children}
    </select>
  )
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-4 text-left disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{description}</span>}
      </span>
      <span className={cx('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-white/[0.12]')}>
        <span className={cx('absolute top-0.5 size-4 rounded-full bg-white transition-[left]', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  )
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: { label: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'grid size-8 shrink-0 place-items-center rounded-[9px] text-muted transition-colors hover:bg-white/[0.06] hover:text-fg disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Tabs, modal, feedback
// ---------------------------------------------------------------------------

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Array<{ key: T; label: string; count?: number }>
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cx('scrollbar-none flex gap-1 overflow-x-auto', className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={value === tab.key}
          onClick={() => onChange(tab.key)}
          className={cx(
            'relative shrink-0 rounded-[9px] px-2.5 py-1.5 text-[12.5px] transition-colors',
            value === tab.key ? 'bg-white/[0.08] text-fg' : 'text-muted hover:bg-white/[0.04] hover:text-fg',
          )}
        >
          {tab.label}
          {tab.count !== undefined && <span className="ml-1.5 text-[10px] text-faint">{tab.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg'
}) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
            className={cx(
              'depth relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-card bg-surface shadow-glow',
              width === 'sm' && 'sm:max-w-sm',
              width === 'md' && 'sm:max-w-lg',
              width === 'lg' && 'sm:max-w-2xl',
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <h2 id={titleId} className="text-[15px] font-semibold tracking-tight">
                  {title}
                </h2>
                {description && <p className="mt-1 text-[12.5px] leading-snug text-muted">{description}</p>}
              </div>
              <IconButton label="Close" onClick={onClose}>
                <X className="size-4" />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-bg/30 px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex flex-col items-center justify-center rounded-card-sm border border-dashed border-line px-6 py-12 text-center', className)}>
      {icon && <div className="mb-3 grid size-10 place-items-center rounded-[12px] bg-white/[0.05] text-accent">{icon}</div>}
      <p className="text-[14px] font-medium">{title}</p>
      {description && <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-4 animate-spin text-muted', className)} />
}

export function LoadingBlock({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted">
      <Spinner /> {label}…
    </div>
  )
}

export function Progress({ value, max, className }: { value: number; max: number; className?: string }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]', className)}>
      <div className={cx('h-full rounded-full transition-all', percent >= 100 ? 'bg-amber-400' : 'bg-accent')} style={{ width: `${percent}%` }} />
    </div>
  )
}

export function Chip({ children, onRemove, className }: { children: ReactNode; onRemove?: () => void; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-[7px] bg-white/[0.06] px-2 py-1 text-[11.5px] text-fg/85', className)}>
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Remove" className="text-faint transition-colors hover:text-fg">
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}

export function AddChip({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-[7px] border border-dashed border-line-strong px-2 py-1 text-[11.5px] text-muted transition-colors hover:border-accent/40 hover:text-fg"
    >
      <Plus className="size-3" /> {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

interface ToastItem {
  id: number
  message: string
  tone: 'success' | 'error' | 'info'
}

const ToastContext = createContext<{ push: (message: string, tone?: ToastItem['tone']) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((message: string, tone: ToastItem['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setItems((current) => [...current.slice(-2), { id, message, tone }])
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4200)
  }, [])

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col gap-2">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="depth relative flex items-center gap-2 rounded-[12px] bg-surface px-3 py-2.5 text-[12.5px] shadow-glow"
            >
              <span className={cx('grid size-5 shrink-0 place-items-center rounded-full', toneClasses[item.tone === 'success' ? 'success' : item.tone === 'error' ? 'danger' : 'info'])}>
                {item.tone === 'error' ? <AlertTriangle className="size-3" /> : <Check className="size-3" />}
              </span>
              <span className="text-fg/90">{item.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) return { push: () => undefined }
  return value
}
