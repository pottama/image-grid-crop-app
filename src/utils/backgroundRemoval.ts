import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal';

export async function removeBackground(source: Blob | string): Promise<Blob> {
  return imglyRemoveBackground(source, {
    output: { quality: 1 },
  });
}
