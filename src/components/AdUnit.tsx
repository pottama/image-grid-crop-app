import React, { useEffect } from 'react';

// AdSenseの型定義（TypeScriptエラー回避用）
declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export const AdUnit: React.FC = () => {
  useEffect(() => {
    try {
      // 広告コードの再読み込みトリガー
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error(e);
    }
  }, []);

  return (
    <div className="my-8 mx-auto text-center" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <p className="text-xs text-gray-400 mb-1">スポンサーリンク</p>
      {/* ↓ ここにAdSenseのディスプレイ広告コードを貼ります（審査後に取得したもの） */}
      <ins className="adsbygoogle"
           style={{ display: 'block' }}
           data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" // ← あなたのIDに書き換え
           data-ad-slot="1234567890" // ← あなたの広告スロットID
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
    </div>
  );
};