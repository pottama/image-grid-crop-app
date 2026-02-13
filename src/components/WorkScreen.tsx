import { useCallback } from 'react';
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
  const handleResetClick = useCallback(() => {
    if (window.confirm('現在の作業を破棄してトップ画面に戻りますか？')) {
      onReset();
    }
  }, [onReset]);

  const baseName = file.name.replace(/\.[^.]+$/, '');

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shrink-0">
        <h1 className="text-lg font-semibold text-slate-800 truncate max-w-[200px]" title={file.name}>
          {file.name}
        </h1>
        <button
          type="button"
          onClick={handleResetClick}
          className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          画像を削除して戻る
        </button>
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
          />
        </section>
        <section className="w-full lg:w-96 shrink-0 flex flex-col bg-slate-50 min-h-0 overflow-hidden">
          <PreviewArea
            processedImages={processedImages}
            baseName={baseName}
            onRemove={onRemoveProcessed}
            onClearAll={onClearAllProcessed}
          />
        </section>
      </div>
    </div>
  );
}
