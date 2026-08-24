export const isWhatsappDualQrMode = () =>
  String(process.env.WHATSAPP_DUAL_QR_MODE || '').trim().toLowerCase() === 'true';
