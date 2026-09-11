import { useEffect } from "react";

export interface KeyboardShortcutHandlers {
  onApprove?: () => void;
  onReject?: () => void;
  onNextField?: () => void;
  onPrevField?: () => void;
  onSaveDraft?: () => void;
  onToggleDiff?: () => void;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      // Ctrl + Enter: Approve Document
      if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        handlers.onApprove?.();
        return;
      }

      // Ctrl + Shift + R: Reject Document
      if (event.ctrlKey && event.shiftKey && (event.key === "R" || event.key === "r")) {
        event.preventDefault();
        handlers.onReject?.();
        return;
      }

      // Ctrl + S: Save Draft
      if (event.ctrlKey && (event.key === "s" || event.key === "S")) {
        event.preventDefault();
        handlers.onSaveDraft?.();
        return;
      }

      // Alt + D: Toggle Visual Diff
      if (event.altKey && (event.key === "d" || event.key === "D")) {
        event.preventDefault();
        handlers.onToggleDiff?.();
        return;
      }

      if (!isInput) {
        // Alt + ArrowDown: Next Field
        if (event.altKey && event.key === "ArrowDown") {
          event.preventDefault();
          handlers.onNextField?.();
          return;
        }

        // Alt + ArrowUp: Previous Field
        if (event.altKey && event.key === "ArrowUp") {
          event.preventDefault();
          handlers.onPrevField?.();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers, enabled]);
}
