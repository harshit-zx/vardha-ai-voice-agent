export function Card({ className = "", children, ...props }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`} {...props}>
      {children}
    </section>
  );
}
