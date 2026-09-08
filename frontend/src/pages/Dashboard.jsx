import { CheckCircle2, PhoneOff, PhoneOutgoing, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { CallTable } from "../components/calls/CallTable";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { ErrorState } from "../components/common/ErrorState";
import { Loading } from "../components/common/Loading";
import { PageHeader } from "../components/common/PageHeader";
import { useCalls } from "../hooks/useCalls";
import { unsuccessfulCallStatuses } from "../utils/status";

function StatCard({ label, value, icon: Icon, tone }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
        </div>
        <span className={`grid size-10 place-items-center rounded-lg ${tone}`}>
          <Icon size={20} aria-hidden="true" />
        </span>
      </div>
    </Card>
  );
}

export function Dashboard() {
  const { calls, loading, error, refresh } = useCalls();
  const completed = calls.filter((call) => call.status === "completed").length;
  const failed = calls.filter((call) =>
    unsuccessfulCallStatuses.includes(call.status),
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="OVERVIEW"
        title="Call dashboard"
        description="Monitor the outcome of your outbound AI conversations."
        actions={
          <Button as={Link} to="/calls/new">
            <Plus size={17} aria-hidden="true" />
            Make New Call
          </Button>
        }
      />
      {loading ? (
        <Card>
          <Loading label="Loading call statistics…" />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState
            message={error}
            onRetry={() => refresh().catch(() => undefined)}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Total calls"
              value={calls.length}
              icon={PhoneOutgoing}
              tone="bg-brand-50 text-brand-700"
            />
            <StatCard
              label="Completed calls"
              value={completed}
              icon={CheckCircle2}
              tone="bg-emerald-50 text-emerald-700"
            />
            <StatCard
              label="Failed calls"
              value={failed}
              icon={PhoneOff}
              tone="bg-red-50 text-red-700"
            />
          </div>
          <Card className="mt-6 overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Recent calls</h2>
                <p className="mt-1 text-sm text-slate-600">
                  The latest five call records from the API.
                </p>
              </div>
              <Link
                to="/calls"
                className="text-sm font-semibold text-brand-700 hover:text-brand-600"
              >
                View all calls
              </Link>
            </div>
            <CallTable
              calls={calls.slice(0, 5)}
              emptyDescription="Make a new call to start building call history."
            />
          </Card>
        </>
      )}
    </>
  );
}
