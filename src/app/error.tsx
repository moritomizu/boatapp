"use client";

import Image from "next/image";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-sky-100 bg-white p-5 text-center shadow-sm">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-blue-800 p-2">
          <Image
            src="/tapiyota_icon.jpg"
            alt=""
            width={48}
            height={48}
            className="h-full w-full object-contain"
            aria-hidden="true"
          />
        </div>
        <h1 className="mt-4 text-xl font-black text-blue-950">
          ページを読み込めませんでした
        </h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          通信状態または古いキャッシュの影響で表示に失敗した可能性があります。
        </p>
        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={reset}
            className="flex h-12 items-center justify-center rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
          >
            再読み込み
          </button>
          <a
            href="/home"
            className="flex h-12 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-700"
          >
            ホームへ戻る
          </a>
        </div>
      </div>
    </main>
  );
}
