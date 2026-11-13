import {
  Cake,
  FileDown,
  FileImage,
  FileOutput,
  FileStack,
  ImageDown,
  Percent,
  QrCode,
  Receipt,
  Scaling,
  Scissors,
  Type,
  type LucideIcon,
} from "lucide-react";

const TOOL_ICONS: Record<string, LucideIcon> = {
  "file-down": FileDown,
  "file-stack": FileStack,
  scissors: Scissors,
  "file-image": FileImage,
  "file-output": FileOutput,
  "image-down": ImageDown,
  scaling: Scaling,
  qr: QrCode,
  receipt: Receipt,
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
