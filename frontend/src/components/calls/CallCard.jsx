import { Headphones, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../common/StatusBadge";
import { formatDate } from "../../utils/formatDate";
import { formatDuration } from "../../utils/formatDuration";

export function CallCard({ call }) {
  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{call.phoneNumber}</p><p className="mt-1 text-xs text-slate-500">{formatDate(call.createdAt)}</p></div><StatusBadge status={call.status} /></div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs font-medium text-slate-500">Duration</dt><dd className="mt-1 font-medium text-slate-700">{formatDuration(call.duration)}</dd></div><div><dt className="text-xs font-medium text-slate-500">Recording</dt><dd className="mt-1 flex items-center gap-1 font-medium text-slate-700">{call.recordingUrl ? <><Headphones size={14} aria-hidden="true" />Available</> : "Not available"}</dd></div></dl>
      <Link to={`/calls/${call._id}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">View details <ArrowRight size={16} aria-hidden="true" /></Link>
    </article>
  );
}
