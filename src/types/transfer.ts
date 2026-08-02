export type TransferMode = 'sender' | 'receiver' | 'airgapped' | 'history';

export interface TransferSession {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData?: string; // Data URL base64
  createdAt: number;
  expiresAt: number;
  hasPin: boolean;
  pin?: string;
  downloads: number;
  status: 'waiting' | 'scanning' | 'downloaded' | 'expired';
  lastDownloadedAt?: number;
}

export interface QRSettings {
  fgColor: string;
  bgColor: string;
  level: 'L' | 'M' | 'Q' | 'H';
  size: number;
  includeLogo: boolean;
}

export interface AirGappedChunk {
  index: number;
  total: number;
  data: string; // Base64 chunk
  fileName: string;
  fileType: string;
  checksum: string;
}

export interface HistoryItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  timestamp: number;
  role: 'sent' | 'received';
  transferMode: 'cloud' | 'airgapped';
  dataUrl?: string;
}
