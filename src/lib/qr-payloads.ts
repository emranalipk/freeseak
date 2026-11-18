/* ============================================================================
 * QR payload builders + scannability check — pure string/number functions.
 * ----------------------------------------------------------------------------
 * Wi-Fi / vCard / e-mail payloads follow the de-facto QR content standards
 * (WIFI:, vCard 3.0, mailto:) so phone cameras open the right action instead
 * of showing raw text. The contrast check uses the WCAG 2.x relative
 * luminance formula — a QR code is read as a black/white bitmap, so what
 * matters is luminance difference, not hue.
 * ========================================================================== */

/* Wi-Fi field escaping per the WIFI: QR convention: \ ; , : " get a backslash */
function wifiEscape(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

export interface WifiPayloadInput {
  ssid: string;
  password?: string;
  encryption: "WPA" | "WEP" | "nopass";
  hidden?: boolean;
}

/** WIFI:T:WPA;S:MyNetwork;P:secret;H:false;; */
export function buildWifiPayload({
  ssid,
  password,
  encryption,
  hidden,
}: WifiPayloadInput): string {
  const parts = [`T:${encryption}`, `S:${wifiEscape(ssid)}`];
  if (encryption !== "nopass" && password) {
    parts.push(`P:${wifiEscape(password)}`);
  }
  parts.push(`H:${hidden ? "true" : "false"}`);
  return `WIFI:${parts.join(";")};;`;
}

/* vCard values: \ ; , are escaped, newlines become literal \n */
function vcardEscape(value: string): string {
  return value.replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");
}

export interface VCardPayloadInput {
  fullName: string;
  org?: string;
  title?: string;
  phone?: string;
  email?: string;
  website?: string;
}

/** vCard 3.0 — BEGIN:VCARD … END:VCARD */
export function buildVCardPayload({
  fullName,
  org,
  title,
  phone,
  email,
  website,
}: VCardPayloadInput): string {
  const name = fullName.trim();
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${vcardEscape(name)}`];
  /* N is the structured name — kept identical to FN, which readers accept */
  lines.push(`N:${vcardEscape(name)}`);
  if (org?.trim()) lines.push(`ORG:${vcardEscape(org.trim())}`);
  if (title?.trim()) lines.push(`TITLE:${vcardEscape(title.trim())}`);
  if (phone?.trim()) lines.push(`TEL;TYPE=CELL:${vcardEscape(phone.trim())}`);
  if (email?.trim())
    lines.push(`EMAIL;TYPE=INTERNET:${vcardEscape(email.trim())}`);
  if (website?.trim()) lines.push(`URL:${vcardEscape(website.trim())}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

export interface EmailPayloadInput {
  to: string;
  subject?: string;
  body?: string;
}

/** mailto: with encoded subject/body — cameras open the compose screen */
export function buildEmailPayload({ to, subject, body }: EmailPayloadInput): string {
  const email = to.trim();
  const params: string[] = [];
  if (subject?.trim())
    params.push(`subject=${encodeURIComponent(subject.trim())}`);
  if (body?.trim()) params.push(`body=${encodeURIComponent(body.trim())}`);
  return params.length > 0
    ? `mailto:${email}?${params.join("&")}`
    : `mailto:${email}`;
}

/* ---- scannability: WCAG contrast between code and background ------------- */

/** relative luminance (WCAG 2.x) of a #rgb or #rrggbb colour; 0 when unparsable */
export function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const chan = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
}

/** WCAG contrast ratio (1 = identical, 21 = black on white) */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface ContrastVerdict {
  ratio: number;
  level: "stop" | "weak" | "mild" | "ok";
  /** null when ok — otherwise an honest message for the UI */
  message: string | null;
}

export function contrastVerdict(dark: string, light: string): ContrastVerdict {
  const ratio = contrastRatio(dark, light);
  if (ratio < 1.2) {
    return {
      ratio,
      level: "stop",
      message:
        "The code and background are nearly the same colour — scanners won't read that. Pick two very different colours.",
    };
  }
  if (ratio < 3) {
    return {
      ratio,
      level: "weak",
      message: `Contrast is only ${ratio.toFixed(1)}:1 — many scanners will struggle. Use a much darker code on a much lighter background (aim for 5:1 or better).`,
    };
  }
  if (ratio < 5) {
    return {
      ratio,
      level: "mild",
      message: `Contrast is ${ratio.toFixed(1)}:1 — it should scan, but a darker code on a lighter background is more reliable (aim for 5:1 or better).`,
    };
  }
  return { ratio, level: "ok", message: null };
}
