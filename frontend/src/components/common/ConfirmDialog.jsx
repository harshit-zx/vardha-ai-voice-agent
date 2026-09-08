import { Button } from "./Button";
import { Modal } from "./Modal";

export function ConfirmDialog({
  title = "Please confirm",
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onClose,
  pending = false,
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending}>
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-6 text-slate-600">{message}</p>
    </Modal>
  );
}
