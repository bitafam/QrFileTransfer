import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  Download,
  Lock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  File,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  SwitchCamera,
  ArrowRight,
  WifiOff,
  Check,
  Layers,
  Sparkles,
} from 'lucide-react';
import { scanVideoFrame, scanImageFile, playSuccessChime } from '../utils/qrScanner';
import { parseQRChunk, reassembleFile, formatBytes } from '../utils/chunking';
import { HistoryItem } from '../types/transfer';

interface ReceiverViewProps {
  onAddHistory: (item: HistoryItem) => void;
  initialTransferId?: string | null;
}

export const ReceiverView: React.FC<ReceiverViewProps> = ({
  onAddHistory,
  initialTransferId,
}) => {
  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Scanning State for Optical Offline Chunk Stream
  const [offlineTransferId, setOfflineTransferId] = useState<string | null>(null);
  const [totalChunksNeeded, setTotalChunksNeeded] = useState<number | null>(null);
  const [collectedChunks, setCollectedChunks] = useState<Map<number, string>>(new Map());
  const [offlineFileName, setOfflineFileName] = useState<string>('فایل_دریافتی');
  const [offlineFileType, setOfflineFileType] = useState<string>('application/octet-stream');
  const [assembledFile, setAssembledFile] = useState<{
    fileName: string;
    fileType: string;
    dataUrl: string;
    fileSize: number;
  } | null>(null);

  // Cloud Transfer State
  const [manualCode, setManualCode] = useState('');
  const [scannedId, setScannedId] = useState<string | null>(initialTransferId || null);
  const [fileMeta, setFileMeta] = useState<any | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Auto-fetch metadata if opened via shared URL query string
  useEffect(() => {
    if (initialTransferId) {
      fetchFileMetadata(initialTransferId);
    }
  }, [initialTransferId]);

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    setCollectedChunks(new Map());
    setTotalChunksNeeded(null);
    setAssembledFile(null);
    setCameraActive(true);

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('دسترسی به دوربین با خطا مواجه شد. لطفا مجوز دوربین را بررسی کنید.');
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

  // Continuous Camera Scanning Loop
  useEffect(() => {
    if (!cameraActive) return;

    const tick = () => {
      if (videoRef.current && canvasRef.current) {
        const result = scanVideoFrame(videoRef.current, canvasRef.current);
        if (result && result.data) {
          const rawData = result.data.trim();

          // 1. Check if it's an Air-Gapped Optical Barcode Frame (starts with AG1|...)
          const parsed = parseQRChunk(rawData);
          if (parsed) {
            setOfflineFileName(parsed.fileName);
            setOfflineFileType(parsed.fileType);
            setTotalChunksNeeded(parsed.totalChunks);
            setOfflineTransferId(parsed.fileId);

            setCollectedChunks((prevMap: Map<number, string>) => {
              if (!prevMap.has(parsed.chunkIndex)) {
                // New chunk discovered!
                playSuccessChime();
                try {
                  navigator.vibrate?.(40);
                } catch (e) {}

                const nextMap = new Map<number, string>(prevMap);
                nextMap.set(parsed.chunkIndex, parsed.chunkData);

                // Check if all chunks received!
                if (nextMap.size === parsed.totalChunks) {
                  stopCamera();
                  try {
                    const dataUrl = reassembleFile(nextMap, parsed.totalChunks, parsed.fileType);
                    const approxSize = Math.round((dataUrl.length * 3) / 4);

                    const finalFile = {
                      fileName: parsed.fileName,
                      fileType: parsed.fileType,
                      dataUrl,
                      fileSize: approxSize,
                    };

                    setAssembledFile(finalFile);

                    // Add to History
                    onAddHistory({
                      id: parsed.fileId,
                      fileName: parsed.fileName,
                      fileType: parsed.fileType,
                      fileSize: approxSize,
                      timestamp: Date.now(),
                      role: 'received',
                      transferMode: 'airgapped',
                      dataUrl,
                    });

                    // Trigger browser file download automatically
                    const a = document.createElement('a');
                    a.href = dataUrl;
                    a.download = parsed.fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  } catch (e: any) {
                    alert('خطا در بازسازی فایل آفلاین');
                  }
                }
                return nextMap;
              }
              return prevMap;
            });
          } else {
            // 2. Standard Web/Cloud QR barcode
            playSuccessChime();
            stopCamera();
            handleScannedData(rawData);
            return;
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

  // Parse standard QR string / transfer URL
  const handleScannedData = (data: string) => {
    let id = data.trim();
    if (data.includes('transfer=')) {
      try {
        const urlObj = new URL(data);
        id = urlObj.searchParams.get('transfer') || id;
      } catch (e) {
        const match = data.match(/transfer=([A-Za-z0-9]+)/);
        if (match) id = match[1];
      }
    }
    setScannedId(id);
    fetchFileMetadata(id);
  };

  // Fetch Cloud File Meta
  const fetchFileMetadata = async (id: string) => {
    setFetchingMeta(true);
    setPinError(null);
    setFileMeta(null);
    setFileDataUrl(null);

    try {
      const res = await fetch(`/api/transfer/${id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'کد فایل معتبر نیست یا منقضی شده است');
      }

      setFileMeta(data);
    } catch (err: any) {
      alert(err.message || 'خطا در یافتن فایل');
    } finally {
      setFetchingMeta(false);
    }
  };

  // Gallery image file scan
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const data = await scanImageFile(e.target.files[0]);
        if (data) {
          const parsed = parseQRChunk(data);
          if (parsed) {
            playSuccessChime();
            const map = new Map<number, string>();
            map.set(parsed.chunkIndex, parsed.chunkData);
            if (parsed.totalChunks === 1) {
              const dataUrl = reassembleFile(map, 1, parsed.fileType);
              setAssembledFile({
                fileName: parsed.fileName,
                fileType: parsed.fileType,
                dataUrl,
                fileSize: Math.round((dataUrl.length * 3) / 4),
              });
            } else {
              setTotalChunksNeeded(parsed.totalChunks);
              setCollectedChunks(map);
              startCamera(); // Continue scanning remaining frames
            }
          } else {
            playSuccessChime();
            handleScannedData(data);
          }
        } else {
          alert('هیچ بارکدی در تصویر یافت نشد');
        }
      } catch (err: any) {
        alert(err.message || 'خوانش تصویر با خطا مواجه شد');
      }
    }
  };

  // Download cloud payload
  const handleDownloadCloudFile = async () => {
    if (!fileMeta) return;

    setDownloading(true);
    setPinError(null);

    try {
      const res = await fetch(`/api/download/${fileMeta.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setPinError('رمز عبور وارد شده اشتباه است');
          setDownloading(false);
          return;
        }
        throw new Error(data.error || 'خطا در دریافت فایل');
      }

      setFileDataUrl(data.fileData);
      setDownloadSuccess(true);

      onAddHistory({
        id: fileMeta.id,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
        timestamp: Date.now(),
        role: 'received',
        transferMode: 'cloud',
        dataUrl: data.fileData,
      });

      const a = document.createElement('a');
      a.href = data.fileData;
      a.download = data.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'خطا هنگام دریافت فایل');
    } finally {
      setDownloading(false);
    }
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
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <canvas ref={canvasRef} className="hidden" />

      {assembledFile ? (
        /* Assembled Offline File View */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl max-w-xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/20">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-white">فایل با موفقیت بازسازی شد!</h2>
            <p className="text-xs text-slate-400 mt-1">
              اطلاعات بدون استفاده از اینترنت و مستقیماً از بارکد خوانده و سرهم شد.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-4 text-right">
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              {getFileIcon(assembledFile.fileType)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white truncate dir-ltr">{assembledFile.fileName}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{formatBytes(assembledFile.fileSize)}</p>
            </div>
          </div>

          {/* Media Preview */}
          {assembledFile.fileType.startsWith('image/') && (
            <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 p-2">
              <img src={assembledFile.dataUrl} alt="Preview" className="w-full max-h-64 object-contain rounded-xl" />
            </div>
          )}

          {assembledFile.fileType.startsWith('text/') && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 max-h-48 overflow-y-auto text-right">
              <p className="text-xs text-slate-300 whitespace-pre-wrap font-sans">
                {atob(assembledFile.dataUrl.split(',')[1] || '')}
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <a
              href={assembledFile.dataUrl}
              download={assembledFile.fileName}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>ذخیره مجدد فایل</span>
            </a>

            <button
              onClick={() => {
                setAssembledFile(null);
                setTotalChunksNeeded(null);
                setCollectedChunks(new Map());
                startCamera();
              }}
              className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all"
            >
              اسکن فایل جدید
            </button>
          </div>
        </div>
      ) : fileMeta ? (
        /* Cloud Scanned File View */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
            <button
              onClick={() => {
                setFileMeta(null);
                setScannedId(null);
              }}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5"
            >
              <ArrowRight className="w-4 h-4" />
              <span>بازگشت به اسکن مجدد</span>
            </button>
            <span className="text-xs font-mono bg-slate-950 border border-slate-800 px-3 py-1 rounded-full text-sky-400">
              کد فایل: {fileMeta.id}
            </span>
          </div>

          <div className="max-w-xl mx-auto space-y-6">
            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20">
                {getFileIcon(fileMeta.fileType)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white truncate dir-ltr">{fileMeta.fileName}</h3>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span>حجم: {formatBytes(fileMeta.fileSize)}</span>
                  <span>•</span>
                  <span>نوع: {fileMeta.fileType.split('/')[1] || 'فایل'}</span>
                </div>
              </div>
            </div>

            {fileMeta.hasPin && !downloadSuccess && (
              <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                  <Lock className="w-4 h-4" />
                  <span>این فایل با رمز عبور حفاظت شده است</span>
                </div>
                <input
                  type="password"
                  placeholder="رمز عبور ۴ رقمی"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-center text-white outline-none focus:border-amber-400 font-mono"
                />
                {pinError && <p className="text-xs text-rose-400 text-center">{pinError}</p>}
              </div>
            )}

            {!downloadSuccess ? (
              <button
                onClick={handleDownloadCloudFile}
                disabled={downloading || (fileMeta.hasPin && !pinInput.trim())}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 font-bold text-base text-white shadow-xl shadow-sky-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {downloading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>در حال دریافت...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>دریافت و ذخیره فایل</span>
                  </>
                )}
              </button>
            ) : (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-400">فایل با موفقیت دریافت و ذخیره شد!</h4>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Camera Scanner & Controls */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Camera className="w-6 h-6 text-indigo-400" />
                اسکن بارکد و سرهم کردن دیتا
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                دوربین گوشی را مقابل بارکد فرستنده بگیرید تا قطعات فایل خوانده و سرهم شوند.
              </p>
            </div>
          </div>

          {/* Camera Viewport */}
          <div className="relative rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video max-w-xl mx-auto flex flex-col items-center justify-center">
            {cameraActive ? (
              <div className="relative w-full h-full">
                <video ref={videoRef} className="w-full h-full object-cover" />

                {/* Target Scan Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-56 h-56 border-2 border-indigo-400 rounded-3xl relative shadow-[0_0_30px_rgba(99,102,241,0.3)] animate-pulse">
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-400 rounded-tl-xl" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-400 rounded-tr-xl" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-400 rounded-bl-xl" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-400 rounded-br-xl" />

                    <div className="w-full h-0.5 bg-indigo-400 shadow-[0_0_10px_#6366f1] absolute top-1/2 -translate-y-1/2 animate-bounce" />
                  </div>
                </div>

                {/* Live Progress Header when scanning multi-chunk stream */}
                {totalChunksNeeded && (
                  <div className="absolute top-3 left-3 right-3 bg-slate-950/90 backdrop-blur-md p-3 rounded-2xl border border-indigo-500/40 space-y-2 shadow-2xl">
                    <div className="flex items-center justify-between text-xs text-white">
                      <span className="font-bold text-indigo-300 flex items-center gap-1">
                        <WifiOff className="w-3.5 h-3.5 text-indigo-400" />
                        در حال خوانش فریم‌های بارکد...
                      </span>
                      <span className="font-mono bg-indigo-600/30 px-2 py-0.5 rounded-full text-indigo-200">
                        {collectedChunks.size} از {totalChunksNeeded} فریم ({Math.round((collectedChunks.size / totalChunksNeeded) * 100)}٪)
                      </span>
                    </div>

                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
                        style={{ width: `${(collectedChunks.size / totalChunksNeeded) * 100}%` }}
                      />
                    </div>

                    {/* Frame grid indicators */}
                    <div className="flex flex-wrap gap-1 pt-1 max-h-16 overflow-y-auto">
                      {Array.from({ length: totalChunksNeeded }, (_, i) => i + 1).map((idx) => (
                        <div
                          key={idx}
                          className={`w-5 h-5 rounded-md text-[9px] font-mono flex items-center justify-center font-bold ${
                            collectedChunks.has(idx)
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {idx}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Camera controls */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-2 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/50">
                  <button
                    onClick={() => {
                      setFacingMode(facingMode === 'environment' ? 'user' : 'environment');
                      startCamera();
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5"
                  >
                    <SwitchCamera className="w-4 h-4" />
                    <span className="hidden sm:inline">سلفی / اصلی</span>
                  </button>

                  <button
                    onClick={stopCamera}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-bold"
                  >
                    بستن دوربین
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center border border-indigo-500/20">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">دوربین آماده اسکن بارکد</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    جهت خواندن بارکد فرستنده و دریافت مستقیم فایل، دکمه زیر را فشار دهید.
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

          {/* Fallback File/Gallery Upload & Manual Code */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-slate-800">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">بارگذاری عکس بارکد</h4>
                  <p className="text-[11px] text-slate-400">عکس بارکد از گالری</p>
                </div>
              </div>

              <label className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer border border-slate-700">
                <span>انتخاب عکس</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-2">
              <input
                type="text"
                placeholder="کد ۶ رقمی ابری"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-mono"
              />
              <button
                onClick={() => {
                  if (manualCode.trim()) {
                    handleScannedData(manualCode.trim());
                  }
                }}
                disabled={fetchingMeta || !manualCode.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50 shrink-0"
              >
                {fetchingMeta ? 'بررسی...' : 'ورود'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
