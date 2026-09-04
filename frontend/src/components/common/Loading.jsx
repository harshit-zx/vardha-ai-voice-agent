export function Loading({ label = "Loading…", className = "" }) {
  return (
    <div className={`flex min-h-40 items-center justify-center gap-3 text-sm text-slate-500 ${className}`} role="status" aria-live="polite">
      <span className="size-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
