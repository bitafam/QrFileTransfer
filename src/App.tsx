import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { SenderView } from './components/SenderView';
import { ReceiverView } from './components/ReceiverView';
import { AirGappedView } from './components/AirGappedView';
import { HistoryView } from './components/HistoryView';
import { HowItWorksModal } from './components/HowItWorksModal';
import { TransferMode, HistoryItem } from './types/transfer';
import { QrCode, Shield, Sparkles } from 'lucide-react';

export default function App() {
  const [mode, setMode] = useState<TransferMode>('sender');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [initialTransferId, setInitialTransferId] = useState<string | null>(null);
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

    // Check if opened via scanned QR URL query string e.g. /?transfer=TR-8F92
    const params = new URLSearchParams(window.location.search);
    const transferParam = params.get('transfer');
    if (transferParam) {
      setInitialTransferId(transferParam);
      setMode('receiver');
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-slate-950 dir-rtl">
      {/* Header Navigation */}
      <Navbar
        currentMode={mode}
        onModeChange={setMode}
        onOpenGuide={() => setIsGuideOpen(true)}
        historyCount={history.length}
      />

      {/* Main App Content View */}
      <main className="flex-1 pb-16">
        {mode === 'sender' && <SenderView onAddHistory={handleAddHistory} />}
        {mode === 'receiver' && (
          <ReceiverView
            onAddHistory={handleAddHistory}
            initialTransferId={initialTransferId}
          />
        )}
        {mode === 'airgapped' && <AirGappedView onAddHistory={handleAddHistory} />}
        {mode === 'history' && (
          <HistoryView history={history} onClearHistory={handleClearHistory} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-sky-400" />
            <span>انتقال مستقیم فایل با اسکن بارکد QR و دوربین دستگاه</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              بدون ذخیره دائمی روی سرور
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              سرعت بالاتر نسبت به بلوتوث
            </span>
          </div>
        </div>
      </footer>

      {/* Interactive Guide Modal */}
      <HowItWorksModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
}
