import React from 'react';
import { TransferMode } from '../types/transfer';
import {
  Send,
  Camera,
  History,
  HelpCircle,
  Zap,
  WifiOff,
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
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-sky-400 p-0.5 shadow-md shadow-indigo-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <WifiOff className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-lg font-bold bg-gradient-to-r from-indigo-300 via-purple-200 to-white bg-clip-text text-transparent truncate">
                  فایل‌رسان بارکدی
                </h1>
                <span className="hidden xs:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  آفلاین
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">
                انتقال مستقیم فایل بین گوشی‌ها بدون اینترنت و سرور
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => onModeChange('sender')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                currentMode === 'sender'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>ارسال</span>
            </button>

            <button
              onClick={() => onModeChange('receiver')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                currentMode === 'receiver'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>دریافت</span>
            </button>

            <button
              onClick={() => onModeChange('history')}
              className={`relative flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                currentMode === 'history'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">تاریخچه</span>
              {historyCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-indigo-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                  {historyCount}
                </span>
              )}
            </button>
          </nav>

          {/* Help Button */}
          <button
            onClick={onOpenGuide}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition-all shrink-0"
            title="راهنما"
          >
            <HelpCircle className="w-4 h-4 text-indigo-400" />
          </button>
        </div>
      </div>
    </header>
  );
};
