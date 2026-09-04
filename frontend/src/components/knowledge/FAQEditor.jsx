import { Plus, Trash2 } from "lucide-react";
import { Button } from "../common/Button";
import { Input } from "../common/Input";

const emptyFaq = { question: "", answer: "" };

export function FAQEditor({ value = [], onChange }) {
  const updateFaq = (index, field, nextValue) => onChange(value.map((faq, currentIndex) => currentIndex === index ? { ...faq, [field]: nextValue } : faq));
  const removeFaq = (index) => onChange(value.filter((_, currentIndex) => currentIndex !== index));

  return (
    <div className="grid gap-4">
      {value.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">No FAQs added yet. Add only verified answers the AI can use.</p>}
      {value.map((faq, index) => <div className="rounded-lg border border-slate-200 p-4" key={`faq-${index}`}><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-slate-700">FAQ {index + 1}</p><Button variant="ghost" className="min-h-8 px-2 text-red-700 hover:bg-red-50 hover:text-red-800" aria-label={`Remove FAQ ${index + 1}`} onClick={() => removeFaq(index)}><Trash2 size={16} aria-hidden="true" /></Button></div><div className="grid gap-3"><Input label="Question" value={faq.question || ""} onChange={(event) => updateFaq(index, "question", event.target.value)} placeholder="What do you offer?" /><Input as="textarea" label="Verified answer" value={faq.answer || ""} onChange={(event) => updateFaq(index, "answer", event.target.value)} placeholder="Add the precise answer the agent can provide." /></div></div>)}
      <Button variant="secondary" className="w-full sm:w-fit" onClick={() => onChange([...value, emptyFaq])}><Plus size={16} aria-hidden="true" />Add FAQ</Button>
    </div>
  );
}
