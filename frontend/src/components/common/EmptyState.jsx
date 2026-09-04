import { Inbox } from "lucide-react";

export function EmptyState({ title, description, action, icon: Icon = Inbox, className = "" }) {
  return (
    <div className={`flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center ${className}`}>
      <span className="mb-3 grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><Icon size={20} aria-hidden="true" /></span>
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {description && <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
