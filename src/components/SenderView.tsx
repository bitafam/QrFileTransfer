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
  Link2,
} from 'lucide-react';
import { generateQRCodeDataUrl, defaultQRSettings } from '../utils/qrGenerator';
import { formatBytes } from '../utils/chunking';
import { QRSettings, HistoryItem } from '../types/transfer';

interface SenderViewProps {
  onAddHistory: (item: HistoryItem) => void;
}

export const SenderView: React.FC<SenderViewProps> = ({ onAddHistory }) => {
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState('');
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [pin, setPin] = useState('');
  const [usePin, setUsePin] = useState(false);

  const [loading, setLoading] = useState(false);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [transferUrl, setTransferUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [qrSettings, setQrSettings] = useState<QRSettings>(defaultQRSettings);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [copied, setCopied] = useState(false);

  const [status, setStatus] = useState<'waiting' | 'downloaded'>('waiting');
  const [downloads, setDownloads] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<any>(null);

  // Poll for receiver status when transferId is active
  useEffect(() => {
    if (!transferId) return;

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
      } catch (e) {
        // Ignore polling error
      }
    };

    pollIntervalRef.current = setInterval(checkStatus, 2500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [transferId]);

  // Regenerate QR Code when settings change or transferUrl changes
  useEffect(() => {
    if (transferUrl) {
      generateQRCodeDataUrl(transferUrl, qrSettings).then(setQrDataUrl);
    }
  }, [transferUrl, qrSettings]);

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Convert File to Base64 and Upload to Server
  const handleGenerateQR = async () => {
    setLoading(true);
    try {
      let fileName = 'متن ارسالی.txt';
      let fileType = 'text/plain';
      let fileSize = 0;
      let fileData = '';

      if (activeTab === 'file' && file) {
        fileName = file.name;
        fileType = file.type || 'application/octet-stream';
        fileSize = file.size;

        fileData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else if (activeTab === 'text' && textInput.trim()) {
        fileName = 'پیام_متنی.txt';
        fileType = 'text/plain';
        fileSize = new Blob([textInput]).size;
        fileData = `data:text/plain;base64,${btoa(unescape(encodeURIComponent(textInput)))}`;
      } else {
        alert('لطفا یک فایل انتخاب کنید یا متنی وارد نمایید');
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
      // Absolute URL for the QR code scan
      const baseUrl = window.location.origin;
      const fullUrl = `${baseUrl}/?transfer=${id}`;

      setTransferId(id);
      setTransferUrl(fullUrl);
      setStatus('waiting');
      setDownloads(0);

      // Render QR
      const qrUrl = await generateQRCodeDataUrl(fullUrl, qrSettings);
      setQrDataUrl(qrUrl);

      // Add to History
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
      alert(err.message || 'خطایی در تولید بارکد رخ داد');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!transferUrl) return;
    navigator.clipboard.writeText(transferUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR_${transferId || 'transfer'}.png`;
    link.click();
  };

  const handleReset = () => {
    setFile(null);
    setTextInput('');
    setTransferId(null);
    setTransferUrl(null);
    setQrDataUrl(null);
    setStatus('waiting');
  };

  // Helper for file type icon
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-8 h-8 text-sky-400" />;
    if (type.startsWith('video/')) return <Video className="w-8 h-8 text-purple-400" />;
    if (type.startsWith('audio/')) return <Music className="w-8 h-8 text-emerald-400" />;
    if (type.includes('pdf') || type.includes('document'))
      return <FileText className="w-8 h-8 text-amber-400" />;
    return <File className="w-8 h-8 text-sky-400" />;
  };

  // Sample quick test generator
  const handleQuickSample = (sampleType: 'text' | 'image') => {
    if (sampleType === 'text') {
      setActiveTab('text');
      setTextInput('سلام! این یک پیام آزمایشی برای انتقال سریع بین دو دستگاه است 🚀');
    } else {
      setActiveTab('file');
      // Create a small SVG canvas sample image
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(0, 0, 200, 200);
        ctx.fillStyle = '#ffffff';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('عکس نمونه 📸', 100, 100);
      }
      canvas.toBlob((blob) => {
        if (blob) {
          const sampleFile = new File([blob], 'تصویر_نمونه.png', { type: 'image/png' });
          setFile(sampleFile);
        }
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      {!qrDataUrl ? (
        /* Upload & Settings Card */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <QrCode className="w-6 h-6 text-sky-400" />
                تولید بارکد جهت ارسال فایل
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                فایل مورد نظر را انتخاب کنید تا بارکد اسکن برای دستگاه دیگر آماده شود.
              </p>
            </div>

            {/* Quick Test Buttons */}
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-slate-500">تست سریع:</span>
              <button
                onClick={() => handleQuickSample('text')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition-colors"
              >
                متن آزمایشی
              </button>
              <button
                onClick={() => handleQuickSample('image')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition-colors"
              >
                عکس نمونه
              </button>
            </div>
          </div>

          {/* Type Selector Tabs */}
          <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-6 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === 'file'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <File className="w-4 h-4" />
              <span>فایل / عکس / ویدیو</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === 'text'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>ارسال متن / لینک</span>
            </button>
          </div>

          {/* File Upload Zone */}
          {activeTab === 'file' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-2xl p-8 sm:p-12 text-center bg-slate-950/50 hover:bg-slate-950 transition-all cursor-pointer group relative"
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
              />

              {file ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20">
                    {getFileIcon(file.type)}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white dir-ltr">{file.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">{formatBytes(file.size)}</p>
                  </div>
                  <span className="text-xs text-sky-400 hover:underline mt-2">
                    جهت تغییر فایل کلیک کنید
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-slate-200">
                      فایل را کشیده و اینجا رها کنید
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      یا جهت انتخاب فایل از دستگاه کلیک کنید (تا حجم ۵۰ مگابایت)
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Text Input Zone */
            <div className="space-y-2">
              <label className="text-xs text-slate-400">متن، پیام یا لینک مورد نظر:</label>
              <textarea
                rows={5}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="متن، آدرس وب، رمز WiFi یا یادداشت خود را اینجا تایپ یا پیست کنید..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none resize-none"
              />
            </div>
          )}

          {/* Security PIN Option */}
          <div className="mt-6 p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-slate-200">
                  حفاظت با رمز عبور (PIN)
                </h4>
                <p className="text-[11px] text-slate-400">
                  دستگاه دریافت‌کننده برای باز کردن فایل باید کد ۴ رقمی را وارد کند.
                </p>
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

          {/* Submit Action */}
          <div className="mt-8">
            <button
              onClick={handleGenerateQR}
              disabled={loading || (activeTab === 'file' && !file) || (activeTab === 'text' && !textInput.trim())}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 font-bold text-base text-white shadow-xl shadow-sky-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>در حال آپلود و ساخت بارکد...</span>
                </>
              ) : (
                <>
                  <QrCode className="w-5 h-5" />
                  <span>تولید بارکد و دریافت کد اسکن</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Generated QR Code View */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* QR Code Container */}
            <div className="flex flex-col items-center">
              <div className="relative p-5 bg-white rounded-3xl shadow-2xl border-4 border-sky-500/30 group">
                {/* Live Pulse Indicator when waiting */}
                {status === 'waiting' && (
                  <div className="absolute -top-3 -right-3 px-3 py-1 bg-amber-500 text-slate-950 text-[10px] font-bold rounded-full shadow-lg flex items-center gap-1 animate-pulse">
                    <Clock className="w-3 h-3" />
                    <span>در انتظار اسکن...</span>
                  </div>
                )}

                {status === 'downloaded' && (
                  <div className="absolute -top-3 -right-3 px-3 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full shadow-lg flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>فایل دریافت شد!</span>
                  </div>
                )}

                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className="w-64 h-64 sm:w-72 sm:h-72 object-contain"
                />
              </div>

              {/* Transfer Code Badge */}
              <div className="mt-4 flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono">
                <span>کد فایل:</span>
                <span className="font-bold text-sky-400">{transferId}</span>
              </div>
            </div>

            {/* Transfer Details & Controls */}
            <div className="flex-1 w-full space-y-5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                    بارکد آماده اسکن است
                  </span>
                  <button
                    onClick={handleReset}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>فایل جدید</span>
                  </button>
                </div>

                <h3 className="text-xl font-bold text-white mt-1">
                  دوربین دستگاه دیگر را روبروی این بارکد بگیرید
                </h3>
              </div>

              {/* Status Box */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      status === 'downloaded'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400 animate-pulse'
                    }`}
                  >
                    {status === 'downloaded' ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <Clock className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">
                      {status === 'downloaded'
                        ? 'فایل با موفقیت روی دستگاه گیرنده ذخیره شد'
                        : 'دستگاه دوم را روشن کنید و بارکد را اسکن کنید'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {status === 'downloaded'
                        ? `تعداد دریافت‌ها: ${downloads} بار`
                        : 'این لینک تا ۳۰ دقیقه آینده معتبر است'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleCopyLink}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 border border-slate-700"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>لینک کپی شد</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-sky-400" />
                      <span>کپی لینک مستقیم</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadQR}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 border border-slate-700"
                >
                  <Download className="w-4 h-4 text-indigo-400" />
                  <span>ذخیره عکس بارکد</span>
                </button>
              </div>

              {/* Customizer Drawer Toggle */}
              <div className="pt-2">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="text-xs text-slate-400 hover:text-sky-400 flex items-center gap-1.5 transition-colors"
                >
                  <Palette className="w-4 h-4" />
                  <span>تغییر ظاهر و رنگ بارکد</span>
                </button>

                {showColorPicker && (
                  <div className="mt-3 p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">رنگ بارکد:</span>
                      <input
                        type="color"
                        value={qrSettings.fgColor}
                        onChange={(e) =>
                          setQrSettings({ ...qrSettings, fgColor: e.target.value })
                        }
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">رنگ پس‌زمینه:</span>
                      <input
                        type="color"
                        value={qrSettings.bgColor}
                        onChange={(e) =>
                          setQrSettings({ ...qrSettings, bgColor: e.target.value })
                        }
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
