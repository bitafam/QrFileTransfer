import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

interface StoredFile {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData: string; // Base64 data URL
  createdAt: number;
  expiresAt: number;
  pin?: string;
  downloads: number;
  status: 'waiting' | 'downloaded';
  lastDownloadedAt?: number;
}

const memoryStore = new Map<string, StoredFile>();

// Clean up expired files every 5 minutes (files expire after 30 mins)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, file] of memoryStore.entries()) {
    if (file.expiresAt < now) {
      memoryStore.delete(id);
    }
  }
}, 5 * 60 * 1000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

export function apiPlugin(): Plugin {
  return {
    name: 'api-file-transfer-plugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = req.url || '';

        // Helper to parse JSON body
        const parseJsonBody = (): Promise<any> => {
          return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
              // Prevent huge payloads over 100MB
              if (body.length > 100 * 1024 * 1024) {
                req.destroy();
                reject(new Error('Payload too large'));
              }
            });
            req.on('end', () => {
              try {
                resolve(body ? JSON.parse(body) : {});
              } catch (e) {
                reject(e);
              }
            });
            req.on('error', reject);
          });
        };

        const sendJson = (statusCode: number, data: any) => {
          res.statusCode = statusCode;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(data));
        };

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.end();
          return;
        }

        // Endpoint: Upload File / Staging
        if (url === '/api/upload' && req.method === 'POST') {
          try {
            const body = await parseJsonBody();
            const { fileName, fileType, fileSize, fileData, pin } = body;

            if (!fileName || !fileData) {
              return sendJson(400, { error: 'نام فایل و محتوا الزامی است' });
            }

            // Generate short 8-char transfer ID e.g. "8F9A3B12"
            const transferId = Math.random().toString(36).substring(2, 10).toUpperCase();
            const now = Date.now();
            const storedFile: StoredFile = {
              id: transferId,
              fileName: fileName || 'file',
              fileType: fileType || 'application/octet-stream',
              fileSize: fileSize || 0,
              fileData,
              createdAt: now,
              expiresAt: now + 30 * 60 * 1000, // 30 minutes TTL
              pin: pin || undefined,
              downloads: 0,
              status: 'waiting',
            };

            memoryStore.set(transferId, storedFile);

            return sendJson(200, {
              success: true,
              transferId,
              expiresAt: storedFile.expiresAt,
            });
          } catch (err: any) {
            return sendJson(500, { error: err.message || 'خطا در بارگذاری فایل' });
          }
        }

        // Endpoint: Get File Metadata
        if (url.startsWith('/api/transfer/') && req.method === 'GET') {
          const transferId = url.replace('/api/transfer/', '').trim();
          const file = memoryStore.get(transferId);

          if (!file) {
            return sendJson(404, { error: 'فایل یافت نشد یا منقضی شده است' });
          }

          return sendJson(200, {
            id: file.id,
            fileName: file.fileName,
            fileType: file.fileType,
            fileSize: file.fileSize,
            createdAt: file.createdAt,
            expiresAt: file.expiresAt,
            hasPin: Boolean(file.pin),
            downloads: file.downloads,
            status: file.status,
          });
        }

        // Endpoint: Download / Fetch File Content
        if (url.startsWith('/api/download/') && req.method === 'POST') {
          try {
            const transferId = url.replace('/api/download/', '').trim();
            const file = memoryStore.get(transferId);

            if (!file) {
              return sendJson(404, { error: 'فایل یافت نشد یا منقضی شده است' });
            }

            const body = await parseJsonBody();
            if (file.pin && body.pin !== file.pin) {
              return sendJson(401, { error: 'رمز عبور وارد شده اشتباه است' });
            }

            file.downloads += 1;
            file.status = 'downloaded';
            file.lastDownloadedAt = Date.now();

            return sendJson(200, {
              success: true,
              fileName: file.fileName,
              fileType: file.fileType,
              fileSize: file.fileSize,
              fileData: file.fileData,
            });
          } catch (err: any) {
            return sendJson(500, { error: err.message || 'خطا در دریافت فایل' });
          }
        }

        // Endpoint: Status Check for Sender
        if (url.startsWith('/api/status/') && req.method === 'GET') {
          const transferId = url.replace('/api/status/', '').trim();
          const file = memoryStore.get(transferId);

          if (!file) {
            return sendJson(404, { error: 'فایل منقضی شده است' });
          }

          return sendJson(200, {
            status: file.status,
            downloads: file.downloads,
            lastDownloadedAt: file.lastDownloadedAt,
          });
        }

        next();
      });
    },
  };
}
