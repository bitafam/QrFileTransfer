import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Camera,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  Download,
  Zap,
  WifiOff,
  FileText,
  Upload,
} from 'lucide-react';
import { generateQRCodeDataUrl } from '../utils/qrGenerator';
import { encodeFileToQRChunks, parseQRChunk, formatBytes } from '../utils/chunking';
import { scanVideoFrame, playSuccessChime } from '../utils/qrScanner';
import { HistoryItem } from '../types/transfer';

interface AirGappedViewProps {
  onAddHistory: (item: HistoryItem) => void;
}

export const AirGappedView: React.FC<AirGappedViewProps> = ({ onAddHistory }) => {
  const [subTab, setSubTab] = useState<'send' | 'receive'>('send');

  // Sender state
  const [textInput, setTextInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [qrImages, setQrImages] = useState<string[]>([]);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [encoding, setEncoding] = useState(false);

  // Receiver state
  const [cameraActive, setCameraActive] = useState(false);
  const [collectedChunks, setCollectedChunks] = useState<Map<number, string>>(new Map());
  const [totalChunksNeeded, setTotalChunksNeeded] = useState<number | null>(null);
  const [assembledFile, setAssembledFile] = useState<{
    fileName: string;
    fileType: string;
    dataUrl: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const intervalRef = useRef<any>(null);

  // Rotate QR frames for multi-chunk transmission
  useEffect(() => {
    if (qrImages.length <= 1 || !isPlaying) return;

    intervalRef.current = setInterval(() => {
      setCurrentFrameIdx((prev) => (prev + 1) % qrImages.length);
    }, 400); // 400ms per frame

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [qrImages, isPlaying]);

  // Generate Air-Gapped Chunks
  const handleGenerateAirGappedQR = async () => {
    setEncoding(true);
    setQrImages([]);

    try {
      let fileName = 'پیام_آفلاین.txt';
      let fileType = 'text/plain';
      let base64Data = '';

      if (file) {
        fileName = file.name;
        fileType = file.type || 'application/octet-stream';
        const fileData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        base64Data = fileData.split(',')[1] || '';
      } else if (textInput.trim()) {
        fileName = 'متن_آفلاین.txt';
        fileType = 'text/plain';
        base64Data = btoa(unescape(encodeURIComponent(textInput)));
      } else {
        alert('لطفا متنی وارد کرده یا فایلی انتخاب کنید');
        setEncoding(false);
        return;
      }

      const generatedFrames = encodeFileToQRChunks(fileName, fileType, base64Data);
      setFrames(generatedFrames);

      // Render all frame images
      const images: string[] = [];
      for (const frame of generatedFrames) {
        const imgUrl = await generateQRCodeDataUrl(frame, { size: 300, level: 'L' });
        images.push(imgUrl);
      }

      setQrImages(images);
      setCurrentFrameIdx(0);
      setIsPlaying(true);
    } catch (err: any) {
      alert('خطا در رمزنگاری آفلاین بارکد');
    } finally {
      setEncoding(false);
    }
  };

  // Start Camera Scanning for Receiver
  const startCamera = async () => {
    setCollectedChunks(new Map());
    setTotalChunksNeeded(null);
    setAssembledFile(null);
    setCameraActive(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      alert('دسترسی به دوربین ناموفق بود');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Frame processing loop for receiver
  useEffect(() => {
    if (!cameraActive) return;

    const tick = () => {
      if (videoRef.current && canvasRef.current) {
        const res = scanVideoFrame(videoRef.current, canvasRef.current);
        if (res && res.data) {
          const parsed = parseQRChunk(res.data);
          if (parsed) {
            setTotalChunksNeeded(parsed.totalChunks);

            setCollectedChunks((prev) => {
              if (!prev.has(parsed.chunkIndex)) {
                playSuccessChime();
                const nextMap = new Map(prev);
                nextMap.set(parsed.chunkIndex, parsed.chunkData);

                // Check if all chunks collected!
                if (nextMap.size === parsed.totalChunks) {
                  stopCamera();
                  // Assemble file
                  let fullBase64 = '';
                  for (let i = 1; i <= parsed.totalChunks; i++) {
                    fullBase64 += nextMap.get(i) || '';
                  }

                  const dataUrl = `data:${parsed.fileType};base64,${fullBase64}`;
                  setAssembledFile({
                    fileName: parsed.fileName,
                    fileType: parsed.fileType,
                    dataUrl,
                  });

                  onAddHistory({
                    id: parsed.fileId,
                    fileName: parsed.fileName,
                    fileType: parsed.fileType,
                    fileSize: Math.round((fullBase64.length * 3) / 4),
                    timestamp: Date.now(),
                    role: 'received',
                    transferMode: 'airgapped',
                    dataUrl,
                  });
                }
                return nextMap;
              }
              return prev;
            });
          }
        }
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [cameraActive]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <canvas ref={canvasRef} className="hidden" />

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <WifiOff className="w-6 h-6 text-indigo-400" />
              انتقال مستقیم بارکدی (بدون اینترنت / Air-Gapped)
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              محتوا مستقیما داخل کد بارکد قرار گرفته و بدون هیچ سروری منتقل می‌شود.
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-6 max-w-xs mx-auto">
          <button
            onClick={() => {
              setSubTab('send');
              stopCamera();
            }}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              subTab === 'send' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'
            }`}
          >
            ارسال آفلاین
          </button>
          <button
            onClick={() => setSubTab('receive')}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              subTab === 'receive' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'
            }`}
          >
            دریافت با دوربین
          </button>
        </div>

        {subTab === 'send' ? (
          /* Sender Tab */
          <div className="space-y-6">
            {qrImages.length === 0 ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400">متن یا یادداشت کوتاه:</label>
                  <textarea
                    rows={4}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="متن یا یادداشت کوتاهی که می‌خواهید آفلاین به دستگاه دیگر بفرستید..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="text-center text-xs text-slate-500">یا انتخاب فایل کوچک:</div>

                <div className="flex justify-center">
                  <label className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500 text-slate-300 text-xs font-medium cursor-pointer flex items-center gap-2">
                    <Upload className="w-4 h-4 text-indigo-400" />
                    <span>{file ? file.name : 'انتخاب فایل (تا ۵۰ کیلوبایت)'}</span>
                    <input
                      type="file"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>

                <button
                  onClick={handleGenerateAirGappedQR}
                  disabled={encoding || (!textInput.trim() && !file)}
                  className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                >
                  {encoding ? 'در حال رمزگذاری بارکد...' : 'ساخت بارکد مستقیم آفلاین'}
                </button>
              </div>
            ) : (
              /* Animated QR Display */
              <div className="flex flex-col items-center space-y-4">
                <div className="relative p-4 bg-white rounded-3xl border-4 border-indigo-500/30 shadow-2xl">
                  <img
                    src={qrImages[currentFrameIdx]}
                    alt="Animated QR"
                    className="w-64 h-64 object-contain"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-indigo-400 font-mono">
                    فریم {currentFrameIdx + 1} از {qrImages.length}
                  </span>

                  {qrImages.length > 1 && (
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                  )}

                  <button
                    onClick={() => setQrImages([])}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                  >
                    تغییر متن
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Receiver Tab */
          <div className="space-y-6 text-center">
            {!assembledFile ? (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video max-w-md mx-auto flex items-center justify-center">
                  {cameraActive ? (
                    <video ref={videoRef} className="w-full h-full object-cover" />
                  ) : (
                    <div className="p-6">
                      <Camera className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
                      <button
                        onClick={startCamera}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium text-xs shadow-lg"
                      >
                        شروع اسکن آفلاین
                      </button>
                    </div>
                  )}
                </div>

                {totalChunksNeeded && (
                  <div className="max-w-xs mx-auto space-y-2">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>پیشرفت دریافت:</span>
                      <span>
                        {collectedChunks.size} از {totalChunksNeeded} فریم
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full transition-all duration-300"
                        style={{
                          width: `${(collectedChunks.size / totalChunksNeeded) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Assembled File Result */
              <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4 animate-fade-in max-w-md mx-auto">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="text-lg font-bold text-white">فایل آفلاین بازسازی شد!</h3>
                <p className="text-xs text-slate-400">{assembledFile.fileName}</p>

                <a
                  href={assembledFile.dataUrl}
                  download={assembledFile.fileName}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>ذخیره فایل</span>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
