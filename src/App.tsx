import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { SenderView } from './components/SenderView';
import { ReceiverView } from './components/ReceiverView';
import { HistoryView } from './components/HistoryView';
import { HowItWorksModal } from './components/HowItWorksModal';
import { TransferMode, HistoryItem } from './types/transfer';
import { QrCode, Shield, Sparkles, WifiOff } from 'lucide-react';

export default function App() {
  const [mode, setMode] = useState<TransferMode>('sender');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('qr_transfer_history');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      // Ignore storage error
    }
  }, []);

  // Save history to localStorage
  const handleAddHistory = (item: HistoryItem) => {
    setHistory((prev) => {
      const updated = [item, ...prev.filter((h) => h.id !== item.id)].slice(0, 30);
      try {
        localStorage.setItem('qr_transfer_history', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('qr_transfer_history');
    } catch (e) {}
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white dir-rtl">
      {/* Header Navigation */}
      <Navbar
        currentMode={mode}
        onModeChange={setMode}
        onOpenGuide={() => setIsGuideOpen(true)}
        historyCount={history.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {mode === 'sender' && <SenderView onAddHistory={handleAddHistory} />}
        {mode === 'receiver' && <ReceiverView onAddHistory={handleAddHistory} />}
        {mode === 'history' && (
          <HistoryView history={history} onClearHistory={handleClearHistory} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-indigo-400" />
            <span>انتقال ۱۰۰٪ آفلاین فایل با اسکن بارکد QR متحرک و دوربین گوشی</span>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              بدون نیاز به اینترنت و بدون ردپای ابری
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              فشرده‌سازی خودکار Gzip
            </span>
          </div>
        </div>
      </footer>

      {/* Interactive Guide Modal */}
      <HowItWorksModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
};
