import Image from "next/image";

export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="grid size-18 animate-pulse place-items-center rounded-2xl bg-blue-800 p-2 shadow-lg shadow-blue-950/20">
          <Image
            src="/tapiyota_icon.jpg"
            alt=""
            width={56}
            height={56}
            className="h-full w-full object-contain"
            aria-hidden="true"
          />
        </div>
        <div>
          <p className="text-base font-black text-blue-950">
            TaPiYoTa Grand Boat Club
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            船舶情報を読み込んでいます
          </p>
        </div>
      </div>
    </main>
  );
}
