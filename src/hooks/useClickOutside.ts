import { useEffect, type RefObject } from "react";

/**
 * Hook to detect clicks outside a referenced element.
 * Calls `onClose` when a click is detected outside while `isActive` is true.
 */
export const useClickOutside = (
  ref: RefObject<HTMLElement | null>,
  isActive: boolean,
  onClose: () => void,
) => {
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [ref, isActive, onClose]);
};
