import { useState, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import type { ProcessedImage } from '../types';

interface PreviewAreaProps {
  processedImages: ProcessedImage[];
  baseName: string;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

function getFileName(p: ProcessedImage): string {
  if (p.type === 'grid' && p.meta.row != null && p.meta.col != null) {
    return `${p.baseName}_grid_y${p.meta.row}-x${p.meta.col}.${p.extension}`;
  }
  if (p.type === 'crop' && p.meta.cropIndex != null) {
    return `${p.baseName}_crop_${p.meta.cropIndex}.${p.extension}`;
  }
  return `${p.baseName}.${p.extension}`;
}

export function PreviewArea({ processedImages, baseName, onRemove, onClearAll }: PreviewAreaProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [zipLoading, setZipLoading] = useState(false);

  const handleClearAll = useCallback(() => {
    if (processedImages.length === 0) return;
    if (window.confirm('プレビューの画像をすべて削除しますか？')) {
      onClearAll();
    }
  }, [processedImages.length, onClearAll]);

  const handleDownload = useCallback((p: ProcessedImage) => {
    const url = URL.createObjectURL(p.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getFileName(p);
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleDownloadAll = useCallback(async () => {
    if (processedImages.length === 0) return;
    setZipLoading(true);
    try {
      const zip = new JSZip();
      for (const p of processedImages) {
        zip.file(getFileName(p), p.blob);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_processed.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('ZIPの作成に失敗しました。');
    } finally {
      setZipLoading(false);
    }
  }, [processedImages, baseName]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
        <span className="font-medium text-slate-800 mt-4">プレビュー</span>
        <div className="flex items-center gap-2 mt-4 lg:mt-0">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`px-2 py-1 text-sm rounded ${viewMode === 'grid' ? 'bg-slate-200' : 'hover:bg-slate-100'}`}
          >
            グリッド
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-2 py-1 text-sm rounded ${viewMode === 'list' ? 'bg-slate-200' : 'hover:bg-slate-100'}`}
          >
            リスト
          </button>
        </div>
      </div>

      <div className="p-3 border-b border-slate-200 space-y-2">
        <button
          type="button"
          onClick={handleDownloadAll}
          disabled={processedImages.length === 0 || zipLoading}
          className="w-full py-2 px-4 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {zipLoading ? 'ZIP作成中...' : '一括ダウンロード (ZIP)'}
        </button>
        <button
          type="button"
          onClick={handleClearAll}
          disabled={processedImages.length === 0}
          className="w-full py-2 px-4 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          プレビューを全部クリア
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {processedImages.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">生成された画像がここに表示されます</p>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-2">
            {processedImages.map((p) => (
              <PreviewCard
                key={p.id}
                image={p}
                onDownload={handleDownload}
                onRemove={onRemove}
                getFileName={getFileName}
              />
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {processedImages.map((p) => (
              <ListItemPreview key={p.id} image={p} getFileName={getFileName} onDownload={handleDownload} onRemove={onRemove} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ListItemPreview({
  image,
  getFileName,
  onDownload,
  onRemove,
}: {
  image: ProcessedImage;
  getFileName: (p: ProcessedImage) => string;
  onDownload: (p: ProcessedImage) => void;
  onRemove: (id: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(image.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [image.blob]);
  return (
    <li className="flex items-center gap-2 py-2 border-b border-slate-200 last:border-0">
      {url && (
        <img
          src={url}
          alt=""
          className="w-12 h-12 object-cover rounded bg-white border border-slate-200"
        />
      )}
      <span className="flex-1 text-sm text-slate-700 truncate">{getFileName(image)}</span>
      <button
        type="button"
        onClick={() => onDownload(image)}
        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
        title="保存"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onRemove(image.id)}
        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
        title="削除"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>
    </li>
  );
}

function PreviewCard({
  image,
  onDownload,
  onRemove,
  getFileName,
}: {
  image: ProcessedImage;
  onDownload: (p: ProcessedImage) => void;
  onRemove: (id: string) => void;
  getFileName: (p: ProcessedImage) => string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(image.blob);
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
    };
  }, [image.blob]);
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="aspect-square relative bg-slate-100 checkerboard">
        {url && <img src={url} alt="" className="w-full h-full object-contain" />}
      </div>
      <div className="p-2 flex items-center justify-between gap-1">
        <span className="text-xs text-slate-600 truncate flex-1" title={getFileName(image)}>
          {getFileName(image)}
        </span>
        <div className="flex shrink-0 gap-0.5">
          <button
            type="button"
            onClick={() => onDownload(image)}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
            title="保存"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onRemove(image.id)}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
            title="削除"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
