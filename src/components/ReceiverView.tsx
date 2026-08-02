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
  Eye,
  SwitchCamera,
  Flashlight,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { scanVideoFrame, scanImageFile, playSuccessChime } from '../utils/qrScanner';
import { formatBytes } from '../utils/chunking';
import { HistoryItem } from '../types/transfer';

interface ReceiverViewProps {
  onAddHistory: (item: HistoryItem) => void;
  initialTransferId?: string | null;
}

export const ReceiverView: React.FC<ReceiverViewProps> = ({
  onAddHistory,
  initialTransferId,
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

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

  // Auto-fetch metadata if initialTransferId is provided via URL query string
  useEffect(() => {
    if (initialTransferId) {
      fetchFileMetadata(initialTransferId);
    }
  }, [initialTransferId]);

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
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
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS Safari
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

  // Continuous Camera Frame Scanning Loop
  useEffect(() => {
    if (!cameraActive) return;

    const tick = () => {
      if (videoRef.current && canvasRef.current) {
        const result = scanVideoFrame(videoRef.current, canvasRef.current);
        if (result && result.data) {
          playSuccessChime();
          stopCamera();
          handleScannedData(result.data);
          return;
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

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Parse scanned QR content
  const handleScannedData = (data: string) => {
    let id = data.trim();

    // If full URL e.g. https://domain.com/?transfer=8F9A3B
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

  // Fetch File Metadata from API
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

  // Handle Gallery QR Image Upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const data = await scanImageFile(e.target.files[0]);
        if (data) {
          playSuccessChime();
          handleScannedData(data);
        } else {
          alert('هیچ بارکد مشخصی در تصویر یافت نشد');
        }
      } catch (err: any) {
        alert(err.message || 'خوانش تصویر با خطا مواجه شد');
      }
    }
  };

  // Download File Payload
  const handleDownloadFile = async () => {
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

      // Save to History
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

      // Trigger automatic browser file download
      const a = document.createElement('a');
      a.href = data.fileData;
      a.download = data.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'خطای غیرمنتظره هنگام دریافت فایل');
    } finally {
      setDownloading(false);
    }
  };

  const getFileIcon = (type?: string) => {
    if (!type) return <File className="w-8 h-8 text-sky-400" />;
    if (type.startsWith('image/')) return <ImageIcon className="w-8 h-8 text-sky-400" />;
    if (type.startsWith('video/')) return <Video className="w-8 h-8 text-purple-400" />;
    if (type.startsWith('audio/')) return <Music className="w-8 h-8 text-emerald-400" />;
    if (type.includes('pdf') || type.includes('document'))
      return <FileText className="w-8 h-8 text-amber-400" />;
    return <File className="w-8 h-8 text-sky-400" />;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      {/* Hidden Canvas for QR Frame Processing */}
      <canvas ref={canvasRef} className="hidden" />

      {!fileMeta ? (
        /* Camera Scanner & Code Input View */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Camera className="w-6 h-6 text-sky-400" />
                اسکن بارکد و دریافت فایل
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                دوربین گوشی یا لپ‌تاپ را روبروی بارکد موجود در دستگاه فرستنده بگیرید.
              </p>
            </div>
          </div>

          {/* Camera Stream Area */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video max-w-xl mx-auto flex flex-col items-center justify-center">
            {cameraActive ? (
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                />

                {/* Target Scan Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-56 h-56 border-2 border-sky-400 rounded-2xl relative shadow-[0_0_30px_rgba(56,189,248,0.3)] animate-pulse">
                    {/* Corners */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-sky-400 rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-sky-400 rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-sky-400 rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-sky-400 rounded-br-lg" />

                    {/* Scanning Line */}
                    <div className="w-full h-0.5 bg-sky-400 shadow-[0_0_10px_#38bdf8] absolute top-1/2 -translate-y-1/2 animate-bounce" />
                  </div>
                </div>

                {/* Camera Control Buttons */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/50">
                  <button
                    onClick={() => {
                      setFacingMode(facingMode === 'environment' ? 'user' : 'environment');
                      startCamera();
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5"
                    title="تغییر دوربین"
                  >
                    <SwitchCamera className="w-4 h-4" />
                    <span className="hidden sm:inline">سلفی / اصلی</span>
                  </button>

                  <button
                    onClick={stopCamera}
                    className="px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-medium"
                  >
                    بستن دوربین
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-sky-500/10 text-sky-400 mx-auto flex items-center justify-center">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">دوربین خاموش است</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    جهت خواندن بارکد فرستنده، دکمه روشن کردن دوربین را بفشارید.
                  </p>
                </div>

                <button
                  onClick={startCamera}
                  className="px-6 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm shadow-lg shadow-sky-600/30 transition-all flex items-center gap-2 mx-auto"
                >
                  <Camera className="w-5 h-5" />
                  <span>روشن کردن دوربین و اسکن</span>
                </button>
              </div>
            )}
          </div>

          {cameraError && (
            <p className="text-xs text-rose-400 text-center mt-3">{cameraError}</p>
          )}

          {/* Alternative Scanner Options */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-slate-800">
            {/* Gallery Upload */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">
                    بارگذاری عکس بارکد
                  </h4>
                  <p className="text-[11px] text-slate-400">عکس بارکد را از گالری انتخاب کنید</p>
                </div>
              </div>

              <label className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer border border-slate-700">
                <span>انتخاب عکس</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Manual Code Input */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-2">
              <input
                type="text"
                placeholder="کد ۸ رقمی (مثلا TR-8F92)"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-sky-500 font-mono"
              />
              <button
                onClick={() => {
                  if (manualCode.trim()) {
                    handleScannedData(manualCode.trim());
                  }
                }}
                disabled={fetchingMeta || !manualCode.trim()}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all disabled:opacity-50 shrink-0"
              >
                {fetchingMeta ? 'بررسی...' : 'ورود'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Scanned File Found View */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
            <button
              onClick={() => {
                setFileMeta(null);
                setScannedId(null);
              }}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              <span>بازگشت به اسکن مجدد</span>
            </button>

            <span className="text-xs font-mono bg-slate-950 border border-slate-800 px-3 py-1 rounded-full text-sky-400">
              کد فایل: {fileMeta.id}
            </span>
          </div>

          <div className="max-w-xl mx-auto space-y-6">
            {/* File Info Card */}
            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20">
                {getFileIcon(fileMeta.fileType)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white truncate dir-ltr">
                  {fileMeta.fileName}
                </h3>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span>حجم: {formatBytes(fileMeta.fileSize)}</span>
                  <span>•</span>
                  <span>نوع: {fileMeta.fileType.split('/')[1] || 'فایل'}</span>
                </div>
              </div>
            </div>

            {/* PIN Protection Password Prompt */}
            {fileMeta.hasPin && !downloadSuccess && (
              <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                  <Lock className="w-4 h-4" />
                  <span>این فایل با رمز عبور حفاظت شده است</span>
                </div>
                <p className="text-xs text-slate-300">
                  فرستنده روی این فایل رمز عبور قرار داده است. کد ۴ رقمی را وارد کنید:
                </p>

                <input
                  type="password"
                  placeholder="رمز عبور را وارد کنید"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-center text-white outline-none focus:border-amber-400 font-mono"
                />

                {pinError && <p className="text-xs text-rose-400 text-center">{pinError}</p>}
              </div>
            )}

            {/* Download Action Button */}
            {!downloadSuccess ? (
              <button
                onClick={handleDownloadFile}
                disabled={downloading || (fileMeta.hasPin && !pinInput.trim())}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 font-bold text-base text-white shadow-xl shadow-sky-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {downloading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>در حال دریافت فایل...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>دریافت و ذخیره روی این دستگاه</span>
                  </>
                )}
              </button>
            ) : (
              /* Success & Preview Area */
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <h4 className="text-sm font-bold text-emerald-400">
                    فایل با موفقیت دریافت و ذخیره شد!
                  </h4>
                  <p className="text-xs text-slate-400">
                    فایل در پوشه دانلودهای دستگاه شما قرار گرفت.
                  </p>
                </div>

                {/* File Live Preview */}
                {fileDataUrl && fileMeta.fileType.startsWith('image/') && (
                  <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 p-2">
                    <img
                      src={fileDataUrl}
                      alt="پیش‌نمایش"
                      className="w-full max-h-80 object-contain rounded-xl"
                    />
                  </div>
                )}

                {fileDataUrl && fileMeta.fileType.startsWith('text/') && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 max-h-60 overflow-y-auto">
                    <p className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                      {atob(fileDataUrl.split(',')[1] || '')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
