import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Card } from "../components/common/Card";
import { ErrorState } from "../components/common/ErrorState";
import { Loading } from "../components/common/Loading";
import { PageHeader } from "../components/common/PageHeader";
import { KnowledgeForm } from "../components/knowledge/KnowledgeForm";
import { useKnowledgeBase } from "../hooks/useKnowledgeBase";

export function KnowledgeBase() {
  const { knowledge, setKnowledge, loading, error, refresh, save } = useKnowledgeBase();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const handleSubmit = async (event) => { event.preventDefault(); try { setSaving(true); setSaveError(""); setNotice(""); const result = await save(knowledge); setKnowledge(result); setNotice("Knowledge Base saved successfully."); } catch (requestError) { setSaveError(requestError.message || "Unable to save the Knowledge Base."); } finally { setSaving(false); } };

  return <><PageHeader eyebrow="KNOWLEDGE" title="Knowledge Base" description="Manage the verified company information used to ground every AI response." />{loading ? <Card><Loading label="Loading Knowledge Base…" /></Card> : error ? <Card><ErrorState message={error} onRetry={() => refresh().catch(() => undefined)} /></Card> : <Card className="overflow-hidden">{notice && <div className="m-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status"><CheckCircle2 size={18} aria-hidden="true" />{notice}</div>}{saveError && <div className="m-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{saveError}</div>}<KnowledgeForm value={knowledge} onChange={setKnowledge} onSubmit={handleSubmit} saving={saving} /></Card>}</>;
}
