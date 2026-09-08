import { BookOpen, History, LayoutDashboard, PhoneCall, X } from "lucide-react";
import { NavLink } from "react-router-dom";

const navigation = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calls/new", label: "New Call", icon: PhoneCall },
  { to: "/calls", label: "Call History", icon: History },
  { to: "/knowledge-base", label: "Knowledge Base", icon: BookOpen },
];

export function Sidebar({ mobile = false, onNavigate, onClose }) {
  return (
    <aside
      className={
        mobile
          ? "flex h-full w-72 flex-col bg-slate-950 p-4 text-slate-300"
          : "hidden w-64 shrink-0 flex-col bg-slate-950 p-4 text-slate-300 lg:flex"
      }
    >
      <div className="flex items-center justify-between px-2 py-3">
        <NavLink
          to="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3 text-white"
        >
          <span className="grid size-9 place-items-center rounded-lg bg-white text-base font-black text-slate-950">
            V
          </span>
          <span>
            <strong className="block text-sm">Vardha AI</strong>
            <small className="block text-xs text-slate-400">Voice Agent</small>
          </span>
        </NavLink>
        {mobile && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="rounded-md p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="mt-7 grid gap-1" aria-label="Primary navigation">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-white"}`
            }
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto rounded-lg border border-slate-800 bg-slate-900/70 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <span className="size-2 rounded-full bg-emerald-400" />
          Ready to connect
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          Calls use your configured Exotel flow and knowledge base.
        </p>
      </div>
    </aside>
  );
}
