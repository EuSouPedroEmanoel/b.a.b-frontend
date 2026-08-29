export function Badge({ children, tone = 'neutral', className = '' }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; className?: string }) {
  const tones: Record<string, string> = {
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    success: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200',
    warning: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200',
    danger: 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200',
    info: 'bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200',
  }
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tones[tone]} ${className}`}>{children}</span>
}
