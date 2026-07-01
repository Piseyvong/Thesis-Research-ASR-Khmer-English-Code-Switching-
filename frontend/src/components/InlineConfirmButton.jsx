import { useEffect, useRef, useState } from "react";

export default function InlineConfirmButton({
  triggerLabel = "Delete",
  prompt = "Delete this draft?",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  disabled = false,
  buttonClassName = "",
  popoverClassName = "",
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleConfirm() {
    if (!onConfirm) {
      setOpen(false);
      return;
    }

    setConfirming(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="inline-confirm" ref={rootRef}>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => setOpen((current) => !current)}
        disabled={disabled || confirming}
        aria-expanded={open}
      >
        {triggerLabel}
      </button>

      {open ? (
        <div className={`inline-confirm__popover ${popoverClassName}`.trim()}>
          <div className="inline-confirm__message">{prompt}</div>
          <div className="inline-confirm__actions">
            <button
              type="button"
              className="inline-confirm__action inline-confirm__action--ghost"
              onClick={() => setOpen(false)}
              disabled={confirming}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className="inline-confirm__action inline-confirm__action--danger"
              onClick={() => void handleConfirm()}
              disabled={confirming}
            >
              {confirming ? "Deleting..." : confirmLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
