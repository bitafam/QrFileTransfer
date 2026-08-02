import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  File,
  Lock,
  Copy,
  Check,
  Download,
  Palette,
  RefreshCw,
  QrCode,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  CheckCircle2,
  Clock,
  Sparkles,
  WifiOff,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Maximize2,
  Minimize2,
  Sliders,
  Zap,
  Globe,
} from 'lucide-react';
import { generateQRCodeDataUrl, defaultQRSettings } from '../utils/qrGenerator';
import { encodeFileToQRChunks, formatBytes } from '../utils/chunking';
import { QRSettings, HistoryItem } from '../types/transfer';

interface SenderViewProps {
  onAddHistory: (item: HistoryItem) => void;
}

export const SenderView: React.FC<SenderViewProps> = ({ onAddHistory }) => {
  // Primary transfer strategy: 'offline' (Optical Barcode) or 'cloud' (Server Link)
  const [strategy, setStrategy] = useState<'offline' | 'cloud'>('offline');

  // Input state
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState('');
  const [inputTab, setInputTab] = useState<'file' | 'text'>('file');

  // Offline / Air-Gapped Barcode State
  const [encoding, setEncoding] = useState(false);
  const [frames, setFrames] = useState<string[]>([]);
  const [qrImages, setQrImages] = useState<string[]>([]);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [fps, setFps] = useState(3); // 3 FPS default (333ms) for clear camera capture
  const [isMaximized, setIsMaximized] = useState(false);

  // Cloud Transfer State
  const [usePin, setUsePin] = useState(false);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [transferUrl, setTransferUrl] = useState<string | null>(null);
  const [cloudQrUrl, setCloudQrUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'waiting' | 'downloaded'>('waiting');
  const [downloads, setDownloads] = useState(0);
  const [copied, setCopied] = useState(false);

  // Styling & Customization
  const [qrSettings, setQrSettings] = useState<QRSettings>(defaultQRSettings);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<any>(null);
  const pollIntervalRef = useRef<any>(null);

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

  // Poll for cloud transfer status
  useEffect(() => {
    if (!transferId || strategy !== 'cloud') return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/status/${transferId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'downloaded') {
            setStatus('downloaded');
            setDownloads(data.downloads || 1);
          }
        }
      } catch (e) {}
    };

    pollIntervalRef.current = setInterval(checkStatus, 2500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [transferId, strategy]);

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

      // Chunk file into encoded payload strings
      const generatedFrames = encodeFileToQRChunks(fileName, fileType, base64Data);
      setFrames(generatedFrames);

      // Render QR images for all frames
      const images: string[] = [];
      for (const framePayload of generatedFrames) {
        const imgUrl = await generateQRCodeDataUrl(framePayload, {
          ...qrSettings,
          includeLogo: generatedFrames.length > 1 ? false : qrSettings.includeLogo, // Remove logo on multi-chunk for max optical readability
          level: 'M',
          size: 400,
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

  // Generate Cloud QR Link
  const handleGenerateCloudQR = async () => {
    setLoading(true);
    try {
      let fileName = 'متن_ارسالی.txt';
      let fileType = 'text/plain';
      let fileSize = 0;
      let fileData = '';

      if (inputTab === 'file' && file) {
        fileName = file.name;
        fileType = file.type || 'application/octet-stream';
        fileSize = file.size;

        fileData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else if (inputTab === 'text' && textInput.trim()) {
        fileName = 'پیام_متنی.txt';
        fileType = 'text/plain';
        fileSize = new Blob([textInput]).size;
        fileData = `data:text/plain;base64,${btoa(unescape(encodeURIComponent(textInput)))}`;
      } else {
        alert('لطفا فایلی انتخاب کنید یا متنی وارد نمایید');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          fileType,
          fileSize,
          fileData,
          pin: usePin && pin.trim() ? pin.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'خطا در آپلود فایل');

      const id = data.transferId;
      const baseUrl = window.location.origin;
      const fullUrl = `${baseUrl}/?transfer=${id}`;

      setTransferId(id);
      setTransferUrl(fullUrl);
      setStatus('waiting');
      setDownloads(0);

      const qrUrl = await generateQRCodeDataUrl(fullUrl, qrSettings);
      setCloudQrUrl(qrUrl);

      onAddHistory({
        id,
        fileName,
        fileType,
        fileSize,
        timestamp: Date.now(),
        role: 'sent',
        transferMode: 'cloud',
        dataUrl: fileData,
      });
    } catch (err: any) {
      alert(err.message || 'خطایی در ساخت بارکد رخ داد');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setTextInput('');
    setQrImages([]);
    setFrames([]);
    setCloudQrUrl(null);
    setTransferId(null);
    setTransferUrl(null);
    setStatus('waiting');
  };

  const handleQuickSample = (sampleType: 'text' | 'image') => {
    if (sampleType === 'text') {
      setInputTab('text');
      setTextInput('سلام! این یک پیام متنی آزمایشی برای انتقال سریع آفلاین با اسکن بارکد است 🚀');
    } else {
      setInputTab('file');
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#4f46e5';
        ctx.fillRect(0, 0, 200, 200);
        ctx.fillStyle = '#ffffff';
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('عکس آفلاین 📸', 100, 100);
      }
      canvas.toBlob((blob) => {
        if (blob) {
          const sampleFile = new File([blob], 'تصویر_نمونه.png', { type: 'image/png' });
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
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      {/* Primary Method Switcher: Offline Barcode vs Cloud Link */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <QrCode className="w-6 h-6 text-sky-400" />
              تبدیل فایل به بارکد جهت ارسال
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              روش ارسال مورد نظر خود را انتخاب کنید و بارکد را مقابل دوربین گوشی گیرنده بگیرید.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">تست سریع:</span>
            <button
              onClick={() => handleQuickSample('text')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition-colors"
            >
              متن نمونه
            </button>
            <button
              onClick={() => handleQuickSample('image')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition-colors"
            >
              عکس نمونه
            </button>
          </div>
        </div>

        {/* Strategy Selector Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 p-1.5 bg-slate-950 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setStrategy('offline');
              handleReset();
            }}
            className={`p-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              strategy === 'offline'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <WifiOff className="w-4 h-4 text-indigo-300" />
            <div className="text-right">
              <div>انتقال مستقیم با اسکن دوربین (۱۰۰٪ آفلاین)</div>
              <div className="text-[10px] font-normal text-indigo-200">بدون مصرف اینترنت / مستقیم از روی صفحه</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setStrategy('cloud');
              handleReset();
            }}
            className={`p-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              strategy === 'cloud'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30 ring-1 ring-sky-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4 text-sky-300" />
            <div className="text-right">
              <div>انتقال با لینک ابری (آنلاین)</div>
              <div className="text-[10px] font-normal text-sky-200">مناسب فایل‌های بزرگتر / با کد کوتاه</div>
            </div>
          </button>
        </div>

        {/* Output Area: If Barcode generated */}
        {strategy === 'offline' && qrImages.length > 0 ? (
          /* Animated Optical Barcode Player */
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col items-center justify-center bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-inner">
              <div
                className={`relative p-4 sm:p-6 bg-white rounded-3xl border-4 border-indigo-500/40 shadow-2xl transition-all ${
                  isMaximized ? 'fixed inset-4 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-xl border-none p-4' : ''
                }`}
              >
                <img
                  src={qrImages[currentFrameIdx]}
                  alt="QR Frame"
                  className={`object-contain transition-all ${
                    isMaximized ? 'w-full max-w-lg h-auto max-h-[75vh]' : 'w-64 h-64 sm:w-80 sm:h-80'
                  }`}
                />

                <div className="mt-3 text-center">
                  <span className="text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-full border border-slate-300 shadow-sm font-mono dir-ltr">
                    فریم {currentFrameIdx + 1} از {qrImages.length}
                  </span>
                </div>

                {isMaximized && (
                  <button
                    onClick={() => setIsMaximized(false)}
                    className="absolute top-4 right-4 p-2.5 rounded-full bg-slate-800 text-white hover:bg-slate-700"
                  >
                    <Minimize2 className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Multi-frame Controls & Speed Slider */}
              {qrImages.length > 1 && (
                <div className="w-full max-w-md mt-6 space-y-4">
                  {/* Progress Indicator Bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                    {qrImages.map((_, idx) => (
                      <div
                        key={idx}
                        className={`flex-1 h-full transition-all border-r border-slate-950 ${
                          idx === currentFrameIdx
                            ? 'bg-indigo-400'
                            : idx < currentFrameIdx
                            ? 'bg-indigo-700'
                            : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Play / Pause / Step Controls */}
                  <div className="flex items-center justify-between bg-slate-900 px-4 py-2 rounded-2xl border border-slate-800">
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

                    {/* FPS Slider */}
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      <span>سرعت ({fps} فریم/ثانیه):</span>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        value={fps}
                        onChange={(e) => setFps(parseInt(e.target.value, 10))}
                        className="w-20 accent-indigo-500 cursor-pointer"
                      />
                    </div>

                    {/* Full Screen Toggle */}
                    <button
                      onClick={() => setIsMaximized(!isMaximized)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="بزرگنمایی تصویر بارکد"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="mt-6 text-center space-y-2 max-w-md">
                <p className="text-xs sm:text-sm text-indigo-300 font-semibold flex items-center justify-center gap-1.5">
                  <WifiOff className="w-4 h-4 text-indigo-400" />
                  این بارکد حاوی کل اطلاعات فایل است و نیازی به سرور ندارد.
                </p>
                <p className="text-xs text-slate-400">
                  دوربین گوشی دیگر را روی این بارکد بگیرید. پس از خواندن فریم‌ها، فایل به طور خودکار بازسازی و دانلود می‌شود.
                </p>
              </div>

              <div className="mt-4">
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
        ) : strategy === 'cloud' && cloudQrUrl ? (
          /* Cloud QR Display */
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col lg:flex-row items-center gap-8 bg-slate-950 p-6 rounded-3xl border border-slate-800">
              <div className="flex flex-col items-center">
                <div className="relative p-4 bg-white rounded-3xl shadow-2xl border-4 border-sky-500/30">
                  <img src={cloudQrUrl} alt="Cloud QR" className="w-64 h-64 object-contain" />
                </div>
                <div className="mt-3 flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono">
                  <span>کد دریافت:</span>
                  <span className="font-bold text-sky-400">{transferId}</span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-sky-400">بارکد ابری آنلاین</span>
                  <button onClick={handleReset} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>فایل جدید</span>
                  </button>
                </div>

                <h3 className="text-lg font-bold text-white">
                  دوربین دستگاه دیگر را روبروی این بارکد بگیرید
                </h3>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${status === 'downloaded' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400 animate-pulse'}`}>
                    {status === 'downloaded' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                  </div>
                  <div className="text-xs">
                    <div className="font-semibold text-slate-200">
                      {status === 'downloaded' ? 'فایل توسط گیرنده دریافت شد!' : 'در انتظار اسکن بارکد...'}
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      {status === 'downloaded' ? `تعداد دانلود: ${downloads}` : 'لینک تا ۳۰ دقیقه معتبر است'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (transferUrl) {
                      navigator.clipboard.writeText(transferUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all flex items-center justify-center gap-2 border border-slate-700"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-sky-400" />}
                  <span>{copied ? 'لینک کپی شد' : 'کپی لینک مستقیم'}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* File / Text Input Form */
          <div className="space-y-6">
            {/* Input Type Selector */}
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setInputTab('file')}
                className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  inputTab === 'file' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <File className="w-4 h-4" />
                <span>فایل / عکس / سند</span>
              </button>
              <button
                type="button"
                onClick={() => setInputTab('text')}
                className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  inputTab === 'text' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>ارسال متن / یادداشت</span>
              </button>
            </div>

            {/* Input Dropzone / Text Area */}
            {inputTab === 'file' ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-8 sm:p-12 text-center bg-slate-950/50 hover:bg-slate-950 transition-all cursor-pointer group relative"
              >
                <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />

                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                      {getFileIcon(file.type)}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white dir-ltr">{file.name}</h3>
                      <p className="text-xs text-slate-400 mt-1">{formatBytes(file.size)}</p>
                    </div>
                    <span className="text-xs text-indigo-400 hover:underline mt-2">جهت تغییر فایل کلیک کنید</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-base font-medium text-slate-200">فایل را انتخاب یا اینجا رها کنید</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {strategy === 'offline'
                          ? 'در حالت آفلاین، فایل مستقیما به بارکد تبدیل شده و با دوربین اسکن می‌شود'
                          : 'در حالت ابری، فایل روی سرور ذخیره می‌شود'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs text-slate-400">متن یا پیام مورد نظر:</label>
                <textarea
                  rows={5}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="متن، آدرس وب، رمز WiFi یا یادداشت خود را تایپ کنید..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>
            )}

            {/* Cloud PIN option if strategy === 'cloud' */}
            {strategy === 'cloud' && (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-amber-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-200">رمز عبور برای فایل (PIN)</h4>
                    <p className="text-[11px] text-slate-400">ورود کد ۴ رقمی توسط گیرنده جهت دریافت فایل</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={usePin}
                      onChange={(e) => setUsePin(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                  </label>

                  {usePin && (
                    <input
                      type="password"
                      maxLength={6}
                      placeholder="مثلا ۱۲۳۴"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-center text-xs text-white focus:border-sky-500 outline-none"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Generate Button */}
            <div>
              {strategy === 'offline' ? (
                <button
                  onClick={handleGenerateOfflineQR}
                  disabled={encoding || (inputTab === 'file' && !file) || (inputTab === 'text' && !textInput.trim())}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-bold text-base text-white shadow-xl shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {encoding ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>در حال ساخت بارکدهای مستقیم آفلاین...</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-5 h-5" />
                      <span>تبدیل به بارکد مستقیم آفلاین (بدون اینترنت)</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleGenerateCloudQR}
                  disabled={loading || (inputTab === 'file' && !file) || (inputTab === 'text' && !textInput.trim())}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 font-bold text-base text-white shadow-xl shadow-sky-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>در حال آپلود و ساخت لینک ابری...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-5 h-5" />
                      <span>تولید بارکد و لینک دانلود ابری</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
