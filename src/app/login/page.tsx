"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Anchor, LogIn } from "lucide-react";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("password");
  const [message, setMessage] = useState(
    isFirebaseConfigured
      ? "Firebase Authentication接続設定を検出しました。"
      : "現在はモックログインです。.env.local設定後にFirebase Authへ接続できます。",
  );

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (firebaseAuth && isFirebaseConfigured) {
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      await signInWithEmailAndPassword(firebaseAuth, email, password);
    }

    setMessage("ログインしました。");
    router.push("/home");
  }

  async function handleGoogleLogin() {
    if (firebaseAuth && isFirebaseConfigured) {
      const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
      const provider = new GoogleAuthProvider();
      await signInWithPopup(firebaseAuth, provider);
    }

    setMessage("Googleログインでログインしました。");
    router.push("/home");
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#e0f2fe_0%,#ffffff_52%,#f8fafc_100%)] px-4 py-6 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-md flex-col justify-center gap-8">
        <div className="space-y-4">
          <div className="grid size-16 place-items-center rounded-3xl bg-blue-800 text-white shadow-lg shadow-blue-900/20">
            <Anchor size={32} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">
              Boat Owner Operations
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-normal text-blue-950">
              TaPiYoTa Grand Boat Club
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              共同保有艇を安全に運用するためのログイン画面です。
            </p>
          </div>
        </div>

        <form
          onSubmit={handleLogin}
          className="space-y-4 rounded-lg border border-sky-100 bg-white p-5 shadow-xl shadow-sky-950/10"
        >
          <label className="block">
            <span className="text-sm font-bold text-slate-700">
              メールアドレス
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-14 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-base outline-none ring-blue-600 transition focus:ring-2"
              autoComplete="email"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">パスワード</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-14 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-base outline-none ring-blue-600 transition focus:ring-2"
              autoComplete="current-password"
              required
            />
          </label>
          <button
            type="submit"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-5 text-base font-black text-white shadow-lg shadow-blue-900/20"
          >
            <LogIn size={22} aria-hidden="true" />
            ログイン
          </button>
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-5 text-base font-black text-slate-800 shadow-sm"
          >
            <span className="grid size-7 place-items-center rounded-full bg-white text-lg font-black text-blue-700 ring-1 ring-slate-200">
              G
            </span>
            Googleでログイン
          </button>
          <p className="rounded-lg bg-sky-50 px-3 py-3 text-sm leading-6 text-blue-900">
            {message}
          </p>
        </form>

        <Link
          href="/home"
          className="text-center text-sm font-bold text-blue-800 underline underline-offset-4"
        >
          モックデータでホームを見る
        </Link>
      </div>
    </main>
  );
}
