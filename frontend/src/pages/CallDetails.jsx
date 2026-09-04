import { ArrowLeft, CalendarClock, Clock3, Phone, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RecordingPlayer } from "../components/calls/RecordingPlayer";
import { SummaryViewer } from "../components/calls/SummaryViewer";
import { TranscriptViewer } from "../components/calls/TranscriptViewer";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { ErrorState } from "../components/common/ErrorState";
import { Loading } from "../components/common/Loading";
import { PageHeader } from "../components/common/PageHeader";
import { StatusBadge } from "../components/common/StatusBadge";
import { api } from "../services/api";
import { formatDate } from "../utils/formatDate";
import { formatDuration } from "../utils/formatDuration";
import { activeCallStatuses } from "../utils/status";

function DetailItem({ icon: Icon, label, children }) {
  return <div className="flex gap-3"><span className="mt-0.5 text-slate-500"><Icon size={18} aria-hidden="true" /></span><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-800">{children}</dd></div></div>;
}

export function CallDetails() {
  const { id } = useParams();
  const [call, setCall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadCall = useCallback(async ({ quiet = false } = {}) => { if (!quiet) setLoading(true); try { const result = await api.getCall(id); setCall(result.data); setError(""); } catch (requestError) { if (!quiet) setError(requestError.message || "Unable to load this call."); } finally { if (!quiet) setLoading(false); } }, [id]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => loadCall(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadCall]);
  useEffect(() => { if (!call || !activeCallStatuses.includes(call.status)) return undefined; const timer = window.setInterval(() => loadCall({ quiet: true }), 10000); return () => window.clearInterval(timer); }, [call, loadCall]);

  if (loading) return <Card><Loading label="Loading call details…" /></Card>;
  if (error) return <Card><ErrorState title="Call not available" message={error} onRetry={loadCall} /></Card>;
  if (!call) return <Card><ErrorState title="Call not found" message="This call record may have been removed." /></Card>;

  return <><PageHeader eyebrow="CALL DETAILS" title={call.phoneNumber} description="Recording, transcript, and summary are added as Exotel and post-call processing make them available." actions={<><Button variant="secondary" onClick={() => loadCall()}><RefreshCw size={16} aria-hidden="true" />Refresh</Button><Button as={Link} variant="ghost" to="/calls"><ArrowLeft size={16} aria-hidden="true" />Back to history</Button></>} /><div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]"><Card className="h-fit p-5"><dl className="grid gap-5"><DetailItem icon={Phone} label="Phone number">{call.phoneNumber}</DetailItem><DetailItem icon={Clock3} label="Status"><StatusBadge status={call.status} /></DetailItem><DetailItem icon={Clock3} label="Duration">{formatDuration(call.duration)}</DetailItem><DetailItem icon={CalendarClock} label="Date and time">{formatDate(call.createdAt)}</DetailItem><DetailItem icon={CalendarClock} label="Started">{formatDate(call.startedAt)}</DetailItem><DetailItem icon={CalendarClock} label="Ended">{formatDate(call.endedAt)}</DetailItem></dl></Card><div className="grid gap-6"><Card className="p-5"><h2 className="text-base font-semibold text-slate-900">Recording</h2><p className="mt-1 text-sm text-slate-600">Playback is available when Exotel supplies a recording URL.</p><div className="mt-4"><RecordingPlayer url={call.recordingUrl} /></div></Card><Card className="p-5"><h2 className="text-base font-semibold text-slate-900">Full transcript</h2><p className="mt-1 text-sm text-slate-600">Both customer and AI messages are stored with this call.</p><div className="mt-4"><TranscriptViewer entries={call.transcriptEntries} transcript={call.transcript} /></div></Card><Card className="p-5"><h2 className="text-base font-semibold text-slate-900">Call summary</h2><p className="mt-1 text-sm text-slate-600">Generated only from the stored conversation transcript.</p><div className="mt-4"><SummaryViewer summaryData={call.summaryData} summary={call.summary} /></div></Card></div></div></>;
}
