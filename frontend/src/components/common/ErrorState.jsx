import { AlertCircle } from "lucide-react";
import { Button } from "./Button";

export function ErrorState({ title = "Something went wrong", message, onRetry, className = "" }) {
  return (
    <div className={`flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center ${className}`} role="alert">
      <span className="mb-3 grid size-10 place-items-center rounded-full bg-red-50 text-red-600"><AlertCircle size={20} aria-hidden="true" /></span>
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {message && <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{message}</p>}
      {onRetry && <Button variant="secondary" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
