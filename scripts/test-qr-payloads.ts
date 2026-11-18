/* QR payload + contrast verification — run with: bun scripts/test-qr-payloads.ts */
import {
  buildEmailPayload,
  buildVCardPayload,
  buildWifiPayload,
  contrastRatio,
  contrastVerdict,
} from "../src/lib/qr-payloads";

let failures = 0;
function eq(label: string, got: unknown, want: unknown) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
}

// Wi-Fi payload + escaping
eq("wifi basic", buildWifiPayload({ ssid: "HomeNet", password: "pw12345", encryption: "WPA" }),
  "WIFI:T:WPA;S:HomeNet;P:pw12345;H:false;;");
eq("wifi escapes ; , : \" \\", buildWifiPayload({ ssid: 'a;b,c:d"e\\f', password: "x", encryption: "WPA" }),
  'WIFI:T:WPA;S:a\\;b\\,c\\:d\\"e\\\\f;P:x;H:false;;');
eq("wifi nopass drops P", buildWifiPayload({ ssid: "Cafe", encryption: "nopass", password: "ignored" }),
  "WIFI:T:nopass;S:Cafe;H:false;;");
eq("wifi hidden", buildWifiPayload({ ssid: "N", encryption: "WEP", password: "k", hidden: true }),
  "WIFI:T:WEP;S:N;P:k;H:true;;");

// vCard
const vc = buildVCardPayload({ fullName: "A. B. Smith", org: "Acme, Ltd", title: "CEO", phone: "+92 300 1234567", email: "a@b.pk", website: "https://x.pk" });
eq("vcard begin", vc.startsWith("BEGIN:VCARD\nVERSION:3.0\nFN:A. B. Smith\nN:A. B. Smith\n"), true);
eq("vcard escapes comma in org", vc.includes("ORG:Acme\\, Ltd"), true);
eq("vcard tel", vc.includes("TEL;TYPE=CELL:+92 300 1234567"), true);
eq("vcard end", vc.endsWith("END:VCARD"), true);
eq("vcard skips empties", buildVCardPayload({ fullName: "X" }), "BEGIN:VCARD\nVERSION:3.0\nFN:X\nN:X\nEND:VCARD");

// E-mail
eq("mailto bare", buildEmailPayload({ to: "a@b.pk" }), "mailto:a@b.pk");
eq("mailto encoded", buildEmailPayload({ to: "a@b.pk", subject: "Hi there", body: "Line1&Line 2" }),
  "mailto:a@b.pk?subject=Hi%20there&body=Line1%26Line%202");

// Contrast
eq("contrast black/white = 21", Math.round(contrastRatio("#000000", "#FFFFFF") * 100) / 100, 21);
eq("contrast identical = 1", contrastRatio("#173B70", "#173B70"), 1);
const v1 = contrastVerdict("#173B70", "#FFFFFF");
eq("brand-on-white ok", v1.level === "ok" && v1.message === null, true);
eq("same colours -> stop", contrastVerdict("#123456", "#123456").level, "stop");
eq("mid grey on white -> weak", contrastVerdict("#B0B0B0", "#FFFFFF").level, "weak");
console.log(failures === 0 ? "\nALL QR PAYLOAD TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
