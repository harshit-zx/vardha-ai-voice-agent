export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold tracking-widest text-brand-700">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}
