import { useCallback, useState, useEffect } from 'react';
import type { ProcessedImage } from '../types';
import { EditorArea } from './EditorArea';
import { PreviewArea } from './PreviewArea';

interface WorkScreenProps {
  file: File;
  imageDataUrl: string;
  historyLength: number;
  hasBackgroundRemoved: boolean;
  processedImages: ProcessedImage[];
  onReplaceImage: (dataUrl: string) => void;
  onUndo: () => void;
  onReset: () => void;
  onAddProcessed: (images: ProcessedImage[]) => void;
  onRemoveProcessed: (id: string) => void;
  onClearAllProcessed: () => void;
}

export function WorkScreen({
  file,
  imageDataUrl,
  historyLength,
  hasBackgroundRemoved,
  processedImages,
  onReplaceImage,
  onUndo,
  onReset,
  onAddProcessed,
  onRemoveProcessed,
  onClearAllProcessed,
}: WorkScreenProps) {
  const [bgMode, setBgMode] = useState<'checkerboard' | 'slate'>('checkerboard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [enableBgRemoval, setEnableBgRemoval] = useState(() => {
    const saved = localStorage.getItem('enableBgRemoval');
    return saved ? JSON.parse(saved) : false;
  });
  const [customBgColor, setCustomBgColor] = useState(() => {
    return localStorage.getItem('customBgColor') || '#64748b';
  });

  useEffect(() => {
    localStorage.setItem('enableBgRemoval', JSON.stringify(enableBgRemoval));
  }, [enableBgRemoval]);

  useEffect(() => {
    localStorage.setItem('customBgColor', customBgColor);
  }, [customBgColor]);

  const handleToggleBgMode = useCallback(() => {
    setBgMode((prev) => (prev === 'checkerboard' ? 'slate' : 'checkerboard'));
  }, []);

  const handleResetClick = useCallback(() => {
    if (window.confirm('現在の作業を破棄してトップ画面に戻りますか？')) {
      onReset();
    }
  }, [onReset]);

  const baseName = file.name.replace(/\.[^.]+$/, '');

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <header className="flex items-center justify-between px-4 py-4 bg-white border-b border-slate-200 shrink-0">
        <h1 className="text-xl font-bold text-slate-900 break-words max-w-[calc(100%-120px)] truncate" title={file.name}>
          {file.name}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetClick}
            className="p-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-x-square" viewBox="0 0 16 16">
            <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z"/>
            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
          </svg>
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            title="設定"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <section className="flex-1 flex flex-col min-h-[50vh] lg:min-h-0 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white">
          <EditorArea
            imageDataUrl={imageDataUrl}
            file={file}
            hasBackgroundRemoved={hasBackgroundRemoved}
            canUndo={historyLength > 0}
            onReplaceImage={onReplaceImage}
            onUndo={onUndo}
            onAddProcessed={onAddProcessed}
            baseName={baseName}
            bgMode={bgMode}
            onToggleBgMode={handleToggleBgMode}
            enableBgRemoval={enableBgRemoval}
            customBgColor={customBgColor}
          />
        </section>
        <section className="w-full lg:w-96 shrink-0 flex flex-col bg-slate-50 min-h-0 overflow-hidden">
          <PreviewArea
            processedImages={processedImages}
            baseName={baseName}
            onRemove={onRemoveProcessed}
            onClearAll={onClearAllProcessed}
            bgMode={bgMode}
            customBgColor={customBgColor}
          />
        </section>
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSettingsOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">設定</h2>

            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableBgRemoval}
                  onChange={(e) => setEnableBgRemoval(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-slate-700">背景透過機能を使用する</span>
              </label>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  背景色 (単色モード)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customBgColor}
                    onChange={(e) => setCustomBgColor(e.target.value)}
                    className="h-10 w-20 p-1 border border-slate-300 rounded cursor-pointer"
                  />
                  <span className="text-sm text-slate-600 font-mono">{customBgColor}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
