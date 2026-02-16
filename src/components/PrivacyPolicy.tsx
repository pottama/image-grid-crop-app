import React from 'react';

interface PrivacyPolicyProps {
  onClose: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-slate-800">プライバシーポリシー</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto text-sm text-slate-700 space-y-6 leading-relaxed">
          <section>
            <h3 className="font-bold text-slate-900 mb-2 text-base">1. 画像データの取り扱いについて</h3>
            <p>
              当サイト（画像分割ツール）は、ユーザーが選択した画像データをブラウザ（クライアントサイド）内でのみ処理します。
              画像データが当サイトのサーバーにアップロードされたり、保存されたりすることはありません。安心してお使いください。
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2 text-base">2. 広告配信について</h3>
            <p>
              当サイトでは、第三者配信の広告サービス（Google AdSense）を利用しています。
              このような広告配信事業者は、ユーザーの興味に応じた商品やサービスの広告を表示するため、当サイトや他サイトへのアクセスに関する情報「Cookie」（氏名、住所、メール アドレス、電話番号は含まれません）を使用することがあります。
            </p>
            <p className="mt-2">
              Google AdSenseに関して、このプロセスの詳細やこのような情報が広告配信事業者に使用されないようにする方法については、
              <a href="https://policies.google.com/technologies/ads?hl=ja" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Googleのポリシーと規約
              </a>
              をご覧ください。
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2 text-base">3. 免責事項</h3>
            <p>
              当サイトの利用によって生じた、いかなる損害についても、当サイト運営者は一切の責任を負いません。
              当サイトのコンテンツ・情報につきまして、可能な限り正確な情報を掲載するよう努めておりますが、誤情報が入り込んだり、情報が古くなっていることもございます。
            </p>
          </section>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors text-sm">閉じる</button>
        </div>
      </div>
    </div>
  );
};