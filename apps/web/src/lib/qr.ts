/**
 * A QR code as a picture (QR codes keep their own black on white). The library loads only when a QR
 * is shown — the TV's code screen, "Continue on your phone" —, not with every screen that might show one.
 */
export async function qrImage(text: string, width = 480): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(text, { margin: 1, width, color: { dark: "#0b0c10", light: "#ffffff" } }); // ui-lint-ignore hex-color: QR code
}
