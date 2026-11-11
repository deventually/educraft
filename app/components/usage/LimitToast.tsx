import { useEffect, useRef } from "react";
import { useFetcher, useNavigation } from "react-router";
import { useToast } from "~/components/Toast";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";
import { AI_DONE_EVENT, limitAlertKey } from "~/lib/usage/limits";
import { useLimitScope, type ViewerLimit } from "./LimitNotice";

const SEEN = "limeonit.aiLimitSeen";

function seen(): string | null {
  try {
    return localStorage.getItem(SEEN);
  } catch {
    return null;
  }
}

function remember(key: string) {
  try {
    localStorage.setItem(SEEN, key);
  } catch {
    // Without storage the toast may come again on the next page load; that is fine.
  }
}

/**
 * The monthly limit as a toast (PR D): once when a teacher passes 80%, once when it is spent,
 * per month and per browser. Checks on the first page, after every streamed AI call and
 * after every form that ran AI, so the teacher hears it where they work, not only on Usage.
 */
export function LimitToast() {
  const fetcher = useFetcher<{ limit: ViewerLimit | null }>();
  const load = useRef(fetcher.load);
  load.current = fetcher.load;
  const navigation = useNavigation();
  const submitted = useRef(false);
  const { showToast } = useToast();
  const t = useT();
  const locale = useLocale();
  const scopeOf = useLimitScope();

  useEffect(() => {
    const check = () => void load.current("/api/ai-limit");
    check();
    window.addEventListener(AI_DONE_EVENT, check);
    return () => window.removeEventListener(AI_DONE_EVENT, check);
  }, []);

  // A form action (a course review, the dossier coach) may have used AI too.
  useEffect(() => {
    if (navigation.state === "submitting") submitted.current = true;
    else if (navigation.state === "idle" && submitted.current) {
      submitted.current = false;
      void load.current("/api/ai-limit");
    }
  }, [navigation.state]);

  const limit = fetcher.data?.limit ?? null;
  useEffect(() => {
    const key = limitAlertKey(limit, new Date().toISOString().slice(0, 7));
    if (!limit || !key || key === seen()) return;
    remember(key);
    const pct = Math.min(limit.share, 1).toLocaleString(locale === "en" ? "en-GB" : "nl-NL", {
      style: "percent",
      maximumFractionDigits: 0,
    });
    const stop = limit.state === "stop";
    showToast({
      variant: stop ? "error" : "info",
      message: fmt(stop ? t.usage.limitStop : t.usage.limitWarn, { pct, scope: scopeOf(limit) }),
    });
  }, [limit, locale, scopeOf, showToast, t]);

  return null;
}
