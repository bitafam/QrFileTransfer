import React from 'react';
import { TransferMode } from '../types/transfer';
import {
  Send,
  Camera,
  QrCode,
  History,
  HelpCircle,
  Zap,
  CheckCircle2,
} from 'lucide-react';

interface NavbarProps {
  currentMode: TransferMode;
  onModeChange: (mode: TransferMode) => void;
  onOpenGuide: () => void;
  historyCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onModeChange,
  onOpenGuide,
  historyCount,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 p-0.5 shadow-md shadow-sky-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <QrCode className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold bg-gradient-to-r from-sky-400 via-indigo-300 to-white bg-clip-text text-transparent">
                  فایل‌رسان بارکدی
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Zap className="w-3 h-3 ml-1 text-sky-400" />
                  آنی و امن
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                انتقال سریع فایل بین دو دستگاه با اسکن بارکد
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => onModeChange('sender')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                currentMode === 'sender'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>ارسال فایل</span>
            </button>

            <button
              onClick={() => onModeChange('receiver')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                currentMode === 'receiver'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>اسکن و دریافت</span>
            </button>

            <button
              onClick={() => onModeChange('airgapped')}
              className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                currentMode === 'airgapped'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <QrCode className="w-4 h-4 text-indigo-400" />
              <span>آفلاین (Air-Gapped)</span>
            </button>

            <button
              onClick={() => onModeChange('history')}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                currentMode === 'history'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">تاریخچه</span>
              {historyCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-sky-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                  {historyCount}
                </span>
              )}
            </button>
          </nav>

          {/* Help & Guide Button */}
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs sm:text-sm font-medium transition-all"
            title="راهنمای کار با برنامه"
          >
            <HelpCircle className="w-4 h-4 text-sky-400" />
            <span className="hidden md:inline">راهنما</span>
          </button>
        </div>
      </div>
    </header>
  );
};
