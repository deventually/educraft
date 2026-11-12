import {
  Compass,
  Layers,
  ClipboardCheck,
  Zap,
  Target,
  Lightbulb,
  MessageCircle,
  MapPin,
  MessagesSquare,
  NotebookPen,
  SquareRadical,
  Brain,
  GraduationCap,
  BookOpen,
  CalendarClock,
  FilePenLine,
  Route,
  Users,
  UsersRound,
  Wrench,
  Calculator,
  Table2,
  ChartColumn,
  Gauge,
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
  "map-pin": MapPin,
  "messages-square": MessagesSquare,
  "notebook-pen": NotebookPen,
  "square-root": SquareRadical,
  brain: Brain,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  users: Users,
  "users-round": UsersRound,
  calculator: Calculator,
  table: Table2,
  "calendar-clock": CalendarClock,
  "file-pen-line": FilePenLine,
  "chart-column": ChartColumn,
  gauge: Gauge,
  route: Route,
};

/** The icon names a tool may use (`Tool.icon`). */
export const TOOL_ICON_NAMES: readonly string[] = Object.keys(ICONS);

export function ToolIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = (name && ICONS[name]) || Wrench;
  return <Icon className={cn("size-5", className)} />;
}
