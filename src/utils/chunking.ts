import { AirGappedChunk } from '../types/transfer';

export const CHUNK_DENSITY_OPTIONS = [
  { id: 'standard', label: 'عادی (۶۰۰ کاراکتر)', size: 600, desc: 'خوانش آسان در تمام دوربین‌ها' },
  { id: 'fast', label: 'سریع (۱۲۰۰ کاراکتر)', size: 1200, desc: 'سرعت ۲ برابری، مناسب اکثر دوربین‌ها' },
  { id: 'ultra', label: 'خیلی سریع (۱۸۰۰ کاراکتر)', size: 1800, desc: 'سرعت ۳ برابری، نیاز به کیفیت مناسب' },
  { id: 'max', label: 'حداکثر (۲۴۰۰ کاراکتر)', size: 2400, desc: 'انتقال سریع فایل‌های حجیم و فیلم' },
];

export const DEFAULT_CHUNK_SIZE = 1200;

/**
 * Compress raw string using native browser CompressionStream (gzip)
 */
export async function compressString(str: string): Promise<{ data: string; isCompressed: boolean }> {
  try {
    if (typeof CompressionStream !== 'undefined') {
      const stream = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
      const response = new Response(stream);
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const compressedBase64 = btoa(binary);

      // Only use compressed if it actually saved space
      if (compressedBase64.length < str.length) {
        return { data: compressedBase64, isCompressed: true };
      }
    }
  } catch (e) {
    console.warn('Gzip compression fallback:', e);
  }
  return { data: str, isCompressed: false };
}

/**
 * Decompress string using native browser DecompressionStream (gzip)
 */
export async function decompressString(dataStr: string, isCompressed: boolean): Promise<string> {
  if (!isCompressed) return dataStr;

  try {
    const binaryStr = atob(dataStr);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const response = new Response(stream);
    return await response.text();
  } catch (e) {
    console.error('Decompression error:', e);
    throw new Error('خطا در خارج‌سازی فایل از حالت فشرده');
  }
}

/**
 * Split base64 file data into array of QR encoded strings for offline transfer
 */
export async function encodeFileToQRChunks(
  fileName: string,
  fileType: string,
  base64Data: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): Promise<{ frames: string[]; isCompressed: boolean; originalSize: number; compressedSize: number }> {
  const fileId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const originalSize = base64Data.length;

  // Compress payload
  const { data: processedData, isCompressed } = await compressString(base64Data);
  const compressedSize = processedData.length;

  const totalChunks = Math.ceil(processedData.length / chunkSize);
  const frames: string[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunk = processedData.slice(i * chunkSize, (i + 1) * chunkSize);
    // Format: AG2|ID|INDEX|TOTAL|COMPRESSED_FLAG|NAME|TYPE|CHUNK
    const compFlag = isCompressed ? '1' : '0';
    const payload = `AG2|${fileId}|${i + 1}|${totalChunks}|${compFlag}|${encodeURIComponent(fileName)}|${encodeURIComponent(fileType)}|${chunk}`;
    frames.push(payload);
  }

  return { frames, isCompressed, originalSize, compressedSize };
}

export interface ParsedChunk {
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  isCompressed: boolean;
  fileName: string;
  fileType: string;
  chunkData: string;
}

/**
 * Parse an Air-Gapped QR frame string (Supports AG1 legacy and AG2 compressed)
 */
export function parseQRChunk(qrString: string): ParsedChunk | null {
  if (!qrString) return null;

  try {
    // Check for AG2 format
    if (qrString.startsWith('AG2|')) {
      const parts = qrString.split('|');
      if (parts.length < 8) return null;

      const [, fileId, idxStr, totalStr, compFlag, nameEnc, typeEnc, ...chunkParts] = parts;
      const chunkData = chunkParts.join('|');

      const chunkIndex = parseInt(idxStr, 10);
      const totalChunks = parseInt(totalStr, 10);

      if (isNaN(chunkIndex) || isNaN(totalChunks) || chunkIndex <= 0 || totalChunks <= 0) {
        return null;
      }

      return {
        fileId,
        chunkIndex,
        totalChunks,
        isCompressed: compFlag === '1',
        fileName: decodeURIComponent(nameEnc),
        fileType: decodeURIComponent(typeEnc),
        chunkData,
      };
    }

    // Check for legacy AG1 format
    if (qrString.startsWith('AG1|')) {
      const parts = qrString.split('|');
      if (parts.length < 7) return null;

      const [, fileId, idxStr, totalStr, nameEnc, typeEnc, ...chunkParts] = parts;
      const chunkData = chunkParts.join('|');

      const chunkIndex = parseInt(idxStr, 10);
      const totalChunks = parseInt(totalStr, 10);

      return {
        fileId,
        chunkIndex,
        totalChunks,
        isCompressed: false,
        fileName: decodeURIComponent(nameEnc),
        fileType: decodeURIComponent(typeEnc),
        chunkData,
      };
    }
  } catch (e) {
    return null;
  }

  return null;
}

/**
 * Reassemble collected base64 chunks into a Blob URL and base64 Data URL
 */
export async function reassembleFile(
  chunksMap: Map<number, string>,
  totalChunks: number,
  fileType: string,
  isCompressed: boolean
): Promise<{ dataUrl: string; blob: Blob; blobUrl: string }> {
  let combinedPayload = '';
  for (let i = 1; i <= totalChunks; i++) {
    const chunk = chunksMap.get(i);
    if (!chunk) {
      throw new Error(`فریم شماره ${i} مفقود است`);
    }
    combinedPayload += chunk;
  }

  // Decompress if needed
  const uncompressedBase64 = await decompressString(combinedPayload, isCompressed);
  const dataUrl = `data:${fileType};base64,${uncompressedBase64}`;

  // Convert base64 to Blob for robust downloading
  const blob = base64ToBlob(uncompressedBase64, fileType);
  const blobUrl = URL.createObjectURL(blob);

  return { dataUrl, blob, blobUrl };
}

/**
 * Convert base64 string directly to binary Blob
 */
export function base64ToBlob(base64: string, mimeType: string = 'application/octet-stream'): Blob {
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const byteCharacters = atob(cleanBase64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Robust file downloader using Object URL Blob
 */
export function triggerFileDownload(blobOrUrl: Blob | string, fileName: string, mimeType?: string) {
  try {
    let objectUrl: string;
    let createdBlob = false;

    if (blobOrUrl instanceof Blob) {
      objectUrl = URL.createObjectURL(blobOrUrl);
      createdBlob = true;
    } else if (blobOrUrl.startsWith('data:')) {
      const mime = mimeType || blobOrUrl.split(';')[0].slice(5);
      const blob = base64ToBlob(blobOrUrl, mime);
      objectUrl = URL.createObjectURL(blob);
      createdBlob = true;
    } else {
      objectUrl = blobOrUrl;
    }

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = objectUrl;
    a.download = fileName || 'downloaded_file';

    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      if (createdBlob) {
        URL.revokeObjectURL(objectUrl);
      }
    }, 20000);
  } catch (err) {
    console.error('Download error:', err);
    // Fallback: try opening in new tab
    if (typeof blobOrUrl === 'string') {
      window.open(blobOrUrl, '_blank');
    }
  }
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
