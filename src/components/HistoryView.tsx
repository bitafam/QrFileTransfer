import React from 'react';
import { HistoryItem } from '../types/transfer';
import { formatBytes } from '../utils/chunking';
import {
  Send,
  Download,
  Trash2,
  File,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface HistoryViewProps {
  history: HistoryItem[];
  onClearHistory: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  onClearHistory,
}) => {
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-sky-400" />;
    if (type.startsWith('video/')) return <Video className="w-5 h-5 text-purple-400" />;
    if (type.startsWith('audio/')) return <Music className="w-5 h-5 text-emerald-400" />;
    if (type.includes('pdf') || type.includes('document'))
      return <FileText className="w-5 h-5 text-amber-400" />;
    return <File className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Clock className="w-6 h-6 text-sky-400" />
              تاریخچه فایل‌های ارسالی و دریافتی
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              فهرست جابجایی‌های اخیر روی این مرورگر
            </p>
          </div>

          {history.length > 0 && (
            <button
              onClick={onClearHistory}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/50 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-800/50 text-xs font-medium transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>پاکسازی تاریخچه</span>
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 text-slate-500 mx-auto flex items-center justify-center">
              <Clock className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-semibold text-slate-300">
              هنوز هیچ فایلی ارسال یا دریافت نشده است
            </h3>
            <p className="text-xs text-slate-500">
              با استفاده از تب‌های ارسال یا اسکن می‌توانید فایل‌های خود را جابجا کنید.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={`${item.id}-${item.timestamp}`}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                    {getFileIcon(item.fileType)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-white truncate dir-ltr">
                      {item.fileName}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span className="font-mono">{formatBytes(item.fileSize)}</span>
                      <span>•</span>
                      <span>{new Date(item.timestamp).toLocaleTimeString('fa-IR')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                      item.role === 'sent'
                        ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    {item.role === 'sent' ? (
                      <>
                        <Send className="w-3 h-3" />
                        <span>ارسال شده</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3 h-3" />
                        <span>دریافت شده</span>
                      </>
                    )}
                  </span>

                  {item.dataUrl && (
                    <a
                      href={item.dataUrl}
                      download={item.fileName}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="دانلود مجدد"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
