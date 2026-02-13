export type ProcessedImageType = 'grid' | 'crop';

export interface ProcessedImage {
  id: string;
  type: ProcessedImageType;
  blob: Blob;
  /** グリッド時: 行・列 (1-based)。切り抜き時: 連番 */
  meta: { row?: number; col?: number; cropIndex?: number };
  /** 元ファイル名（拡張子なし） */
  baseName: string;
  /** 元がJPEGかつ背景削除していない場合は jpeg、それ以外は png */
  extension: 'png' | 'jpeg';
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MIN_DIMENSION = 200;
export const MAX_DIMENSION = 4096;
export const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
export const MIN_CROP_SIZE = 20;
export const MAX_GRID = 10;
