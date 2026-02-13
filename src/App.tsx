import { useState, useCallback } from 'react';
import { UploadScreen } from './components/UploadScreen';
import { WorkScreen } from './components/WorkScreen';
import type { ProcessedImage } from './types';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [hasBackgroundRemoved, setHasBackgroundRemoved] = useState(false);
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);

  const handleFileAccepted = useCallback((f: File, dataUrl: string) => {
    setFile(f);
    setImageDataUrl(dataUrl);
    setHistory([]);
    setHasBackgroundRemoved(false);
    setProcessedImages([]);
  }, []);

  const handleReplaceImage = useCallback((newDataUrl: string) => {
    if (imageDataUrl) setHistory((h) => [...h, imageDataUrl]);
    setImageDataUrl(newDataUrl);
    setHasBackgroundRemoved(true);
  }, [imageDataUrl]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setImageDataUrl(prev);
    setHasBackgroundRemoved(false);
  }, [history]);

  const handleReset = useCallback(() => {
    setFile(null);
    setImageDataUrl(null);
    setHistory([]);
    setProcessedImages([]);
  }, []);

  const handleAddProcessed = useCallback((newImages: ProcessedImage[]) => {
    setProcessedImages((prev) => [...prev, ...newImages]);
  }, []);

  const handleRemoveProcessed = useCallback((id: string) => {
    setProcessedImages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleClearAllProcessed = useCallback(() => {
    setProcessedImages([]);
  }, []);

  if (file && imageDataUrl) {
    return (
      <WorkScreen
        file={file}
        imageDataUrl={imageDataUrl}
        historyLength={history.length}
        hasBackgroundRemoved={hasBackgroundRemoved}
        processedImages={processedImages}
        onReplaceImage={handleReplaceImage}
        onUndo={handleUndo}
        onReset={handleReset}
        onAddProcessed={handleAddProcessed}
        onRemoveProcessed={handleRemoveProcessed}
        onClearAllProcessed={handleClearAllProcessed}
      />
    );
  }

  return <UploadScreen onFileAccepted={handleFileAccepted} />;
}
