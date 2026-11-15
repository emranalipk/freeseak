import {
  Cake,
  Crop,
  FileArchive,
  FileImage,
  Globe,
  ImageDown,
  Images,
  LayoutGrid,
  ListOrdered,
  Merge,
  Percent,
  QrCode,
  Repeat,
  PenLine,
  Scaling,
  ScanText,
  Sparkles,
  Split,
  Stamp,
  Tags,
  Type,
  type LucideIcon,
} from "lucide-react";

/* v0.4: icon keys for the 6 live tools — entries for planned tools
   were removed with their catalogue entries (Rule 1).
   v0.5: + the 10 PDF tools. v0.8: + the image suite completion.
   v0.9: + the editor's pen. */
const TOOL_ICONS: Record<string, LucideIcon> = {
  "image-down": ImageDown,
  scaling: Scaling,
  qr: QrCode,
  type: Type,
  percent: Percent,
  cake: Cake,
  merge: Merge,
  split: Split,
  "file-image": FileImage,
  images: Images,
  layout: LayoutGrid,
  ordered: ListOrdered,
  pen: PenLine,
  stamp: Stamp,
  sparkles: Sparkles,
  scan: ScanText,
  tags: Tags,
  archive: FileArchive,
  repeat: Repeat,
  crop: Crop,
  globe: Globe,
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
