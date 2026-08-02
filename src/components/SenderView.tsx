import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  File,
  RefreshCw,
  QrCode,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Maximize2,
  Minimize2,
  Sliders,
  Zap,
  WifiOff,
  Sparkles,
  Layers,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { generateQRCodeDataUrl, defaultQRSettings } from '../utils/qrGenerator';
import {
  encodeFileToQRChunks,
  formatBytes,
  CHUNK_DENSITY_OPTIONS,
} from '../utils/chunking';
import { HistoryItem } from '../types/transfer';

interface SenderViewProps {
  onAddHistory: (item: HistoryItem) => void;
}

export const SenderView: React.FC<SenderViewProps> = ({ onAddHistory }) => {
  // Input state
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState('');
  const [inputTab, setInputTab] = useState<'file' | 'text'>('file');

  // Barcode Stream Settings
  const [chunkSize, setChunkSize] = useState<number>(1200);
  const [ecLevel, setEcLevel] = useState<'L' | 'M'>('L');

  // Offline Optical Barcode State
  const [encoding, setEncoding] = useState(false);
  const [frames, setFrames] = useState<string[]>([]);
  const [qrImages, setQrImages] = useState<string[]>([]);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [fps, setFps] = useState(4); // Default 4 FPS (250ms per frame)
  const [isMaximized, setIsMaximized] = useState(false);

  // Compression Stats
  const [compStats, setCompStats] = useState<{
    originalSize: number;
    compressedSize: number;
    isCompressed: boolean;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<any>(null);

  // Handle Offline Animated QR rotation
  useEffect(() => {
    if (qrImages.length <= 1 || !isPlaying) return;

    const intervalMs = Math.round(1000 / fps);
    intervalRef.current = setInterval(() => {
      setCurrentFrameIdx((prev) => (prev + 1) % qrImages.length);
    }, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [qrImages, isPlaying, fps]);

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Generate Offline Optical QR Barcode Stream
  const handleGenerateOfflineQR = async () => {
    setEncoding(true);
    setQrImages([]);
    setCompStats(null);

    try {
      let fileName = 'پیام_آفلاین.txt';
      let fileType = 'text/plain';
      let fileSize = 0;
      let base64Data = '';

      if (inputTab === 'file' && file) {
        fileName = file.name;
        fileType = file.type || 'application/octet-stream';
        fileSize = file.size;

        const fileData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        base64Data = fileData.split(',')[1] || '';
      } else if (inputTab === 'text' && textInput.trim()) {
        fileName = 'متن_آفلاین.txt';
        fileType = 'text/plain';
        fileSize = new Blob([textInput]).size;
        base64Data = btoa(unescape(encodeURIComponent(textInput)));
      } else {
        alert('لطفا فایلی انتخاب کنید یا متنی وارد نمایید');
        setEncoding(false);
        return;
      }

      // Encode & Compress payload into chunks
      const {
        frames: generatedFrames,
        isCompressed,
        originalSize,
        compressedSize,
      } = await encodeFileToQRChunks(fileName, fileType, base64Data, chunkSize);

      setFrames(generatedFrames);
      setCompStats({ originalSize, compressedSize, isCompressed });

      // Render QR images for all frames
      const images: string[] = [];
      for (const framePayload of generatedFrames) {
        const imgUrl = await generateQRCodeDataUrl(framePayload, {
          level: ecLevel,
          size: 450,
          includeLogo: false, // Maximum contrast without logo obstruction
        });
        images.push(imgUrl);
      }

      setQrImages(images);
      setCurrentFrameIdx(0);
      setIsPlaying(true);

      // Save to History
      onAddHistory({
        id: Math.random().toString(36).substring(2, 8).toUpperCase(),
        fileName,
        fileType,
        fileSize,
        timestamp: Date.now(),
        role: 'sent',
        transferMode: 'airgapped',
      });
    } catch (err: any) {
      alert('خطا در تبدیل فایل به بارکد آفلاین');
    } finally {
      setEncoding(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setTextInput('');
    setQrImages([]);
    setFrames([]);
    setCompStats(null);
  };

  const handleQuickSample = (sampleType: 'text' | 'image') => {
    if (sampleType === 'text') {
      setInputTab('text');
      setTextInput('سلام! این یک پیام متنی آزمایشی برای انتقال مستقیم آفلاین با بارکد است 🚀');
    } else {
      setInputTab('file');
      const canvas = document.createElement('canvas');
      canvas.width = 250;
      canvas.height = 250;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#4f46e5';
        ctx.fillRect(0, 0, 250, 250);
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('عکس آفلاین 📸', 125, 125);
      }
      canvas.toBlob((blob) => {
        if (blob) {
          const sampleFile = new File([blob], 'تصویر_آفلاین.png', { type: 'image/png' });
          setFile(sampleFile);
        }
      });
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-8 h-8 text-sky-400" />;
    if (type.startsWith('video/')) return <Video className="w-8 h-8 text-purple-400" />;
    if (type.startsWith('audio/')) return <Music className="w-8 h-8 text-emerald-400" />;
    if (type.includes('pdf') || type.includes('document'))
      return <FileText className="w-8 h-8 text-amber-400" />;
    return <File className="w-8 h-8 text-sky-400" />;
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-8 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <WifiOff className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-2xl font-bold text-white">
                تبدیل فایل به بارکد و ارسال آفلاین
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              فایل‌های حجیم و ویدیوها را بدون اینترنت به بارکد تبدیل کرده و با دوربین منتقل کنید.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">تست نمونه:</span>
            <button
              onClick={() => handleQuickSample('text')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition-colors"
            >
              متن
            </button>
            <button
              onClick={() => handleQuickSample('image')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition-colors"
            >
              عکس
            </button>
          </div>
        </div>

        {/* Output Area: If Animated Barcode Streams Generated */}
        {qrImages.length > 0 ? (
          <div className="space-y-6 animate-fade-in">
            {/* Compression & Speed Stats */}
            {compStats && (
              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/50 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-indigo-300 font-medium">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>
                    فشرده‌سازی هوشمند: {compStats.isCompressed ? 'فعال (Gzip)' : 'عادی'}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-slate-300 font-mono dir-ltr">
                  <span>تعداد کل فریم‌ها: <strong className="text-white">{qrImages.length}</strong></span>
                  <span>تراکم: <strong className="text-indigo-400">{chunkSize} کاراکتر</strong></span>
                </div>
              </div>
            )}

            {/* Main Animated QR Display Container */}
            <div className="flex flex-col items-center justify-center bg-slate-950 p-4 sm:p-8 rounded-3xl border border-slate-800 shadow-inner">
              <div
                className={`relative p-3 sm:p-5 bg-white rounded-3xl border-4 border-indigo-500/50 shadow-2xl transition-all ${
                  isMaximized
                    ? 'fixed inset-2 sm:inset-6 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-2xl border-none p-4'
                    : ''
                }`}
              >
                <img
                  src={qrImages[currentFrameIdx]}
                  alt={`QR Frame ${currentFrameIdx + 1}`}
                  className={`object-contain transition-all ${
                    isMaximized
                      ? 'w-full max-w-lg h-auto max-h-[70vh]'
                      : 'w-60 h-60 sm:w-80 sm:h-80 md:w-96 md:h-96'
                  }`}
                />

                <div className="mt-3 text-center">
                  <span className="text-xs font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-full border border-slate-300 shadow-sm font-mono dir-ltr">
                    فریم {currentFrameIdx + 1} از {qrImages.length}
                  </span>
                </div>

                {isMaximized && (
                  <button
                    onClick={() => setIsMaximized(false)}
                    className="absolute top-4 right-4 p-3 rounded-full bg-slate-800 text-white hover:bg-slate-700"
                  >
                    <Minimize2 className="w-6 h-6" />
                  </button>
                )}
              </div>

              {/* Multi-Frame Timeline & Controls */}
              <div className="w-full max-w-lg mt-6 space-y-4">
                {/* Frame Progress Line */}
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                  {qrImages.map((_, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setCurrentFrameIdx(idx);
                        setIsPlaying(false);
                      }}
                      title={`نمایش فریم ${idx + 1}`}
                      className={`flex-1 h-full cursor-pointer transition-all border-r border-slate-950 ${
                        idx === currentFrameIdx
                          ? 'bg-indigo-400'
                          : idx < currentFrameIdx
                          ? 'bg-indigo-700'
                          : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                    />
                  ))}
                </div>

                {/* Player Controls */}
                <div className="flex flex-wrap items-center justify-between bg-slate-900 px-4 py-3 rounded-2xl border border-slate-800 gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentFrameIdx((prev) => (prev > 0 ? prev - 1 : qrImages.length - 1))}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
                      title="فریم قبلی"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                      title={isPlaying ? 'توقف پخش' : 'شروع پخش'}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => setCurrentFrameIdx((prev) => (prev + 1) % qrImages.length)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
                      title="فریم بعدی"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>

                  {/* FPS Speed Slider */}
                  {qrImages.length > 1 && (
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      <span>سرعت:</span>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={fps}
                        onChange={(e) => setFps(parseInt(e.target.value, 10))}
                        className="w-20 accent-indigo-500 cursor-pointer"
                      />
                      <span className="font-mono text-indigo-400 w-6 text-center">{fps}x</span>
                    </div>
                  )}

                  {/* Maximize Toggle */}
                  <button
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="بزرگنمایی بارکد"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Direct Frame Jump Selector Grid */}
                {qrImages.length > 1 && (
                  <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>انتخاب دستی فریم (در صورت جا ماندن فریم در دوربین):</span>
                      <span className="font-mono">{currentFrameIdx + 1} / {qrImages.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {qrImages.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setCurrentFrameIdx(idx);
                            setIsPlaying(false);
                          }}
                          className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all ${
                            idx === currentFrameIdx
                              ? 'bg-indigo-500 text-white ring-2 ring-indigo-300'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          {idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="mt-6 text-center space-y-2 max-w-md">
                <p className="text-xs sm:text-sm text-indigo-300 font-semibold flex items-center justify-center gap-1.5">
                  <WifiOff className="w-4 h-4 text-indigo-400" />
                  این بارکد ۱۰۰٪ آفلاین است و تمام دیتا داخل آن ذخیره شده.
                </p>
                <p className="text-xs text-slate-400">
                  دوربین گوشی گیرنده را روی تصویر بگیرید تا فریم‌ها بخواند و فایل بازسازی شود.
                </p>
              </div>

              <div className="mt-5">
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>انتخاب فایل یا متن جدید</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Input Form & Settings */
          <div className="space-y-6">
            {/* Input Type Selector */}
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setInputTab('file')}
                className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  inputTab === 'file' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <File className="w-4 h-4" />
                <span>فایل / ویدیو / عکس</span>
              </button>
              <button
                type="button"
                onClick={() => setInputTab('text')}
                className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  inputTab === 'text' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>متن / یادداشت</span>
              </button>
            </div>

            {/* Input Dropzone / Text Area */}
            {inputTab === 'file' ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-6 sm:p-10 text-center bg-slate-950/50 hover:bg-slate-950 transition-all cursor-pointer group relative"
              >
                <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />

                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                      {getFileIcon(file.type)}
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-white dir-ltr truncate max-w-xs sm:max-w-md">
                        {file.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">{formatBytes(file.size)}</p>
                    </div>
                    <span className="text-xs text-indigo-400 hover:underline mt-1">تغییر فایل</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-medium text-slate-200">
                        فایل را انتخاب یا اینجا رها کنید
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        پشتیبانی از انواع ویدیو، عکس، PDF، اسناد و هر نوع فایل
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs text-slate-400">متن یا پیام مورد نظر:</label>
                <textarea
                  rows={4}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="متن، آدرس وب، رمز WiFi یا یادداشت خود را تایپ کنید..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>
            )}

            {/* Chunk Density & Speed Configuration */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs sm:text-sm font-semibold text-slate-200">
                    تنظیم سرعت و تراکم بارکد:
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CHUNK_DENSITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setChunkSize(opt.size)}
                    className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 ${
                      chunkSize === opt.size
                        ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-slate-200">{opt.label}</span>
                      {chunkSize === opt.size && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                    </div>
                    <span className="text-[10px] text-slate-400">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Action Button */}
            <button
              onClick={handleGenerateOfflineQR}
              disabled={encoding || (inputTab === 'file' && !file) || (inputTab === 'text' && !textInput.trim())}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 font-bold text-sm sm:text-base text-white shadow-xl shadow-indigo-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {encoding ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>در حال فشرده‌سازی و ساخت بارکدهای مستقیم...</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-5 h-5" />
                  <span>ساخت بارکدهای مستقیم آفلاین (بدون اینترنت)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
