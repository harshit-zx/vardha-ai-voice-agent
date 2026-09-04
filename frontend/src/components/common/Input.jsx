export function Input({ className = "", label, hint, error, id, as: Component = "input", ...props }) {
  const inputId = id || props.name;
  return (
    <div className="grid gap-1.5">
      {label && <label htmlFor={inputId} className="text-sm font-medium text-slate-700">{label}</label>}
      <Component
        id={inputId}
        className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs outline-none placeholder:text-slate-400 focus:border-brand-600 focus:ring-3 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 ${Component === "textarea" ? "min-h-28 resize-y" : "min-h-10"} ${error ? "border-red-500 focus:border-red-600 focus:ring-red-100" : ""} ${className}`}
        {...props}
      />
      {(error || hint) && <p className={`text-xs ${error ? "text-red-600" : "text-slate-500"}`}>{error || hint}</p>}
    </div>
  );
}
