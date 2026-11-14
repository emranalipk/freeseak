import {
  Cake,
  ImageDown,
  Percent,
  QrCode,
  Scaling,
  Type,
  type LucideIcon,
} from "lucide-react";

/* v0.4: icon keys for the 6 live tools — entries for planned tools
   were removed with their catalogue entries (Rule 1). */
const TOOL_ICONS: Record<string, LucideIcon> = {
  "image-down": ImageDown,
  scaling: Scaling,
  qr: QrCode,
  type: Type,
  percent: Percent,
  cake: Cake,
};

export function ToolIcon({
  icon,
  className = "",
}: {
  icon: string;
  className?: string;
}) {
  const Icon = TOOL_ICONS[icon] ?? Type;
  return <Icon className={className} aria-hidden="true" />;
}
