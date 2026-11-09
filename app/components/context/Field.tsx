import { Label } from "~/components/ui";

/** Label + control wrapper with proper htmlFor/id association. */
export function Field({
  id,
  label,
  required,
  children,
}: {
  id?: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} required={required} className="mb-1.5">
        {label}
      </Label>
      {children}
    </div>
  );
}
