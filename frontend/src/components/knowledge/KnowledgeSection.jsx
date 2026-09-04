export function KnowledgeSection({ title, description, children, className = "" }) {
  return (
    <section className={`border-b border-slate-200 px-5 py-5 last:border-b-0 sm:px-6 ${className}`}>
      <div className="mb-4"><h2 className="text-base font-semibold text-slate-900">{title}</h2>{description && <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>}</div>
      {children}
    </section>
  );
}
