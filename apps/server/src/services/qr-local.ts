import QRCode from 'qrcode';

export interface LocalQRResult {
  dataUrl: string;  // base64 data URL для отображения в <img>
}

/**
 * Генерирует QR-код локально и возвращает как data URL
 */
export async function generateQRCode(url: string): Promise<LocalQRResult> {
  const dataUrl = await QRCode.toDataURL(url, {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });

  return { dataUrl };
}

/**
 * Генерирует QR-код и сохраняет как файл (опционально)
 */
export async function generateQRCodeToFile(url: string, filePath: string): Promise<void> {
  await QRCode.toFile(filePath, url, {
    width: 256,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}
