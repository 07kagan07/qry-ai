import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const styles = {
    primary: 'bg-cobalt text-white hover:bg-cobalt-deep disabled:bg-cobalt/40',
    secondary: 'bg-surface border border-line text-ink hover:border-cobalt hover:text-cobalt',
    danger: 'bg-coral text-white hover:bg-coral-deep',
    ghost: 'text-ink-soft hover:bg-cobalt-soft hover:text-cobalt-deep',
  }[variant]
  return (
    <button
      className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  )
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal-soft ${className}`}
      {...props}
    />
  )
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal-soft ${className}`}
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
  return <p className="mt-2 text-sm text-coral-deep">{children}</p>
}
