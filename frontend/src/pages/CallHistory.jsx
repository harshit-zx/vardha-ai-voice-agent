import { RefreshCw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { CallTable } from "../components/calls/CallTable";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { ErrorState } from "../components/common/ErrorState";
import { Input } from "../components/common/Input";
import { Loading } from "../components/common/Loading";
import { PageHeader } from "../components/common/PageHeader";
import { useCalls } from "../hooks/useCalls";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "created", label: "Created" },
  { value: "queued", label: "Queued" },
  { value: "ringing", label: "Ringing" },
  { value: "answered", label: "Answered" },
  { value: "in-progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "busy", label: "Busy" },
  { value: "no-answer", label: "No answer" },
];

/**
 * Converts a phone number into digits only.
 *
 * Examples:
 * +91 98765 43210 -> 919876543210
 * +919876543210   -> 919876543210
 * 9876543210      -> 9876543210
 */
function normalizeSearchPhone(value = "") {
  return String(value).replace(/\D/g, "");
}

export function CallHistory() {
  const { calls, loading, error, refresh } = useCalls();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const filteredCalls = useMemo(() => {
    const query = normalizeSearchPhone(search);

    return calls.filter((call) => {
      const phone = normalizeSearchPhone(call.phoneNumber);

      const matchesPhone = !query || phone.includes(query);

      const normalizedStatus = String(call.status || "unknown").toLowerCase();

      const matchesStatus = status === "all" || normalizedStatus === status;

      return matchesPhone && matchesStatus;
    });
  }, [calls, search, status]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await refresh();
    } catch {
      // useCalls already exposes the error state.
    } finally {
      setRefreshing(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
  };

  const hasFilters = search.trim().length > 0 || status !== "all";

  return (
    <>
      <PageHeader
        eyebrow="CALLS"
        title="Call history"
        description="Review statuses, recordings, transcripts, and summaries for every outbound call."
        actions={
          <Button
            variant="secondary"
            onClick={handleRefresh}
            disabled={loading || refreshing}
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
              className={refreshing ? "animate-spin" : ""}
            />

            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {/* Filters */}
        <div className="border-b border-slate-200 p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_12rem_auto] lg:items-end">
            {/* Search */}
            <div className="relative">
              <Input
                id="call-search"
                label="Search phone number"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="+91 98765 43210"
                inputMode="tel"
                autoComplete="off"
              />

              {search && (
                <button
                  type="button"
                  aria-label="Clear phone number search"
                  title="Clear search"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-8 grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Status */}
            <div className="grid gap-1.5">
              <label
                htmlFor="call-status"
                className="text-sm font-medium text-slate-700"
              >
                Filter by status
              </label>

              <select
                id="call-status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:ring-3 focus:ring-brand-100"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear filters */}
            <div className="lg:pb-0.5">
              <Button
                type="button"
                variant="ghost"
                onClick={clearFilters}
                disabled={!hasFilters}
                className="w-full lg:w-auto"
              >
                <X size={16} aria-hidden="true" />
                Clear filters
              </Button>
            </div>
          </div>

          {/* Search/filter information */}
          {!loading && !error && (
            <div className="mt-4 flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Search size={15} aria-hidden="true" />

                <span>
                  Showing{" "}
                  <strong className="font-semibold text-slate-700">
                    {filteredCalls.length}
                  </strong>{" "}
                  of{" "}
                  <strong className="font-semibold text-slate-700">
                    {calls.length}
                  </strong>{" "}
                  calls
                </span>
              </div>

              {hasFilters && (
                <span className="text-xs text-slate-400">
                  Filters are applied automatically.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <Loading label="Loading call history…" />
        ) : error ? (
          <ErrorState
            title="Unable to load call history"
            message={error}
            onRetry={handleRefresh}
          />
        ) : (
          <CallTable
            calls={filteredCalls}
            emptyTitle={calls.length ? "No matching calls" : "No calls yet"}
            emptyDescription={
              calls.length
                ? "Try a different phone number or status filter."
                : "Start a new outbound call to see activity here."
            }
          />
        )}
      </Card>
    </>
  );
}
