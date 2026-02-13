import { ALLOWED_TYPES, MAX_FILE_SIZE, MIN_DIMENSION, MAX_DIMENSION } from '../types';

export interface ValidationError {
  message: string;
}

export function validateFile(file: File): Promise<ValidationError | null> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return Promise.resolve({
      message: '対応フォーマットは JPEG と PNG のみです。GIF・WebP 等は対象外です。',
    });
  }
  if (file.size > MAX_FILE_SIZE) {
    return Promise.resolve({
      message: `ファイル容量は最大 10MB です。現在 ${(file.size / 1024 / 1024).toFixed(2)}MB です。`,
    });
  }
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;
      if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
        resolve({
          message: `画像サイズは縦・横とも 200px 以上必要です。現在 ${width}×${height}px です。`,
        });
        return;
      }
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        resolve({
          message: `画像サイズは縦・横とも 4096px 以下にしてください。現在 ${width}×${height}px です。`,
        });
        return;
      }
      resolve(null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ message: '画像の読み込みに失敗しました。' });
    };
    img.src = url;
  });
}
