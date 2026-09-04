import { readableStatus } from "../../utils/status";

const statusStyles = {
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  queued: "bg-blue-50 text-blue-700 ring-blue-600/20",
  created: "bg-slate-100 text-slate-700 ring-slate-600/20",
  ringing: "bg-amber-50 text-amber-700 ring-amber-600/20",
  answered: "bg-amber-50 text-amber-700 ring-amber-600/20",
  "in-progress": "bg-amber-50 text-amber-700 ring-amber-600/20",
  failed: "bg-red-50 text-red-700 ring-red-600/20",
  busy: "bg-red-50 text-red-700 ring-red-600/20",
  "no-answer": "bg-red-50 text-red-700 ring-red-600/20",
  unknown: "bg-slate-100 text-slate-700 ring-slate-600/20",
};

export function StatusBadge({ status }) {
  const normalized = String(status || "unknown").toLowerCase();
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[normalized] || statusStyles.unknown}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {readableStatus(normalized)}
    </span>
  );
}
