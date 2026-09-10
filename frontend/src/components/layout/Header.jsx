import { Menu } from "lucide-react";

export function Header({ onOpenNavigation }) {
  return (
    <header
      className="sticky top-0 z-20 flex min-h-16 items-center border-b border-slate-200 
            bg-slate-50/95 px-4 backdrop-blur sm:px-6 lg:px-8"
    >
      <button
        type="button"
        aria-label="Open navigation"
        onClick={onOpenNavigation}
        className="mr-3 rounded-lg p-2 text-slate-600 hover:bg-slate-200 focus-visible:outline-2 
        focus-visible:outline-offset-2 focus-visible:outline-brand-600 lg:hidden"
      >
        <Menu size={20} />
      </button>
      <div>
        <p className="text-xs font-semibold tracking-widest text-brand-700">
          VARDHA AI VOICE AGENT
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Outbound calls with knowledge-grounded conversations
        </p>
      </div>
    </header>
  );
}
