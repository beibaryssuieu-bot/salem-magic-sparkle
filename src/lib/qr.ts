/**
 * QR-код генерациясы (клиент жағында ғана — canvas API қажет).
 * Жиналыстың тіркеу сілтемесін PNG data URL түрінде қайтарады.
 */
export async function generateQrDataUrl(text: string, size = 480): Promise<string> {
  const QRCode = await import("qrcode");
  return QRCode.toDataURL(text, {
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#183a2e", light: "#ffffff" },
  });
}

export function meetingCheckinUrl(qrToken: string): string {
  if (typeof window === "undefined") return `/qr/${qrToken}`;
  return `${window.location.origin}/qr/${qrToken}`;
}
