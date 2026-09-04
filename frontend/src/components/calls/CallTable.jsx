import { ArrowRight, Headphones } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../common/EmptyState";
import { StatusBadge } from "../common/StatusBadge";
import { formatDate } from "../../utils/formatDate";
import { formatDuration } from "../../utils/formatDuration";
import { CallCard } from "./CallCard";

export function CallTable({ calls, emptyTitle = "No calls yet", emptyDescription = "Start an outbound call to see activity here." }) {
  if (!calls.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Phone number</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Duration</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Recording</th><th className="px-5 py-3"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y divide-slate-200">
            {calls.map((call) => <tr key={call._id} className="hover:bg-slate-50"><td className="px-5 py-4"><p className="font-semibold text-slate-800">{call.phoneNumber}</p><p className="mt-1 text-xs capitalize text-slate-500">{call.direction || "outbound"}</p></td><td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDate(call.createdAt)}</td><td className="whitespace-nowrap px-5 py-4 font-medium text-slate-700">{formatDuration(call.duration)}</td><td className="whitespace-nowrap px-5 py-4"><StatusBadge status={call.status} /></td><td className="whitespace-nowrap px-5 py-4 text-slate-600">{call.recordingUrl ? <span className="inline-flex items-center gap-1"><Headphones size={15} aria-hidden="true" />Available</span> : "Not available"}</td><td className="whitespace-nowrap px-5 py-4"><Link to={`/calls/${call._id}`} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">View details <ArrowRight size={15} aria-hidden="true" /></Link></td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 p-4 md:hidden">{calls.map((call) => <CallCard key={call._id} call={call} />)}</div>
    </>
  );
}
