import { Headphones } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "../common/EmptyState";

export function RecordingPlayer({ url }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <EmptyState icon={Headphones} title="Recording not available yet" description={failed ? "This recording could not be loaded by the browser." : "Exotel will provide the recording after it is available."} className="min-h-32 rounded-lg border border-dashed border-slate-200" />;
  return <audio className="w-full" controls preload="metadata" src={url} onError={() => setFailed(true)}>Your browser cannot play this recording.</audio>;
}
