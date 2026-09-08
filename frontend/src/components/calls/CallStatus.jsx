import { CircleCheck, LoaderCircle } from "lucide-react";
import { StatusBadge } from "../common/StatusBadge";
import { formatDate } from "../../utils/formatDate";
import { activeCallStatuses, readableStatus } from "../../utils/status";

export function CallStatus({ call }) {
  if (!call) return null;
  const active = activeCallStatuses.includes(call.status);
  return (
    <section
      className="rounded-xl border border-brand-100 bg-brand-50 p-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-brand-700">
          {active ? (
            <LoaderCircle
              className="animate-spin"
              size={19}
              aria-hidden="true"
            />
          ) : (
            <CircleCheck size={19} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">
              {active
                ? "Call status updates automatically"
                : "Call request updated"}
            </p>
            <StatusBadge status={call.status} />
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {call.phoneNumber} · {readableStatus(call.status)}
            {call.createdAt ? ` · ${formatDate(call.createdAt)}` : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
