import React from 'react';
import { X, Smartphone, QrCode, Download, ShieldCheck, ArrowLeft, Wifi, Camera } from 'lucide-react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 text-white shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">راهنمای انتقال فایل با اسکن بارکد</h2>
            <p className="text-xs text-slate-400">نحوه اتصال دو دستگاه و جابجایی سریع فایل</p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-6">
          {/* Step 1 */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white font-bold flex items-center justify-center shrink-0 text-sm">
              ۱
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-sky-400" />
                در دستگاه اول (فرستنده): انتخاب فایل
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                در تب «ارسال فایل»، هر نوع فایلی (عکس، ویدیو، سند، PDF یا متن) را انتخاب کنید. برنامه بلافاصله یک بارکد (QR Code) اختصاصی برای فایل شما تولید می‌کند.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-sm">
              ۲
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-400" />
                در دستگاه دوم (گیرنده): اسکن بارکد با دوربین
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                در دستگاه دوم، وارد تب «اسکن و دریافت» شوید و دوربین گوشی یا لپ‌تاپ را روبروی بارکد موجود در صفحه دستگاه اول بگیرید.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-sm">
              ۳
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-400" />
                دریافت و ذخیره آنی فایل
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                به محض اسکن بارکد، مشخصات فایل نشان داده می‌شود و با یک کلیک فایل روی دستگاه دوم ذخیره می‌گردد. دستگاه اول نیز پیام موفقیت دریافت را مشاهده خواهد کرد.
              </p>
            </div>
          </div>
        </div>

        {/* Features highlight */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>پشتیبانی از رمزگذاری و PIN</span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-sky-400" />
            <span>حالت آفلاین (Direct Air-Gapped)</span>
          </div>
        </div>

        {/* Understand Button */}
        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 font-medium text-sm text-white shadow-lg shadow-sky-600/30 transition-all flex items-center justify-center gap-2"
          >
            <span>متوجه شدم، شروع کار</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
