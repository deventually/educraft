import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";

/**
 * An always-mounted polite live region that announces the new page to screen
 * readers after a client-side (SPA) navigation — otherwise route changes are
 * silent. Reads `document.title` on the next tick (RR's meta sets it just after
 * the navigation commits), and skips the initial mount so the first page load
 * isn't double-announced.
 */
export function RouteAnnouncer() {
  const { pathname } = useLocation();
  const firstRenderRef = useRef(true);
  const [message, setMessage] = useState("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on every navigation to announce
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    const id = setTimeout(() => setMessage(document.title), 0);
    return () => clearTimeout(id);
  }, [pathname]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
