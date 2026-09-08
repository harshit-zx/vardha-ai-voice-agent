import { MessageSquareText } from "lucide-react";
import { EmptyState } from "../common/EmptyState";
import { formatDate } from "../../utils/formatDate";

export function TranscriptViewer({ entries = [], transcript = "" }) {
  if (!entries.length && !transcript)
    return (
      <EmptyState
        icon={MessageSquareText}
        title="No transcript available"
        description="Conversation entries appear here as the call is processed."
        className="min-h-32 rounded-lg border border-dashed border-slate-200"
      />
    );
  if (!entries.length)
    return (
      <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        {transcript}
      </pre>
    );
  return (
    <div className="grid max-h-100 gap-3 overflow-y-auto pr-1">
      {entries.map((entry, index) => {
        const assistant = entry.speaker === "ai";
        return (
          <article
            key={`${entry.at || "entry"}-${index}`}
            className={`max-w-[92%] rounded-xl px-4 py-3 text-sm leading-6 ${assistant ? "justify-self-end bg-brand-600 text-white" : "bg-slate-100 text-slate-800"}`}
          >
            <div className="mb-1 flex items-center justify-between gap-4 text-xs font-semibold opacity-80">
              <span>{assistant ? "AI" : "Customer"}</span>
              {entry.at && (
                <time dateTime={entry.at}>
                  {formatDate(entry.at, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </time>
              )}
            </div>
            <p>{entry.text}</p>
          </article>
        );
      })}
    </div>
  );
}
