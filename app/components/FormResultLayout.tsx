import { useId, useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "~/components/ui";
import { cn } from "~/lib/utils";
import { useT } from "~/lib/i18n/useT";

interface Props {
  /** The form: inputs, settings, its own buttons and errors. */
  form: ReactNode;
  /** True once there is a result worth the room; only then can the form fold away. */
  canFold: boolean;
  /** Width of the form column on a wide screen. */
  formWidth?: "narrow" | "wide";
  /** The results; a function gets whether the form is folded, to lay itself out wider. */
  children: ReactNode | ((folded: boolean) => ReactNode);
}

const FORM_COLUMN = {
  narrow: "lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]",
  wide: "lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]",
} as const;

/**
 * The tool page's form beside its results, with a "fold the form away" toggle
 * once there is a result. Folded, the toggle gets its own row and the results
 * take the full width (on a phone: they move up, right under the toggle). The
 * form is hidden, never unmounted, so its values and uploads stay.
 */
export function FormResultLayout({ form, canFold, formWidth = "wide", children }: Props) {
  const t = useT();
  const formId = useId();
  const [open, setOpen] = useState(true);
  const folded = canFold && !open;

  return (
    <div className={cn("grid grid-cols-1 gap-6", !folded && FORM_COLUMN[formWidth])}>
      <div className="min-w-0 space-y-4">
        {canFold && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={!folded}
            aria-controls={formId}
            onClick={() => setOpen((o) => !o)}
          >
            {folded ? (
              <PanelLeftOpen className="size-4" aria-hidden />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden />
            )}
            {folded ? t.tool.formShow : t.tool.formHide}
          </Button>
        )}
        <div id={formId} hidden={folded} className="space-y-4">
          {form}
        </div>
      </div>
      {typeof children === "function" ? children(folded) : children}
    </div>
  );
}
