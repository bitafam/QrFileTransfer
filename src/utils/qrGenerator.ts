import QRCode from 'qrcode';
import { QRSettings } from '../types/transfer';

export const defaultQRSettings: QRSettings = {
  fgColor: '#0f172a', // Slate 900
  bgColor: '#ffffff',
  level: 'M',
  size: 320,
  includeLogo: true,
};

export async function generateQRCodeDataUrl(
  text: string,
  settings: Partial<QRSettings> = {}
): Promise<string> {
  const mergedSettings = { ...defaultQRSettings, ...settings };

  try {
    const dataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: mergedSettings.level,
      margin: 2,
      width: mergedSettings.size,
      color: {
        dark: mergedSettings.fgColor,
        light: mergedSettings.bgColor,
      },
    });

    if (!mergedSettings.includeLogo) {
      return dataUrl;
    }

    // Draw central badge/icon onto image canvas
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = mergedSettings.size;
        canvas.height = mergedSettings.size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);

        // Draw QR
        ctx.drawImage(img, 0, 0);

        // Draw Center Icon Circle
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const badgeRadius = Math.floor(mergedSettings.size * 0.11);

        // Outer glow/border
        ctx.beginPath();
        ctx.arc(centerX, centerY, badgeRadius + 3, 0, 2 * Math.PI);
        ctx.fillStyle = mergedSettings.bgColor;
        ctx.fill();

        // Inner circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, badgeRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#0284c7'; // Sky 600
        ctx.fill();

        // Draw transfer icon (symbol) inside
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${badgeRadius}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', centerX, centerY + 1);

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  } catch (err) {
    console.error('Failed to generate QR code', err);
    throw err;
  }
}
