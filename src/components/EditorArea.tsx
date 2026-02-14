import { useState, useCallback, useRef, useEffect } from 'react';
import { removeBackground } from '../utils/backgroundRemoval';
import { extractGridCells } from '../utils/imageExport';
import { toEvenFloor, ensureEven, snapToEven } from '../utils/evenSize';
import { MIN_CROP_SIZE, MAX_GRID } from '../types';
import type { ProcessedImage } from '../types';
import { extractRegion } from '../utils/imageExport';

type EditorMode = 'grid' | 'crop';

interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface EditorAreaProps {
  imageDataUrl: string;
  file: File;
  hasBackgroundRemoved: boolean;
  canUndo: boolean;
  onReplaceImage: (dataUrl: string) => void;
  onUndo: () => void;
  onAddProcessed: (images: ProcessedImage[]) => void;
  baseName: string;
  bgMode: 'checkerboard' | 'slate';
  onToggleBgMode: () => void;
}

export function EditorArea({
  imageDataUrl,
  file,
  hasBackgroundRemoved,
  canUndo,
  onReplaceImage,
  onUndo,
  onAddProcessed,
  baseName,
  bgMode,
  onToggleBgMode,
}: EditorAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<EditorMode>('grid');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ key: string; current: number; total: number } | null>(null);

  // Grid mode
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [gridFrame, setGridFrame] = useState<FrameRect | null>(null);

  // Crop mode
  const [cropRect, setCropRect] = useState<FrameRect | null>(null);
  const [cropIndex, setCropIndex] = useState(0);

  const [localCropW, setLocalCropW] = useState<number | ''>('');
  const [localCropH, setLocalCropH] = useState<number | ''>('');
  const [activeInput, setActiveInput] = useState<'w' | 'h' | null>(null);

  const [hoverCursor, setHoverCursor] = useState<string>('default');
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const dragState = useRef<{
    type: 'frame' | 'crop';
    start: FrameRect;
    startXY: { x: number; y: number };
    handle?: 'move' | 'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w' | 'n' | 's';
  } | null>(null);
  const gridOverlayRef = useRef<HTMLCanvasElement>(null);
  const cropOverlayRef = useRef<HTMLCanvasElement>(null);

  const imageOnLoad = useCallback(() => {
    const img = imageRef.current;
    if (img) setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
  }, []);

  const fitScale = (): number => {
    if (containerSize.w <= 0 || containerSize.h <= 0 || !imgSize) return 1;
    return Math.min(containerSize.w / imgSize.w, containerSize.h / imgSize.h, 1);
  };

  const displayScale = fitScale() * scale;
  const displayW = imgSize ? imgSize.w * displayScale : 0;
  const displayH = imgSize ? imgSize.h * displayScale : 0;
  const offsetX = (containerSize.w - displayW) / 2;
  const offsetY = (containerSize.h - displayH) / 2;

  const cellW = gridFrame && cols > 0 ? toEvenFloor(gridFrame.w / cols) : 0;
  const cellH = gridFrame && rows > 0 ? toEvenFloor(gridFrame.h / rows) : 0;
  const remainderW = gridFrame ? gridFrame.w - cellW * cols : 0;
  const remainderH = gridFrame ? gridFrame.h - cellH * rows : 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (imgSize) {
      setGridFrame({ x: 0, y: 0, w: imgSize.w, h: imgSize.h });
      setCropRect({ x: 0, y: 0, w: ensureEven(imgSize.w), h: ensureEven(imgSize.h) });
    }
  }, [imgSize]);

  useEffect(() => {
    if (cropRect) {
      // 編集中でない場合のみ、外部からの変更（ドラッグ操作など）を入力欄に同期する
      if (activeInput !== 'w') setLocalCropW(cropRect.w);
      if (activeInput !== 'h') setLocalCropH(cropRect.h);
    }
  }, [cropRect, activeInput]);

  useEffect(() => {
    const el = gridOverlayRef.current;
    if (!el || !gridFrame || mode !== 'grid') return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const w = el.width;
    const h = el.height;
    ctx.clearRect(0, 0, w, h);
    const sx = gridFrame.x * displayScale;
    const sy = gridFrame.y * displayScale;
    const sw = gridFrame.w * displayScale;
    const sh = gridFrame.h * displayScale;
    ctx.strokeStyle = '#5aeb25';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, sw, sh);
    for (let r = 1; r < rows; r++) {
      const yy = sy + cellH * r * displayScale;
      ctx.beginPath();
      ctx.moveTo(sx, yy);
      ctx.lineTo(sx + sw, yy);
      ctx.stroke();
    }
    for (let c = 1; c < cols; c++) {
      const xx = sx + cellW * c * displayScale;
      ctx.beginPath();
      ctx.moveTo(xx, sy);
      ctx.lineTo(xx, sy + sh);
      ctx.stroke();
    }
    if (remainderW > 0 || remainderH > 0) {
      ctx.fillStyle = 'rgba(100,100,100,0.4)';
      if (remainderW > 0) {
        ctx.fillRect(sx + sw - remainderW * displayScale, sy, remainderW * displayScale, sh);
      }
      if (remainderH > 0) {
        ctx.fillRect(sx, sy + sh - remainderH * displayScale, sw, remainderH * displayScale);
      }
    }
  }, [mode, gridFrame, rows, cols, displayScale, cellW, cellH, remainderW, remainderH]);

  useEffect(() => {
    const el = cropOverlayRef.current;
    if (!el || !cropRect || mode !== 'crop') return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, el.width, el.height);
    const sx = cropRect.x * displayScale;
    const sy = cropRect.y * displayScale;
    const sw = cropRect.w * displayScale;
    const sh = cropRect.h * displayScale;
    ctx.strokeStyle = '#5aeb25';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, sw, sh);
  }, [mode, cropRect, displayScale]);

  const toImageCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const x = (clientX - rect.left - offsetX - pan.x) / displayScale;
      const y = (clientY - rect.top - offsetY - pan.y) / displayScale;
      return { x, y };
    },
    [offsetX, offsetY, pan, displayScale]
  );

  const clampFrame = useCallback(
    (f: FrameRect): FrameRect => {
      if (!imgSize) return f;
      const w = Math.max(MIN_CROP_SIZE, Math.min(f.w, imgSize.w - f.x));
      const h = Math.max(MIN_CROP_SIZE, Math.min(f.h, imgSize.h - f.y));
      const x = Math.max(0, Math.min(f.x, imgSize.w - w));
      const y = Math.max(0, Math.min(f.y, imgSize.h - h));
      return { x, y, w, h };
    },
    [imgSize]
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      // Only zoom when Command (meta) key is pressed (macOS Command key)
      if (!e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((s) => Math.max(0.2, Math.min(5, s + delta)));
    },
    []
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!imgSize) return;
      const { x, y } = toImageCoords(e.clientX, e.clientY);
      if (e.button !== 0) return;

      if (mode === 'grid' && gridFrame) {
        const handleSize = 12 / displayScale;
        const inFrame =
          x >= gridFrame.x && x <= gridFrame.x + gridFrame.w && y >= gridFrame.y && y <= gridFrame.y + gridFrame.h;
        const onLeft = Math.abs(x - gridFrame.x) < handleSize;
        const onRight = Math.abs(x - (gridFrame.x + gridFrame.w)) < handleSize;
        const onTop = Math.abs(y - gridFrame.y) < handleSize;
        const onBottom = Math.abs(y - (gridFrame.y + gridFrame.h)) < handleSize;
        if (onRight && onBottom) {
          dragState.current = { type: 'frame', start: { ...gridFrame }, startXY: { x, y }, handle: 'se' };
        } else if (onLeft && onBottom) {
          dragState.current = { type: 'frame', start: { ...gridFrame }, startXY: { x, y }, handle: 'sw' };
        } else if (onRight && onTop) {
          dragState.current = { type: 'frame', start: { ...gridFrame }, startXY: { x, y }, handle: 'ne' };
        } else if (onLeft && onTop) {
          dragState.current = { type: 'frame', start: { ...gridFrame }, startXY: { x, y }, handle: 'nw' };
        } else if (inFrame) {
          dragState.current = { type: 'frame', start: { ...gridFrame }, startXY: { x, y }, handle: 'move' };
        } else {
          panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        }
      } else if (mode === 'crop' && cropRect) {
        const handleSize = 12 / displayScale;
        const inRect = x >= cropRect.x && x <= cropRect.x + cropRect.w && y >= cropRect.y && y <= cropRect.y + cropRect.h;
        const onRight = Math.abs(x - (cropRect.x + cropRect.w)) < handleSize && y >= cropRect.y && y <= cropRect.y + cropRect.h;
        const onBottom = Math.abs(y - (cropRect.y + cropRect.h)) < handleSize && x >= cropRect.x && x <= cropRect.x + cropRect.w;
        if (onRight && onBottom) {
          dragState.current = { type: 'crop', start: { ...cropRect }, startXY: { x, y }, handle: 'se' };
        } else if (inRect) {
          dragState.current = { type: 'crop', start: { ...cropRect }, startXY: { x, y }, handle: 'move' };
        } else {
          panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        }
      } else {
        panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      }
    },
    [mode, gridFrame, cropRect, imgSize, toImageCoords, displayScale, pan]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (panStart.current) {
        setPan({
          x: panStart.current.panX + e.clientX - panStart.current.x,
          y: panStart.current.panY + e.clientY - panStart.current.y,
        });
        return;
      }
      const d = dragState.current;
      if (d && imgSize) {
        const { x, y } = toImageCoords(e.clientX, e.clientY);
        if (d.type === 'frame') {
          let next: FrameRect = { ...d.start };
          if (d.handle === 'move') {
            const dx = x - d.startXY.x;
            const dy = y - d.startXY.y;
            next.x = Math.max(0, Math.min(imgSize.w - next.w, d.start.x + dx));
            next.y = Math.max(0, Math.min(imgSize.h - next.h, d.start.y + dy));
          } else {
            const dx = x - d.startXY.x;
            const dy = y - d.startXY.y;
            if (d.handle === 'se') {
              next.w = Math.max(MIN_CROP_SIZE, d.start.w + dx);
              next.h = Math.max(MIN_CROP_SIZE, d.start.h + dy);
              if (next.x + next.w > imgSize.w) next.w = imgSize.w - next.x;
              if (next.y + next.h > imgSize.h) next.h = imgSize.h - next.y;
            } else if (d.handle === 'sw') {
              next.x = Math.max(0, d.start.x + dx);
              next.w = d.start.w - (next.x - d.start.x);
              next.h = Math.max(MIN_CROP_SIZE, d.start.h + dy);
              if (next.w < MIN_CROP_SIZE) {
                next.x = d.start.x + d.start.w - MIN_CROP_SIZE;
                next.w = MIN_CROP_SIZE;
              }
              if (next.y + next.h > imgSize.h) next.h = imgSize.h - next.y;
            } else if (d.handle === 'ne') {
              next.y = Math.max(0, d.start.y + dy);
              next.w = Math.max(MIN_CROP_SIZE, d.start.w + dx);
              next.h = d.start.h - (next.y - d.start.y);
              if (next.h < MIN_CROP_SIZE) {
                next.y = d.start.y + d.start.h - MIN_CROP_SIZE;
                next.h = MIN_CROP_SIZE;
              }
              if (next.x + next.w > imgSize.w) next.w = imgSize.w - next.x;
            } else if (d.handle === 'nw') {
              next.x = Math.max(0, d.start.x + dx);
              next.y = Math.max(0, d.start.y + dy);
              next.w = d.start.w - (next.x - d.start.x);
              next.h = d.start.h - (next.y - d.start.y);
              if (next.w < MIN_CROP_SIZE) {
                next.x = d.start.x + d.start.w - MIN_CROP_SIZE;
                next.w = MIN_CROP_SIZE;
              }
              if (next.h < MIN_CROP_SIZE) {
                next.y = d.start.y + d.start.h - MIN_CROP_SIZE;
                next.h = MIN_CROP_SIZE;
              }
            }
          }
          setGridFrame(clampFrame(next));
        } else if (d.type === 'crop') {
          let next: FrameRect = { ...d.start };
          const dx = x - d.startXY.x;
          const dy = y - d.startXY.y;
          if (d.handle === 'move') {
            next.x = Math.max(0, Math.min(imgSize.w - next.w, Math.round((d.start.x + dx) / 2) * 2));
            next.y = Math.max(0, Math.min(imgSize.h - next.h, Math.round((d.start.y + dy) / 2) * 2));
          } else {
            next.w = Math.max(MIN_CROP_SIZE, snapToEven(d.start.w + dx));
            next.h = Math.max(MIN_CROP_SIZE, snapToEven(d.start.h + dy));
            if (next.x + next.w > imgSize.w) next.w = ensureEven(imgSize.w - next.x);
            if (next.y + next.h > imgSize.h) next.h = ensureEven(imgSize.h - next.y);
          }
          setCropRect(clampFrame(next));
        }
        return;
      }
      if (!imgSize) {
        setHoverCursor('default');
        return;
      }
      const { x, y } = toImageCoords(e.clientX, e.clientY);
      const handleSize = 12 / displayScale;
      if (mode === 'grid' && gridFrame) {
        const inFrame =
          x >= gridFrame.x && x <= gridFrame.x + gridFrame.w && y >= gridFrame.y && y <= gridFrame.y + gridFrame.h;
        const onLeft = Math.abs(x - gridFrame.x) < handleSize;
        const onRight = Math.abs(x - (gridFrame.x + gridFrame.w)) < handleSize;
        const onTop = Math.abs(y - gridFrame.y) < handleSize;
        const onBottom = Math.abs(y - (gridFrame.y + gridFrame.h)) < handleSize;
        if (onRight && onBottom) setHoverCursor('nwse-resize');
        else if (onLeft && onBottom) setHoverCursor('nesw-resize');
        else if (onRight && onTop) setHoverCursor('nesw-resize');
        else if (onLeft && onTop) setHoverCursor('nwse-resize');
        else if (inFrame) setHoverCursor('move');
        else setHoverCursor('default');
      } else if (mode === 'crop' && cropRect) {
        const inRect = x >= cropRect.x && x <= cropRect.x + cropRect.w && y >= cropRect.y && y <= cropRect.y + cropRect.h;
        const onRight = Math.abs(x - (cropRect.x + cropRect.w)) < handleSize && y >= cropRect.y && y <= cropRect.y + cropRect.h;
        const onBottom = Math.abs(y - (cropRect.y + cropRect.h)) < handleSize && x >= cropRect.x && x <= cropRect.x + cropRect.w;
        if (onRight && onBottom) setHoverCursor('nwse-resize');
        else if (inRect) setHoverCursor('move');
        else setHoverCursor('default');
      } else {
        setHoverCursor('default');
      }
    },
    [toImageCoords, imgSize, clampFrame, mode, gridFrame, cropRect, displayScale]
  );

  const onMouseUp = useCallback(() => {
    panStart.current = null;
    dragState.current = null;
  }, []);

  const onMouseLeave = useCallback(() => {
    panStart.current = null;
    dragState.current = null;
    setHoverCursor('default');
  }, []);

  const runBackgroundRemoval = useCallback(async () => {
    setLoading(true);
    setProgress(null);
    try {
      const blob = await removeBackground(imageDataUrl, (key, current, total) => {
        setProgress({ key, current, total });
      });
      const reader = new FileReader();
      reader.onload = () => onReplaceImage(reader.result as string);
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error(e);
      alert('処理に失敗しました。画像サイズを小さくしてください。');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [imageDataUrl, onReplaceImage]);

  const format: 'png' | 'jpeg' = hasBackgroundRemoved ? 'png' : file.type === 'image/jpeg' ? 'jpeg' : 'png';

  const runGridSplit = useCallback(async () => {
    if (!imgSize || !gridFrame || !imageRef.current) return;
    const img = imageRef.current;
    setLoading(true);
    try {
      await img.decode?.();
      const blobs = await extractGridCells({
        imageSource: img,
        frameX: Math.round(gridFrame.x),
        frameY: Math.round(gridFrame.y),
        frameW: gridFrame.w,
        frameH: gridFrame.h,
        rows,
        cols,
        format,
      });
      const newImages: ProcessedImage[] = blobs.map((blob, i) => {
        const row = Math.floor(i / cols) + 1;
        const col = (i % cols) + 1;
        return {
          id: `grid-${Date.now()}-${i}`,
          type: 'grid',
          blob,
          meta: { row, col },
          baseName,
          extension: format,
        };
      });
      await new Promise((r) => requestAnimationFrame(r));
      onAddProcessed(newImages);
    } catch (e) {
      console.error(e);
      alert('分割に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [imgSize, gridFrame, rows, cols, format, baseName, onAddProcessed]);

  const runCrop = useCallback(async () => {
    if (!imgSize || !cropRect || !imageRef.current) return;
    const img = imageRef.current;
    const w = ensureEven(cropRect.w);
    const h = ensureEven(cropRect.h);
    if (w < MIN_CROP_SIZE || h < MIN_CROP_SIZE) return;
    setLoading(true);
    try {
      const blob = await extractRegion(
        img,
        Math.round(cropRect.x),
        Math.round(cropRect.y),
        w,
        h,
        format
      );
      setCropIndex((i) => i + 1);
      onAddProcessed([
        {
          id: `crop-${Date.now()}`,
          type: 'crop',
          blob,
          meta: { cropIndex: cropIndex + 1 },
          baseName,
          extension: format,
        },
      ]);
    } catch (e) {
      console.error(e);
      alert('切り抜きに失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [imgSize, cropRect, format, baseName, cropIndex, onAddProcessed]);

  const setRowsSafe = useCallback((v: number) => setRows(Math.max(1, Math.min(MAX_GRID, v))), []);
  const setColsSafe = useCallback((v: number) => setCols(Math.max(1, Math.min(MAX_GRID, v))), []);

  const setCropWidth = useCallback(
    (v: number) => {
      setCropRect((r) => {
        if (!r || !imgSize) return r;
        const maxW = imgSize.w - r.x;
        return { ...r, w: Math.max(MIN_CROP_SIZE, Math.min(ensureEven(v), ensureEven(maxW))) };
      });
    },
    [imgSize]
  );
  const setCropHeight = useCallback(
    (v: number) => {
      setCropRect((r) => {
        if (!r || !imgSize) return r;
        const maxH = imgSize.h - r.y;
        return { ...r, h: Math.max(MIN_CROP_SIZE, Math.min(ensureEven(v), ensureEven(maxH))) };
      });
    },
    [imgSize]
  );

  const resetView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomBy = useCallback((delta: number) => {
    setScale((s) => {
      const next = Math.round((s + delta) * 100) / 100;
      return Math.max(0.2, Math.min(5, next));
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runBackgroundRemoval}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? 'AI解析中...' : '背景透過'}
          </button>
          {loading && progress && (
            <div className="flex items-center gap-2">
              <div className="w-40 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                ></div>
              </div>
              <span className="text-xs text-slate-600">
                {Math.round((progress.current / progress.total) * 100)}%
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo || loading}
          className="p-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          title="元に戻す (Undo)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
          >
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        </button>
        <div className="w-px h-6 bg-slate-300"></div>
        <button
          type="button"
          onClick={() => zoomBy(-0.1)}
          disabled={loading}
          className="p-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          title="縮小"
          aria-label="縮小"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        <button
          type="button"
          onClick={resetView}
          disabled={loading}
          className="p-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          title="表示をリセット"
          aria-label="表示をリセット"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-aspect-ratio" viewBox="0 0 16 16">
            <path d="M0 3.5A1.5 1.5 0 0 1 1.5 2h13A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 12.5zM1.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5z"/>
            <path d="M2 4.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1H3v2.5a.5.5 0 0 1-1 0zm12 7a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1 0-1H13V8.5a.5.5 0 0 1 1 0z"/>
          </svg>
        </button>
        <button
          type="button"
          onClick={() => zoomBy(0.1)}
          disabled={loading}
          className="p-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          title="拡大"
          aria-label="拡大"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        <div className="w-px h-6 bg-slate-300"></div>
        <button
          type="button"
          onClick={onToggleBgMode}
          className="p-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          title="背景切り替え"
        >
          {bgMode === 'checkerboard' ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <rect x="3" y="3" width="3" height="3" fill="currentColor" />
              <rect x="9" y="3" width="3" height="3" fill="currentColor" />
              <rect x="15" y="3" width="3" height="3" fill="currentColor" />
              <rect x="3" y="9" width="3" height="3" fill="currentColor" />
              <rect x="9" y="9" width="3" height="3" fill="currentColor" />
              <rect x="15" y="9" width="3" height="3" fill="currentColor" />
              <rect x="3" y="15" width="3" height="3" fill="currentColor" />
              <rect x="9" y="15" width="3" height="3" fill="currentColor" />
              <rect x="15" y="15" width="3" height="3" fill="currentColor" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <rect x="3" y="3" width="18" height="18" fill="currentColor" />
            </svg>
          )}
        </button>
        <div className="flex border border-slate-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setMode('grid')}
            className={`px-3 py-1.5 text-sm ${mode === 'grid' ? 'bg-slate-200' : 'bg-white hover:bg-slate-50'}`}
          >
            グリッド
          </button>
          <button
            type="button"
            onClick={() => setMode('crop')}
            className={`px-3 py-1.5 text-sm ${mode === 'crop' ? 'bg-slate-200' : 'bg-white hover:bg-slate-50'}`}
          >
            範囲指定
          </button>
        </div>
      </div>

      {mode === 'grid' && (
        <div className="px-3 py-2 border-b border-slate-200 space-y-1">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="text-sm text-slate-600">横（列）</span>
              <input
                type="number"
                min={1}
                max={MAX_GRID}
                value={cols}
                onChange={(e) => setColsSafe(parseInt(e.target.value, 10) || 1)}
                className="w-16 px-2 py-1 border border-slate-300 rounded text-sm"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-sm text-slate-600">縦（行）</span>
              <input
                type="number"
                min={1}
                max={MAX_GRID}
                value={rows}
                onChange={(e) => setRowsSafe(parseInt(e.target.value, 10) || 1)}
                className="w-16 px-2 py-1 border border-slate-300 rounded text-sm"
              />
            </label>
            {/* 分割セルの画像サイズ表示 */}
            {gridFrame && rows > 0 && cols > 0 && (
              <span className="text-sm text-slate-600 mr-2">
                セルサイズ（W × H）: {toEvenFloor(gridFrame.w / cols)} × {toEvenFloor(gridFrame.h / rows)}
              </span>
            )}
            <button
              type="button"
              onClick={runGridSplit}
              disabled={loading || !gridFrame}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              切り抜き実行
            </button>
          </div>
        </div>
      )}

      {mode === 'crop' && (
        <div className="flex items-center gap-4 px-3 py-2 border-b border-slate-200 flex-wrap">
          <label className="flex items-center gap-2">
            <span className="text-sm text-slate-600">幅</span>
            <input
              type="number"
              min={MIN_CROP_SIZE}
              max={cropRect && imgSize ? imgSize.w - cropRect.x : undefined}
              step="2"
              value={localCropW}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') {
                  setLocalCropW('');
                  return;
                }
                const val = parseInt(v, 10);
                setLocalCropW(val);
                // MIN_CROP_SIZEより大きい場合のみリアルタイム反映
                if (!isNaN(val) && val > MIN_CROP_SIZE) setCropWidth(val);
              }}
              onFocus={() => setActiveInput('w')}
              onBlur={() => {
                setActiveInput(null);
                if (typeof localCropW === 'number') setCropWidth(Math.max(MIN_CROP_SIZE, localCropW));
                else if (cropRect) setLocalCropW(cropRect.w);
              }}
              className="w-20 px-2 py-1 border border-slate-300 rounded text-sm"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm text-slate-600">高さ</span>
            <input
              type="number"
              min={MIN_CROP_SIZE}
              max={cropRect && imgSize ? imgSize.h - cropRect.y : undefined}
              step="2"
              value={localCropH}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') {
                  setLocalCropH('');
                  return;
                }
                const val = parseInt(v, 10);
                setLocalCropH(val);
                // MIN_CROP_SIZEより大きい場合のみリアルタイム反映
                if (!isNaN(val) && val > MIN_CROP_SIZE) setCropHeight(val);
              }}
              onFocus={() => setActiveInput('h')}
              onBlur={() => {
                setActiveInput(null);
                if (typeof localCropH === 'number') setCropHeight(Math.max(MIN_CROP_SIZE, localCropH));
                else if (cropRect) setLocalCropH(cropRect.h);
              }}
              className="w-20 px-2 py-1 border border-slate-300 rounded text-sm"
            />
          </label>
          <button
            type="button"
            onClick={runCrop}
            disabled={loading || !cropRect}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            切り抜き実行
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className="flex-1 min-h-[400px] bg-slate-300 overflow-auto relative flex items-center justify-center"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        style={{ touchAction: 'none', cursor: hoverCursor }}
      >
        {imageDataUrl && (
          <div
            className={`absolute flex items-center justify-center ${
              bgMode === 'checkerboard' ? 'checkerboard' : 'bg-slate-500'
            }`}
            style={
              imgSize
                ? {
                    width: displayW,
                    height: displayH,
                    left: offsetX + pan.x,
                    top: offsetY + pan.y,
                  }
                : {
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: '100%',
                    height: '100%',
                  }
            }
          >
            <img
              ref={imageRef}
              src={imageDataUrl}
              alt=""
              className="block w-full h-full object-contain"
              style={{ background: 'transparent' }}
              onLoad={imageOnLoad}
              draggable={false}
            />
            {imgSize && mode === 'grid' && gridFrame && (
              <canvas
                ref={gridOverlayRef}
                className="absolute inset-0 pointer-events-none"
                width={displayW}
                height={displayH}
                style={{ left: 0, top: 0, width: displayW, height: displayH }}
              />
            )}
            {imgSize && mode === 'crop' && cropRect && (
              <canvas
                ref={cropOverlayRef}
                className="absolute inset-0 pointer-events-none"
                width={displayW}
                height={displayH}
                style={{ left: 0, top: 0, width: displayW, height: displayH }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
