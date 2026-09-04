import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { CallTable } from "../components/calls/CallTable";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { ErrorState } from "../components/common/ErrorState";
import { Input } from "../components/common/Input";
import { Loading } from "../components/common/Loading";
import { PageHeader } from "../components/common/PageHeader";
import { useCalls } from "../hooks/useCalls";

export function CallHistory() {
  const { calls, loading, error, refresh } = useCalls();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const filteredCalls = useMemo(
    () => calls.filter((call) => call.phoneNumber?.includes(search.trim()) && (status === "all" || call.status === status)),
    [calls, search, status]
  );

  return (
    <>
      <PageHeader
        eyebrow="CALLS"
        title="Call history"
        description="Review statuses, recordings, transcripts, and summaries for every outbound call."
        actions={<Button variant="secondary" onClick={() => refresh().catch(() => undefined)}><RefreshCw size={16} aria-hidden="true" />Refresh</Button>}
      />
      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <Input id="call-search" label="Search phone number" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="+91…" />
          <div className="grid gap-1.5">
            <label htmlFor="call-status" className="text-sm font-medium text-slate-700">Filter by status</label>
            <select id="call-status" value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-600 focus:ring-3 focus:ring-brand-100">
              <option value="all">All statuses</option><option value="created">Created</option><option value="queued">Queued</option><option value="ringing">Ringing</option><option value="in-progress">In progress</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="busy">Busy</option><option value="no-answer">No answer</option>
            </select>
          </div>
        </div>
        {loading ? <Loading label="Loading call history…" /> : error ? <ErrorState message={error} onRetry={() => refresh().catch(() => undefined)} /> : <CallTable calls={filteredCalls} emptyTitle={calls.length ? "No matching calls" : "No calls yet"} emptyDescription={calls.length ? "Try a different number or status filter." : "Start a new outbound call to see it here."} />}
      </Card>
    </>
  );
}
