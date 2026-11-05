import {
  Compass,
  Layers,
  ClipboardCheck,
  Zap,
  Target,
  Lightbulb,
  MessageCircle,
  SquareRadical,
  Brain,
  GraduationCap,
  BookOpen,
  CalendarClock,
  Users,
  UsersRound,
  Wrench,
  Calculator,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  compass: Compass,
  layers: Layers,
  "clipboard-check": ClipboardCheck,
  zap: Zap,
  target: Target,
  lightbulb: Lightbulb,
  "message-circle": MessageCircle,
  "square-root": SquareRadical,
  brain: Brain,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  users: Users,
  "users-round": UsersRound,
  calculator: Calculator,
  table: Table2,
  "calendar-clock": CalendarClock,
};

/** The icon names a tool may use (`Tool.icon`). */
export const TOOL_ICON_NAMES: readonly string[] = Object.keys(ICONS);

export function ToolIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = (name && ICONS[name]) || Wrench;
  return <Icon className={cn("size-5", className)} />;
}
