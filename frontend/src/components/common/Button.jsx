const variants = {
  primary:
    "border-brand-600 bg-brand-600 text-white hover:border-brand-700 hover:bg-brand-700 focus-visible:outline-brand-600",
  secondary:
    "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-brand-600",
  danger:
    "border-red-600 bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600",
  ghost:
    "border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-brand-600",
};

export function Button({
  as: Component = "button",
  className = "",
  variant = "primary",
  type = "button",
  children,
  ...props
}) {
  return (
    <Component
      {...(Component === "button" ? { type } : {})}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm
        font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2
        focus-visible:outline-offset-2 
        ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
