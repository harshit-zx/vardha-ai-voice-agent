import { PhoneCall } from "lucide-react";
import { useState } from "react";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import { normalizeIndianMobile } from "../../utils/status";

export function CallForm({ onSubmit }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedPhone = normalizeIndianMobile(phoneNumber);

    if (!/^\+91[6-9]\d{9}$/.test(normalizedPhone)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      await onSubmit(normalizedPhone);

      setPhoneNumber("");
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The call could not be started."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="grid size-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
        <PhoneCall size={22} aria-hidden="true" />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Connect a caller to the AI agent
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-600">
          The configured Exotel flow connects the call to the
          Voicebot and its knowledge-grounded responses.
        </p>
      </div>

      <Input
        id="phoneNumber"
        label="Mobile number"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder="+91 98765 43210"
        maxLength={16}
        value={phoneNumber}
        onChange={(event) => setPhoneNumber(event.target.value)}
        error={error}
        hint="Enter a 10-digit Indian mobile number."
        autoFocus
        required
      />

      <Button
        type="submit"
        className="w-full"
        disabled={submitting}
      >
        <PhoneCall size={17} aria-hidden="true" />

        {submitting ? "Starting call…" : "Call"}
      </Button>
    </form>
  );
}