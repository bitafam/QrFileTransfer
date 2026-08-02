import { AirGappedChunk } from '../types/transfer';

// Default chunk size (approx 650 chars for optimal mobile camera readability at high FPS)
export const DEFAULT_CHUNK_SIZE = 650;

/**
 * Split base64 file data into array of QR encoded strings for offline transfer
 */
export function encodeFileToQRChunks(
  fileName: string,
  fileType: string,
  base64Data: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): string[] {
  const fileId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const dataLength = base64Data.length;
  const totalChunks = Math.ceil(dataLength / chunkSize);

  const frames: string[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunk = base64Data.slice(i * chunkSize, (i + 1) * chunkSize);
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
  if (!qrString || !qrString.startsWith('AG1|')) {
    return null;
  }

  try {
    const parts = qrString.split('|');
    if (parts.length < 7) return null;

    const [, fileId, idxStr, totalStr, nameEnc, typeEnc, ...chunkParts] = parts;
    const chunkData = chunkParts.join('|'); // Rejoin in case payload contained pipe

    const chunkIndex = parseInt(idxStr, 10);
    const totalChunks = parseInt(totalStr, 10);

    if (isNaN(chunkIndex) || isNaN(totalChunks) || chunkIndex <= 0 || totalChunks <= 0) {
      return null;
    }

    return {
      fileId,
      chunkIndex,
      totalChunks,
      fileName: decodeURIComponent(nameEnc),
      fileType: decodeURIComponent(typeEnc),
      chunkData,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Reassemble collected base64 chunks into a data URL
 */
export function reassembleFile(
  chunksMap: Map<number, string>,
  totalChunks: number,
  fileType: string
): string {
  let fullBase64 = '';
  for (let i = 1; i <= totalChunks; i++) {
    const chunk = chunksMap.get(i);
    if (!chunk) {
      throw new Error(`فریم شماره ${i} مفقود است`);
    }
    fullBase64 += chunk;
  }
  return `data:${fileType};base64,${fullBase64}`;
}

/**
 * Format bytes to readable size in Persian
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 بایت';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i] || 'بایت'}`;
}
