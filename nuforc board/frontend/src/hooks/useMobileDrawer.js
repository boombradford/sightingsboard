import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (node) => node instanceof HTMLElement && !node.hasAttribute("disabled")
  );
}

export function useMobileDrawer({ open, onClose, desktopQuery = "(min-width: 1280px)" }) {
  const drawerRef = useRef(null);

  useEffect(() => {
    const media = window.matchMedia(desktopQuery);
    const onMediaChange = (event) => {
      if (event.matches && open) {
        onClose();
      }
    };

    media.addEventListener("change", onMediaChange);
    return () => {
      media.removeEventListener("change", onMediaChange);
    };
  }, [desktopQuery, onClose, open]);

  useEffect(() => {
    if (!open) return;
    if (window.matchMedia(desktopQuery).matches) return;

    const drawerNode = drawerRef.current;
    const previousActive = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    if (drawerNode instanceof HTMLElement) {
      const focusable = getFocusableElements(drawerNode);
      const first = focusable[0] || drawerNode;
      first.focus();
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      if (!(drawerNode instanceof HTMLElement)) return;

      const focusable = getFocusableElements(drawerNode);
      if (!focusable.length) {
        event.preventDefault();
        drawerNode.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousActive instanceof HTMLElement) {
        previousActive.focus();
      }
    };
  }, [desktopQuery, onClose, open]);

  return drawerRef;
}
