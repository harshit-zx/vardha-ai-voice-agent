import { useEffect } from "react";
import { Sidebar } from "./Sidebar";

export function MobileSidebar({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
      <button type="button" className="absolute inset-0 w-full bg-slate-950/50" aria-label="Close navigation" onClick={onClose} />
      <div className="relative h-full shadow-xl"><Sidebar mobile onNavigate={onClose} onClose={onClose} /></div>
    </div>
  );
}
