import { Save } from "lucide-react";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import { FAQEditor } from "./FAQEditor";
import { KnowledgeSection } from "./KnowledgeSection";

export function KnowledgeForm({ value, onChange, onSubmit, saving = false }) {
  const updateField = (field, nextValue) => onChange({ ...value, [field]: nextValue });
  const serviceText = (value.services || []).join("\n");

  return (
    <form onSubmit={onSubmit}>
      <KnowledgeSection title="Company profile" description="Add factual company information only. This is the source used for company-specific AI answers.">
        <div className="grid gap-4 md:grid-cols-2"><Input label="Company name" value={value.companyName || ""} onChange={(event) => updateField("companyName", event.target.value)} required /><Input as="textarea" className="md:col-span-2" label="Description" value={value.description || ""} onChange={(event) => updateField("description", event.target.value)} placeholder="A concise, verified company description." /></div>
      </KnowledgeSection>
      <KnowledgeSection title="Services and commercial information" description="Use one service per line and include pricing only when it is verified and safe to disclose.">
        <div className="grid gap-4 md:grid-cols-2"><Input as="textarea" label="Services" hint="One service per line" value={serviceText} onChange={(event) => updateField("services", event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} placeholder={"AI voice agents\nCustomer support automation"} /><Input as="textarea" label="Pricing" value={value.pricing || ""} onChange={(event) => updateField("pricing", event.target.value)} placeholder="Add verified pricing, or leave empty." /></div>
      </KnowledgeSection>
      <KnowledgeSection title="Support and contact" description="These details are surfaced only when callers ask for them.">
        <div className="grid gap-4 md:grid-cols-2"><Input as="textarea" label="Support" value={value.support || ""} onChange={(event) => updateField("support", event.target.value)} placeholder="Verified support process or hours." /><Input as="textarea" label="Contact" value={value.contact || ""} onChange={(event) => updateField("contact", event.target.value)} placeholder="Verified contact details." /></div>
      </KnowledgeSection>
      <KnowledgeSection title="Frequently asked questions" description="FAQs are ideal for exact answers to frequent caller questions.">
        <FAQEditor value={value.faq || []} onChange={(faq) => updateField("faq", faq)} />
      </KnowledgeSection>
      <div className="flex justify-end border-t border-slate-200 px-5 py-4 sm:px-6"><Button type="submit" disabled={saving}><Save size={17} aria-hidden="true" />{saving ? "Saving…" : "Save Knowledge Base"}</Button></div>
    </form>
  );
}
