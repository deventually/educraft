import { Compass, Layers, ClipboardCheck, Zap, Wrench, type LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  compass: Compass,
  layers: Layers,
  "clipboard-check": ClipboardCheck,
  zap: Zap,
};

export function ToolIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = (name && ICONS[name]) || Wrench;
  return <Icon className={cn("size-5", className)} />;
}
