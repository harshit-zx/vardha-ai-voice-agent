import { ClipboardList } from "lucide-react";
import { EmptyState } from "../common/EmptyState";

const rows = [
  ["What was discussed", "discussed"],
  ["Caller questions", "callerQuestions"],
  ["Caller requirement", "callerRequirement"],
  ["Important points", "importantPoints"],
  ["Follow-up needed", "followUpNeeded"],
];

function visibleValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join("; ");
  return String(value || "");
}

export function SummaryViewer({ summaryData, summary = "" }) {
  if (!summaryData && !summary)
    return (
      <EmptyState
        icon={ClipboardList}
        title="No summary available"
        description="A transcript-based summary will appear after post-call processing."
        className="min-h-32 rounded-lg border border-dashed border-slate-200"
      />
    );
  if (!summaryData)
    return (
      <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        {summary}
      </pre>
    );
  return (
    <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200">
      {rows.map(([label, key]) => (
        <div key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm font-semibold text-slate-700">{label}</dt>
          <dd className="text-sm leading-6 text-slate-600 sm:col-span-2">
            {visibleValue(summaryData[key]) || "Not captured."}
          </dd>
        </div>
      ))}
    </dl>
  );
}
