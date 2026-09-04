import { Plus, Trash2 } from "lucide-react";
import { Button } from "../common/Button";
import { Input } from "../common/Input";

const createEmptyFaq = () => ({
  question: "",
  answer: "",
});

export function FAQEditor({ value = [], onChange }) {
  const faqs = Array.isArray(value) ? value : [];

  const updateFaq = (index, field, nextValue) => {
    const updatedFaqs = faqs.map((faq, currentIndex) =>
      currentIndex === index
        ? {
            ...faq,
            [field]: nextValue,
          }
        : faq,
    );

    onChange(updatedFaqs);
  };

  const removeFaq = (index) => {
    const updatedFaqs = faqs.filter(
      (_, currentIndex) => currentIndex !== index,
    );

    onChange(updatedFaqs);
  };

  const addFaq = () => {
    onChange([...faqs, createEmptyFaq()]);
  };

  return (
    <div className="grid gap-4">
      {/* Empty state */}
      {faqs.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
          <p className="text-sm font-medium text-slate-700">
            No FAQs added yet.
          </p>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Add verified questions and answers that the AI voice agent can
            safely use during customer conversations.
          </p>
        </div>
      )}

      {/* FAQ list */}
      {faqs.map((faq, index) => (
        <div
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          key={`faq-${index}`}
        >
          {/* FAQ header */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                FAQ {index + 1}
              </p>

              <p className="mt-0.5 text-xs text-slate-500">
                Add a question and its verified answer.
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="min-h-8 px-2 text-red-700 hover:bg-red-50 hover:text-red-800"
              aria-label={`Remove FAQ ${index + 1}`}
              title={`Remove FAQ ${index + 1}`}
              onClick={() => removeFaq(index)}
            >
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          </div>

          {/* FAQ fields */}
          <div className="grid gap-4">
            <Input
              id={`faq-question-${index}`}
              label="Question"
              value={faq?.question || ""}
              onChange={(event) =>
                updateFaq(index, "question", event.target.value)
              }
              placeholder="What do you offer?"
              required
            />

            <Input
              id={`faq-answer-${index}`}
              as="textarea"
              label="Verified answer"
              value={faq?.answer || ""}
              onChange={(event) =>
                updateFaq(index, "answer", event.target.value)
              }
              placeholder="Add the precise answer the AI agent can provide."
              required
            />
          </div>
        </div>
      ))}

      {/* Add FAQ */}
      <Button
        type="button"
        variant="secondary"
        className="w-full sm:w-fit"
        onClick={addFaq}
      >
        <Plus size={16} aria-hidden="true" />
        Add FAQ
      </Button>
    </div>
  );
}
