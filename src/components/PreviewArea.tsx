import { useState, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import type { ProcessedImage } from '../types';
import { MIN_CROP_SIZE } from '../types';
import { ensureEven } from '../utils/evenSize';
import pica from 'pica';
import { AdUnit } from './AdUnit';

interface PreviewAreaProps {
  processedImages: ProcessedImage[];
  baseName: string;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  bgMode: 'checkerboard' | 'slate';
  customBgColor: string;
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

export function PreviewArea({ processedImages, baseName, onRemove, onClearAll, bgMode, customBgColor }: PreviewAreaProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [zipLoading, setZipLoading] = useState(false);
  const [optsModalOpen, setOptsModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState<'all' | ProcessedImage | null>(null);
  const [resizeEnabled, setResizeEnabled] = useState(false);
  const [targetW, setTargetW] = useState<number | ''>('');
  const [targetH, setTargetH] = useState<number | ''>('');
  const [keepAspect, setKeepAspect] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [origW, setOrigW] = useState<number | null>(null);
  const [origH, setOrigH] = useState<number | null>(null);

  const handleClearAll = useCallback(() => {
    if (processedImages.length === 0) return;
    if (window.confirm('プレビューの画像をすべて削除しますか？')) {
      onClearAll();
    }
  }, [processedImages.length, onClearAll]);

  const handleDownload = useCallback((p: ProcessedImage) => {
    setModalTarget(p);
    setResizeEnabled(false);
    setTargetW('');
    setTargetH('');
    setKeepAspect(true);
    // load original dimensions for this image to enable aspect calculations
    (async () => {
      try {
        const url = URL.createObjectURL(p.blob);
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Image load error'));
          img.src = url;
        });
        const nW = img.naturalWidth;
        const nH = img.naturalHeight;
        setOrigW(nW);
        setOrigH(nH);
        // prefill inputs for single-image modal with the image's size (evenized)
        setTargetW(ensureEven(Math.max(2, Math.round(nW))));
        setTargetH(ensureEven(Math.max(2, Math.round(nH))));
        URL.revokeObjectURL(url);
      } catch (e) {
        setOrigW(null);
        setOrigH(null);
      } finally {
        setOptsModalOpen(true);
      }
    })();
  }, []);

  const handleDownloadAll = useCallback(async () => {
    if (processedImages.length === 0) return;

    const dims = await Promise.all(
      processedImages.map((p) => {
        return new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          const url = URL.createObjectURL(p.blob);
          img.onload = () => {
            resolve({ w: img.naturalWidth, h: img.naturalHeight });
            URL.revokeObjectURL(url);
          };
          img.onerror = () => {
            resolve({ w: 0, h: 0 });
            URL.revokeObjectURL(url);
          };
          img.src = url;
        });
      })
    );

    const maxW = dims.reduce((acc, cur) => Math.max(acc, cur.w), 0);
    const maxH = dims.reduce((acc, cur) => Math.max(acc, cur.h), 0);

    setModalTarget('all');
    setResizeEnabled(false);
    setTargetW(ensureEven(Math.max(2, maxW)));
    setTargetH(ensureEven(Math.max(2, maxH)));
    setKeepAspect(true);
    setOrigW(ensureEven(Math.max(2, maxW)));
    setOrigH(ensureEven(Math.max(2, maxH)));
    setOptsModalOpen(true);
  }, [processedImages]);

  async function resizeImageBlob(blob: Blob, w: number | '', h: number | '', keep: boolean): Promise<Blob> {
    if (!w && !h) return blob;

    const picaRunner = pica();

    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = async () => {
        const naturalW = img.naturalWidth;
        const naturalH = img.naturalHeight;
        let dw = typeof w === 'number' && w > 0 ? w : naturalW;
        let dh = typeof h === 'number' && h > 0 ? h : naturalH;
        if (keep) {
          const ratio = naturalW / naturalH;
          if (typeof w === 'number' && w > 0 && !(typeof h === 'number' && h > 0)) {
            dh = Math.round(w / ratio);
          } else if (typeof h === 'number' && h > 0 && !(typeof w === 'number' && w > 0)) {
            dw = Math.round(h * ratio);
          } else if (typeof w === 'number' && w > 0 && typeof h === 'number' && h > 0) {
            const targetRatio = w / h;
            if (targetRatio > ratio) {
              dh = h;
              dw = Math.round(h * ratio);
            } else {
              dw = w;
              dh = Math.round(w / ratio);
            }
          }
        }

        // Ensure even dimensions and at least 2px
        const targetWpx = ensureEven(Math.max(2, Math.round(dw)));
        const targetHpx = ensureEven(Math.max(2, Math.round(dh)));

        // Prevent upscaling: if requested size is larger than original, keep original
        if (targetWpx > naturalW || targetHpx > naturalH) {
          URL.revokeObjectURL(url);
          return resolve(blob);
        }

        const dstCanvas = document.createElement('canvas');
        dstCanvas.width = targetWpx;
        dstCanvas.height = targetHpx;

        try {
          await picaRunner.resize(img, dstCanvas, {
            unsharpAmount: 80,
            unsharpRadius: 0.6,
            unsharpThreshold: 2,
          });
          const resultBlob = await picaRunner.toBlob(dstCanvas, blob.type || 'image/png', 0.92);
          URL.revokeObjectURL(url);
          resolve(resultBlob);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image load error'));
      };
      img.src = url;
    });
  }

  const performZipWithOptions = useCallback(
    async (images: ProcessedImage[]) => {
      setProcessing(true);
      setZipLoading(true);
      try {
        const zip = new JSZip();
        for (const p of images) {
          let blob = p.blob;
          if (resizeEnabled) {
            blob = await resizeImageBlob(p.blob, targetW as number | '', targetH as number | '', keepAspect);
          }
          zip.file(getFileName({ ...p, blob }), blob);
        }
        const outBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(outBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_processed.zip`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error(e);
        alert('ZIPの作成に失敗しました。');
      } finally {
        setProcessing(false);
        setZipLoading(false);
        setOptsModalOpen(false);
      }
    },
    [resizeEnabled, targetW, targetH, keepAspect, baseName]
  );

  const performIndividualDownloads = useCallback(
    async (images: ProcessedImage[]) => {
      setProcessing(true);
      try {
        for (const p of images) {
          let blob = p.blob;
          if (resizeEnabled) {
            blob = await resizeImageBlob(p.blob, targetW as number | '', targetH as number | '', keepAspect);
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = getFileName(p);
          a.click();
          URL.revokeObjectURL(url);
          await new Promise((r) => setTimeout(r, 50));
        }
      } catch (e) {
        console.error(e);
        alert('ダウンロードに失敗しました。');
      } finally {
        setProcessing(false);
        setOptsModalOpen(false);
      }
    },
    [resizeEnabled, targetW, targetH, keepAspect]
  );

  const handleDimensionBlur = useCallback(
    (
      dimension: 'w' | 'h',
      value: number | '',
      setter: (v: number | '') => void,
      otherSetter: (v: number | '') => void
    ) => {
      if (value === '') return;

      let val = Math.max(MIN_CROP_SIZE, value); // 最低値（MIN_CROP_SIZE）
      val = ensureEven(Math.round(val)); // 偶数補正

      if (keepAspect && modalTarget && origW && origH) {
        // オリジナルサイズを超えないようにキャップ（アスペクト比維持モード時）
        if (dimension === 'w' && val > origW) val = ensureEven(origW);
        if (dimension === 'h' && val > origH) val = ensureEven(origH);

        setter(val);

        // 反対側の再計算
        if (dimension === 'w') {
          const hCalc = Math.round((val * origH) / origW);
          otherSetter(ensureEven(Math.max(MIN_CROP_SIZE, hCalc)));
        } else {
          const wCalc = Math.round((val * origW) / origH);
          otherSetter(ensureEven(Math.max(MIN_CROP_SIZE, wCalc)));
        }
      } else {
        setter(val);
      }
    },
    [keepAspect, modalTarget, origW, origH]
  );

              return (
              <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
                <span className="font-medium text-slate-800 mt-4 lg:mt-2">プレビュー</span>
              <div className="flex items-center gap-2 mt-4 lg:mt-0">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`px-2 py-1 text-sm rounded ${viewMode === 'grid' ? 'bg-slate-200' : 'hover:bg-slate-100'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-grid" viewBox="0 0 16 16">
              <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5zM2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5zm6.5.5A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5z"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-2 py-1 text-sm rounded ${viewMode === 'list' ? 'bg-slate-200' : 'hover:bg-slate-100'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-list-task" viewBox="0 0 16 16">
              <path fill-rule="evenodd" d="M2 2.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5V3a.5.5 0 0 0-.5-.5zM3 3H2v1h1z"/>
              <path d="M5 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5M5.5 7a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1zm0 4a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1z"/>
              <path fill-rule="evenodd" d="M1.5 7a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5zM2 7h1v1H2zm0 3.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zm1 .5H2v1h1z"/>
            </svg>
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
          クリア
        </button>
      </div>

      {optsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !processing && setOptsModalOpen(false)} />
          <div className="bg-white rounded-lg shadow-lg p-4 w-[480px] z-10">
            <h3 className="text-lg font-medium mb-2">出力オプション</h3>
            <label className="flex items-center gap-2 mb-2">
              <input type="checkbox" checked={resizeEnabled} onChange={(e) => setResizeEnabled(e.target.checked)} />
              <span className="text-sm text-slate-700">リサイズして出力</span>
            </label>
            {resizeEnabled && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              <label className="flex flex-col text-sm">
                横 (px)
                <input
                  type="number"
                  min={MIN_CROP_SIZE}
                  step="2"
                  value={targetW}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '') {
                      setTargetW('');
                      return;
                    }
                    const val = parseInt(v, 10);
                    setTargetW(val);

                    // MIN_CROP_SIZEより大きい場合のみ連動計算を行う
                    if (keepAspect && modalTarget && origW && origH && val > MIN_CROP_SIZE) {
                      const hCalc = Math.round((val * origH) / origW);
                      setTargetH(ensureEven(Math.max(MIN_CROP_SIZE, hCalc)));
                    }
                  }}
                  onBlur={() => handleDimensionBlur('w', targetW, setTargetW, setTargetH)}
                  disabled={!resizeEnabled}
                  className="mt-1 px-2 py-1 border border-slate-300 rounded"
                />
              </label>
              <label className="flex flex-col text-sm">
                縦 (px)
                <input
                  type="number"
                  min={MIN_CROP_SIZE}
                  step="2"
                  value={targetH}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '') {
                      setTargetH('');
                      return;
                    }
                    const val = parseInt(v, 10);
                    setTargetH(val);

                    // MIN_CROP_SIZEより大きい場合のみ連動計算を行う
                    if (keepAspect && modalTarget && origW && origH && val > MIN_CROP_SIZE) {
                      const wCalc = Math.round((val * origW) / origH);
                      setTargetW(ensureEven(Math.max(MIN_CROP_SIZE, wCalc)));
                    }
                  }}
                  onBlur={() => handleDimensionBlur('h', targetH, setTargetH, setTargetW)}
                  disabled={!resizeEnabled}
                  className="mt-1 px-2 py-1 border border-slate-300 rounded"
                />
              </label>
            </div>
            )}
            {resizeEnabled && (
              <label className="flex items-center gap-2 mb-4">
                <input type="checkbox" checked={keepAspect} onChange={(e) => setKeepAspect(e.target.checked)} />
                <span className="text-sm text-slate-700">アスペクト比を固定する</span>
              </label>
            )}
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setOptsModalOpen(false)} disabled={processing} className="px-3 py-1.5 border rounded text-sm">キャンセル</button>
              {modalTarget === 'all' ? (
                <button
                  type="button"
                  onClick={() => performZipWithOptions(processedImages)}
                  disabled={processing}
                  className="px-3 py-1.5 bg-slate-800 text-white rounded text-sm"
                >
                  一括ダウンロード (ZIP)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => modalTarget && performIndividualDownloads([modalTarget])}
                  disabled={processing}
                  className="px-3 py-1.5 bg-slate-800 text-white rounded text-sm"
                >
                  保存
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
                bgMode={bgMode}
                customBgColor={customBgColor}
              />
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {processedImages.map((p) => (
              <ListItemPreview
                key={p.id}
                image={p}
                getFileName={getFileName}
                onDownload={handleDownload}
                onRemove={onRemove}
                bgMode={bgMode}
                customBgColor={customBgColor}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-200 shrink-0">
        <AdUnit />
      </div>
    </div>
  );
}

function ListItemPreview({
  image,
  getFileName,
  onDownload,
  onRemove,
  bgMode,
  customBgColor,
}: {
  image: ProcessedImage;
  getFileName: (p: ProcessedImage) => string;
  onDownload: (p: ProcessedImage) => void;
  onRemove: (id: string) => void;
  bgMode: 'checkerboard' | 'slate';
  customBgColor: string;
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
          className={`w-12 h-12 object-cover rounded border border-slate-200 ${
            bgMode === 'checkerboard' ? 'checkerboard' : ''
          }`}
          style={{ backgroundColor: bgMode === 'checkerboard' ? undefined : customBgColor }}
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
  bgMode,
  customBgColor,
}: {
  image: ProcessedImage;
  onDownload: (p: ProcessedImage) => void;
  onRemove: (id: string) => void;
  getFileName: (p: ProcessedImage) => string;
  bgMode: 'checkerboard' | 'slate';
  customBgColor: string;
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
      <div className={`aspect-square relative ${bgMode === 'checkerboard' ? 'checkerboard' : ''}`}
        style={{ backgroundColor: bgMode === 'checkerboard' ? undefined : customBgColor }}
      >
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
