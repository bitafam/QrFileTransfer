import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  File,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  SwitchCamera,
  WifiOff,
  Share2,
  Eye,
  Check,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { scanVideoFrame, scanImageFile, playSuccessChime } from '../utils/qrScanner';
import {
  parseQRChunk,
  reassembleFile,
  formatBytes,
  triggerFileDownload,
  ParsedChunk,
} from '../utils/chunking';
import { HistoryItem } from '../types/transfer';

interface ReceiverViewProps {
  onAddHistory: (item: HistoryItem) => void;
}

export const ReceiverView: React.FC<ReceiverViewProps> = ({ onAddHistory }) => {
  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Scanning State for Optical Offline Chunk Stream
  const [offlineTransferId, setOfflineTransferId] = useState<string | null>(null);
  const [totalChunksNeeded, setTotalChunksNeeded] = useState<number | null>(null);
  const [isCompressed, setIsCompressed] = useState<boolean>(false);
  const [collectedChunks, setCollectedChunks] = useState<Map<number, string>>(new Map());
  const [offlineFileName, setOfflineFileName] = useState<string>('فایل_دریافتی');
  const [offlineFileType, setOfflineFileType] = useState<string>('application/octet-stream');

  // Assembled Result
  const [assembledFile, setAssembledFile] = useState<{
    fileName: string;
    fileType: string;
    dataUrl: string;
    blob: Blob;
    blobUrl: string;
    fileSize: number;
  } | null>(null);

  const [reassembling, setReassembling] = useState(false);
  const [downloadSaved, setDownloadSaved] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    setCameraActive(true);

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('دسترسی به دوربین با خطا مواجه شد. لطفا دسترسی دوربین مرورگر را فعال کنید.');
      setCameraActive(false);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Process a Scanned QR String Chunk
  const handleChunkScanned = async (parsed: ParsedChunk) => {
    setOfflineFileName(parsed.fileName);
    setOfflineFileType(parsed.fileType);
    setTotalChunksNeeded(parsed.totalChunks);
    setIsCompressed(parsed.isCompressed);
    setOfflineTransferId(parsed.fileId);

    setCollectedChunks((prevMap: Map<number, string>) => {
      if (!prevMap.has(parsed.chunkIndex)) {
        // Play success chime & vibrate
        playSuccessChime();
        try {
          navigator.vibrate?.(40);
        } catch (e) {}

        const nextMap = new Map<number, string>(prevMap);
        nextMap.set(parsed.chunkIndex, parsed.chunkData);

        // Check if all chunks received!
        if (nextMap.size === parsed.totalChunks) {
          stopCamera();
          triggerReassembly(nextMap, parsed.totalChunks, parsed.fileType, parsed.fileName, parsed.isCompressed, parsed.fileId);
        }
        return nextMap;
      }
      return prevMap;
    });
  };

  // Reassemble chunks into Blob & trigger download
  const triggerReassembly = async (
    chunksMap: Map<number, string>,
    totalChunks: number,
    fileType: string,
    fileName: string,
    compressed: boolean,
    fileId: string
  ) => {
    setReassembling(true);
    try {
      const { dataUrl, blob, blobUrl } = await reassembleFile(chunksMap, totalChunks, fileType, compressed);
      const approxSize = blob.size;

      const result = {
        fileName,
        fileType,
        dataUrl,
        blob,
        blobUrl,
        fileSize: approxSize,
      };

      setAssembledFile(result);

      // Save to History
      onAddHistory({
        id: fileId,
        fileName,
        fileType,
        fileSize: approxSize,
        timestamp: Date.now(),
        role: 'received',
        transferMode: 'airgapped',
        dataUrl,
      });

      // Auto trigger download
      triggerFileDownload(blob, fileName, fileType);
      setDownloadSaved(true);
    } catch (err: any) {
      alert(err.message || 'خطا در سرهم ساختن قطعات فایل');
    } finally {
      setReassembling(false);
    }
  };

  // Continuous Camera Scanning Loop
  useEffect(() => {
    if (!cameraActive) return;

    const tick = () => {
      if (videoRef.current && canvasRef.current) {
        const result = scanVideoFrame(videoRef.current, canvasRef.current);
        if (result && result.data) {
          const rawData = result.data.trim();
          const parsed = parseQRChunk(rawData);
          if (parsed) {
            handleChunkScanned(parsed);
          }
        }
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cameraActive]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Gallery image upload scan
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const data = await scanImageFile(e.target.files[0]);
        if (data) {
          const parsed = parseQRChunk(data);
          if (parsed) {
            handleChunkScanned(parsed);
          } else {
            alert('بارکد شناخته نشد. لطفاً از بارکدهای معتبر فایل‌رسان استفاده کنید.');
          }
        } else {
          alert('هیچ بارکدی در تصویر یافت نشد');
        }
      } catch (err: any) {
        alert(err.message || 'خوانش تصویر با خطا مواجه شد');
      }
    }
  };

  // Manual save trigger
  const handleManualSave = () => {
    if (!assembledFile) return;
    triggerFileDownload(assembledFile.blob, assembledFile.fileName, assembledFile.fileType);
    setDownloadSaved(true);
  };

  // Web Share API
  const handleShare = async () => {
    if (!assembledFile) return;
    try {
      const fileObj = new File([assembledFile.blob], assembledFile.fileName, { type: assembledFile.fileType });
      if (navigator.canShare && navigator.canShare({ files: [fileObj] })) {
        await navigator.share({
          files: [fileObj],
          title: assembledFile.fileName,
        });
      } else {
        handleManualSave();
      }
    } catch (e) {
      handleManualSave();
    }
  };

  const resetAll = () => {
    setAssembledFile(null);
    setTotalChunksNeeded(null);
    setCollectedChunks(new Map());
    setDownloadSaved(false);
    startCamera();
  };

  const getFileIcon = (type?: string) => {
    if (!type) return <File className="w-8 h-8 text-indigo-400" />;
    if (type.startsWith('image/')) return <ImageIcon className="w-8 h-8 text-sky-400" />;
    if (type.startsWith('video/')) return <Video className="w-8 h-8 text-purple-400" />;
    if (type.startsWith('audio/')) return <Music className="w-8 h-8 text-emerald-400" />;
    if (type.includes('pdf') || type.includes('document'))
      return <FileText className="w-8 h-8 text-amber-400" />;
    return <File className="w-8 h-8 text-indigo-400" />;
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-8 animate-fade-in">
      <canvas ref={canvasRef} className="hidden" />

      {reassembling ? (
        /* Reassembling Loader */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl max-w-md mx-auto text-center space-y-4">
          <RefreshCw className="w-12 h-12 text-indigo-400 animate-spin mx-auto" />
          <h3 className="text-lg font-bold text-white">در حال از فشرده‌سازی و سرهم کردن قطعات فایل...</h3>
          <p className="text-xs text-slate-400">لطفا شکیبا باشید</p>
        </div>
      ) : assembledFile ? (
        /* Assembled Offline File Result Screen */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-8 shadow-2xl max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-lg sm:text-2xl font-bold text-white">فایل با موفقیت سرهم شد!</h2>
            <p className="text-xs text-slate-400">
              اطلاعات بدون نیاز به اینترنت و تماماً از طریق دوربین دستگاه خوانده شد.
            </p>
          </div>

          {/* File Card Info */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 shrink-0">
              {getFileIcon(assembledFile.fileType)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate dir-ltr">
                {assembledFile.fileName}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{formatBytes(assembledFile.fileSize)}</p>
            </div>
          </div>

          {/* Media Live Preview */}
          <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 p-2 max-h-80 flex items-center justify-center">
            {assembledFile.fileType.startsWith('image/') && (
              <img
                src={assembledFile.blobUrl}
                alt="Preview"
                className="max-h-72 object-contain rounded-xl w-full"
              />
            )}

            {assembledFile.fileType.startsWith('video/') && (
              <video
                src={assembledFile.blobUrl}
                controls
                className="max-h-72 rounded-xl w-full"
              />
            )}

            {assembledFile.fileType.startsWith('audio/') && (
              <audio src={assembledFile.blobUrl} controls className="w-full my-4" />
            )}

            {assembledFile.fileType.startsWith('text/') && (
              <div className="p-4 w-full max-h-60 overflow-y-auto text-right">
                <p className="text-xs text-slate-300 whitespace-pre-wrap font-sans">
                  {atob(assembledFile.dataUrl.split(',')[1] || '')}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons: Save & Share */}
          <div className="space-y-3">
            <button
              onClick={handleManualSave}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
            >
              {downloadSaved ? <Check className="w-5 h-5" /> : <Download className="w-5 h-5" />}
              <span>{downloadSaved ? 'فایل مجدداً ذخیره شد (دانلود مستقیم)' : 'ذخیره فایل در حافظه گوشی'}</span>
            </button>

            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4 text-sky-400" />
                <span>اشتراک‌گذاری فایل</span>
              </button>

              <button
                onClick={resetAll}
                className="flex-1 py-3 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-semibold text-xs border border-indigo-500/30 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>اسکن فایل جدید</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Camera Scanner & Controls */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Section Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                <Camera className="w-6 h-6 text-indigo-400" />
                اسکن بارکد و دریافت فایل
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                دوربین گوشی را مقابل بارکد فرستنده بگیرید تا فریم‌ها بخواند و سرهم شوند.
              </p>
            </div>
          </div>

          {/* Camera Viewport */}
          <div className="relative rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 aspect-square sm:aspect-video max-w-2xl mx-auto flex flex-col items-center justify-center">
            {cameraActive ? (
              <div className="relative w-full h-full">
                <video ref={videoRef} className="w-full h-full object-cover" />

                {/* Target Scan Overlay Frame */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                  <div className="w-52 h-52 sm:w-64 sm:h-64 border-2 border-indigo-400 rounded-3xl relative shadow-[0_0_40px_rgba(99,102,241,0.4)]">
                    <div className="absolute -top-1 -left-1 w-7 h-7 border-t-4 border-l-4 border-indigo-400 rounded-tl-2xl" />
                    <div className="absolute -top-1 -right-1 w-7 h-7 border-t-4 border-r-4 border-indigo-400 rounded-tr-2xl" />
                    <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-4 border-l-4 border-indigo-400 rounded-bl-2xl" />
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-4 border-r-4 border-indigo-400 rounded-br-2xl" />

                    <div className="w-full h-0.5 bg-indigo-400 shadow-[0_0_12px_#6366f1] absolute top-1/2 -translate-y-1/2 animate-bounce" />
                  </div>
                </div>

                {/* Live Progress Header when scanning multi-chunk stream */}
                {totalChunksNeeded && (
                  <div className="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 bg-slate-950/95 backdrop-blur-md p-3 rounded-2xl border border-indigo-500/40 space-y-2 shadow-2xl">
                    <div className="flex items-center justify-between text-xs text-white">
                      <span className="font-bold text-indigo-300 flex items-center gap-1 truncate max-w-[180px] sm:max-w-none">
                        <WifiOff className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        در حال اسکن {offlineFileName}...
                      </span>
                      <span className="font-mono bg-indigo-600/40 px-2 py-0.5 rounded-full text-indigo-200 shrink-0">
                        {collectedChunks.size} از {totalChunksNeeded} فریم ({Math.round((collectedChunks.size / totalChunksNeeded) * 100)}٪)
                      </span>
                    </div>

                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
                        style={{ width: `${(collectedChunks.size / totalChunksNeeded) * 100}%` }}
                      />
                    </div>

                    {/* Frame matrix grid */}
                    <div className="flex flex-wrap gap-1 pt-1 max-h-16 overflow-y-auto">
                      {Array.from({ length: totalChunksNeeded }, (_, i) => i + 1).map((idx) => (
                        <div
                          key={idx}
                          className={`w-6 h-6 rounded-md text-[10px] font-mono flex items-center justify-center font-bold transition-all ${
                            collectedChunks.has(idx)
                              ? 'bg-emerald-500 text-slate-950 shadow-sm scale-105'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {idx}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Camera controls bar */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-2 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-slate-800">
                  <button
                    onClick={() => {
                      setFacingMode(facingMode === 'environment' ? 'user' : 'environment');
                      startCamera();
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5"
                  >
                    <SwitchCamera className="w-4 h-4" />
                    <span className="hidden sm:inline">چرخش دوربین</span>
                  </button>

                  <button
                    onClick={stopCamera}
                    className="px-3 py-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-bold"
                  >
                    بستن دوربین
                  </button>
                </div>
              </div>
            ) : (
              /* Idle Camera State */
              <div className="p-6 sm:p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center border border-indigo-500/20">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">دوربین آماده اسکن</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    جهت دریافت مستقیم فایل، دکمه زیر را بزنید و دوربین را جلوی بارکدهای فرستنده بگیرید.
                  </p>
                </div>

                <button
                  onClick={startCamera}
                  className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center gap-2 mx-auto"
                >
                  <Camera className="w-5 h-5" />
                  <span>شروع اسکن با دوربین</span>
                </button>
              </div>
            )}
          </div>

          {cameraError && <p className="text-xs text-rose-400 text-center mt-3">{cameraError}</p>}

          {/* Gallery Image Upload Fallback */}
          <div className="mt-6 pt-6 border-t border-slate-800">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-200">اسکن عکس بارکد از گالری</h4>
                  <p className="text-[11px] text-slate-400">اگر عکس بارکد را ذخیره کرده‌اید</p>
                </div>
              </div>

              <label className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer border border-slate-700">
                <span>انتخاب تصویر</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
