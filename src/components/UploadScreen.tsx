import { useCallback, useState } from 'react';
import { validateFile } from '../utils/validation';
import { AdUnit } from './AdUnit';
import { PrivacyPolicy } from './PrivacyPolicy';

interface UploadScreenProps {
  onFileAccepted: (file: File, dataUrl: string) => void;
}

export function UploadScreen({ onFileAccepted }: UploadScreenProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      const err = await validateFile(file);
      if (err) {
        setError(err.message);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        onFileAccepted(file, dataUrl);
      };
      reader.onerror = () => setError('ファイルの読み込みに失敗しました。');
      reader.readAsDataURL(file);
    },
    [onFileAccepted]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) processFile(f);
    },
    [processFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const onSelectFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) processFile(f);
      e.target.value = '';
    },
    [processFile]
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <h1 className="text-2xl font-bold text-slate-800 text-center">
          画像分割ツール
        </h1>
        <h2 className="text-1xl text-slate-800 text-center mb-2">
          （グリッド・範囲指定）
        </h2>
        <p className="text-sm text-slate-600 text-center mb-6">
          推奨サイズ: 200px〜4096px (最大10MB)
          <br />
          ※出力画像は偶数サイズに自動調整されます
        </p>

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`
            border-2 border-dashed rounded-xl p-12 text-center transition-colors
            ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white'}
          `}
        >
          <p className="text-slate-600 mb-4">
            画像をここにドラッグ＆ドロップ
          </p>
          <label className="inline-block px-6 py-3 bg-slate-800 text-white rounded-lg cursor-pointer hover:bg-slate-700">
            ファイルを選択
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={onSelectFile}
            />
          </label>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}

        <AdUnit />

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShowPrivacyPolicy(true)}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            プライバシーポリシー
          </button>
        </div>
      </div>

      {showPrivacyPolicy && <PrivacyPolicy onClose={() => setShowPrivacyPolicy(false)} />}
    </div>
  );
}
