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
  Users,
  UsersRound,
  Wrench,
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
};

export function ToolIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = (name && ICONS[name]) || Wrench;
  return <Icon className={cn("size-5", className)} />;
}
