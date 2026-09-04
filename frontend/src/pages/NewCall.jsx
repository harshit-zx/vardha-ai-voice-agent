import { Info } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CallForm } from "../components/calls/CallForm";
import { CallStatus } from "../components/calls/CallStatus";
import { Card } from "../components/common/Card";
import { PageHeader } from "../components/common/PageHeader";
import { api } from "../services/api";
import { activeCallStatuses } from "../utils/status";

export function NewCall() {
  const [createdCall, setCreatedCall] = useState(null);

  useEffect(() => {
    if (!createdCall?._id || !activeCallStatuses.includes(createdCall.status)) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const result = await api.getCall(createdCall._id);
        setCreatedCall(result.data);
      } catch {
        // The original call result remains visible; a later refresh can recover any transient error.
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [createdCall?._id, createdCall?.status]);

  return (
    <>
      <PageHeader eyebrow="OUTBOUND CALL" title="Start a new call" description="Enter a verified Indian mobile number to ask Exotel to connect the caller to the AI voice agent." />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]"><Card className="p-5 sm:p-7"><CallForm onSubmit={async (phoneNumber) => { const result = await api.createCall(phoneNumber); setCreatedCall(result.data); }} />{createdCall && <div className="mt-5"><CallStatus call={createdCall} /><Link className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:text-brand-600" to={`/calls/${createdCall._id}`}>Open call details</Link></div>}</Card><Card className="h-fit p-5"><div className="flex gap-3"><Info size={19} className="mt-0.5 shrink-0 text-brand-700" aria-hidden="true" /><div><h2 className="font-semibold text-slate-900">Before calling</h2><ol className="mt-2 list-decimal space-y-2 pl-4 text-sm leading-6 text-slate-600"><li>Save verified company information in the Knowledge Base.</li><li>Configure Exotel, AI providers, MongoDB, and a public URL.</li><li>Set the Exotel Voicebot applet WSS endpoint.</li></ol></div></div></Card></div>
    </>
  );
}
