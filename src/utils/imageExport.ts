import { toEvenFloor } from './evenSize';

/** 画像の指定領域を偶数サイズで切り出して Blob を返す */
export function extractRegion(
  imageSource: HTMLImageElement | string,
  x: number,
  y: number,
  width: number,
  height: number,
  format: 'png' | 'jpeg' = 'png'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = typeof imageSource === 'string' ? new Image() : null;
    const useImg = img || (imageSource as HTMLImageElement);

    const run = () => {
      const w = Math.max(2, width % 2 === 0 ? width : width - 1);
      const h = Math.max(2, height % 2 === 0 ? height : height - 1);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(useImg, x, y, w, h, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        format === 'jpeg' ? 'image/jpeg' : 'image/png',
        0.92
      );
    };

    if (img) {
      img.crossOrigin = 'anonymous';
      img.onload = () => run();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = imageSource as string;
    } else {
      run();
    }
  });
}

export interface GridSplitOptions {
  imageSource: HTMLImageElement | string;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
  rows: number;
  cols: number;
  format: 'png' | 'jpeg';
}

/** グリッド分割: 偶数切り捨てでセルサイズを決め、余りは切り捨て。各セルの Blob を返す */
export async function extractGridCells(options: GridSplitOptions): Promise<Blob[]> {
  const { imageSource, frameX, frameY, frameW, frameH, rows, cols, format } = options;
  const cellW = Math.max(2, toEvenFloor(frameW / cols));
  const cellH = Math.max(2, toEvenFloor(frameH / rows));
  const blobs: Blob[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = frameX + col * cellW;
      const y = frameY + row * cellH;
      const blob = await extractRegion(imageSource, x, y, cellW, cellH, format);
      blobs.push(blob);
    }
  }
  return blobs;
}
