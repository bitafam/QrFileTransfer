import { AirGappedChunk } from '../types/transfer';

// Chunk size for QR Code payload (approx 800 chars per frame for optimal high speed QR camera scan)
const MAX_CHUNK_SIZE = 750;

/**
 * Split base64 file data into array of QR encoded strings for offline transfer
 */
export function encodeFileToQRChunks(
  fileName: string,
  fileType: string,
  base64Data: string
): string[] {
  const fileId = Math.random().toString(36).substring(2, 8);
  const dataLength = base64Data.length;
  const totalChunks = Math.ceil(dataLength / MAX_CHUNK_SIZE);

  const frames: string[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunk = base64Data.slice(i * MAX_CHUNK_SIZE, (i + 1) * MAX_CHUNK_SIZE);
    // Format: AG1|ID|INDEX|TOTAL|NAME|TYPE|CHUNK
    const payload = `AG1|${fileId}|${i + 1}|${totalChunks}|${encodeURIComponent(fileName)}|${encodeURIComponent(fileType)}|${chunk}`;
    frames.push(payload);
  }

  return frames;
}

/**
 * Parse an Air-Gapped QR frame string
 */
export function parseQRChunk(qrString: string): {
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
  fileType: string;
  chunkData: string;
} | null {
  if (!qrString.startsWith('AG1|')) {
    return null;
  }

  try {
    const parts = qrString.split('|');
    if (parts.length < 7) return null;

    const [, fileId, idxStr, totalStr, nameEnc, typeEnc, ...chunkParts] = parts;
    const chunkData = chunkParts.join('|'); // Rejoin in case base64 had pipe

    return {
      fileId,
      chunkIndex: parseInt(idxStr, 10),
      totalChunks: parseInt(totalStr, 10),
      fileName: decodeURIComponent(nameEnc),
      fileType: decodeURIComponent(typeEnc),
      chunkData,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Format bytes to readable size in Persian / English
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i] || 'بایت'}`;
}
