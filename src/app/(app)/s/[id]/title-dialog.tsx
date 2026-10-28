"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

export function TitleDialog({
  open,
  title,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onSave: (title: string) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleRef = useRef(title);
  titleRef.current = title;

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    setDraft(titleRef.current);
    setError(null);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => inputRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus();
    };
  }, [open]);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const next = draft.trim();
      if (!next || saving) return;
      setSaving(true);
      setError(null);
      const message = await onSave(next);
      setSaving(false);
      if (message) {
        setError(message);
        return;
      }
      closeRef.current();
    },
    [draft, onSave, saving],
  );

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close title editor"
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-background/75 backdrop-blur-sm"
        onClick={() => closeRef.current()}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="title-dialog-heading"
        className="animate-fade-up relative w-full max-w-sm rounded-xl border bg-popover p-4 shadow-overlay"
      >
        <h2 id="title-dialog-heading" className="text-sm font-medium text-foreground">
          Rename thread
        </h2>
        <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Thread title"
            aria-describedby={error ? "title-dialog-error" : undefined}
            placeholder="Thread title"
            maxLength={80}
            className="h-9 w-full rounded-md border bg-surface-1 px-2.5 text-sm text-foreground outline-none placeholder:text-text-tertiary focus-visible:border-ring"
          />
          {error && (
            <p id="title-dialog-error" role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="ghost" onClick={() => closeRef.current()}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || !draft.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
