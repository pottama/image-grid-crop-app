import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal';

export async function removeBackground(
  source: Blob | string,
  onProgress?: (key: string, current: number, total: number) => void
): Promise<Blob> {
  return imglyRemoveBackground(source, {
    output: { 
      format: 'image/png',
      quality: 1,
    },
    progress: onProgress,
  });
}
