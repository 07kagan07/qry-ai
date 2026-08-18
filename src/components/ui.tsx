import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const styles = {
    primary: 'bg-cobalt text-white hover:bg-cobalt-deep active:bg-cobalt-deep disabled:bg-cobalt/40',
    secondary:
      'bg-surface border border-line text-ink hover:border-cobalt hover:text-cobalt active:bg-cobalt-soft',
    danger: 'bg-coral text-white hover:bg-coral-deep active:bg-coral-deep',
    ghost: 'text-ink-soft hover:bg-cobalt-soft hover:text-cobalt-deep active:bg-cobalt-soft',
  }[variant]
  return (
    <button
      className={`min-h-11 touch-manipulation rounded-lg px-4 py-2 text-sm font-semibold transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${styles} ${className}`}
      {...props}
    />
  )
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft ${className}`}
      {...props}
    />
  )
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft ${className}`}
      {...props}
    />
  )
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft ${className}`}
      {...props}
    />
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-ink">{children}</label>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-surface p-5 ${className}`}>
      {children}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-ink-soft">
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-line border-t-cobalt" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="mt-2 text-sm text-coral-deep">
      {children}
    </p>
  )
}
