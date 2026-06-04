"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Anchor, LogIn, UserPlus } from "lucide-react";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { resetClientAppData } from "@/lib/client-store";

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState(isFirebaseConfigured ? "" : "admin@example.com");
  const [password, setPassword] = useState(isFirebaseConfigured ? "" : "password");
  const [displayName, setDisplayName] = useState("");
  const [authState, setAuthState] = useState<"idle" | "saving">("idle");
  const [message, setMessage] = useState(
    isFirebaseConfigured
      ? "Firebase Authentication接続設定を検出しました。"
      : "現在はモックログインです。.env.local設定後にFirebase Authへ接続できます。",
  );

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function completeRedirectLogin() {
      if (!firebaseAuth || !isFirebaseConfigured) return;
      try {
        const { getRedirectResult, onAuthStateChanged } = await import("firebase/auth");
        unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
          if (!user || cancelled) return;
          resetClientAppData();
          setMessage("ログインしました。ホームへ移動します。");
          router.replace("/home");
        });
        const result = await getRedirectResult(firebaseAuth);
        if (!result || cancelled) return;
        resetClientAppData();
        setMessage("Googleログインでログインしました。");
        router.replace("/home");
      } catch (error) {
        if (cancelled) return;
        setMessage(
          error instanceof Error && error.message
            ? `Googleログインに失敗しました: ${error.message}`
            : "Googleログインに失敗しました。",
        );
      }
    }

    void completeRedirectLogin();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [router]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authState === "saving") return;
    setAuthState("saving");

    try {
      if (firebaseAuth && isFirebaseConfigured) {
        resetClientAppData();
        if (authMode === "signup") {
          const { createUserWithEmailAndPassword, updateProfile } = await import("firebase/auth");
          const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
          if (displayName.trim()) {
            await updateProfile(credential.user, { displayName: displayName.trim() });
          }
        } else {
          const { signInWithEmailAndPassword } = await import("firebase/auth");
          await signInWithEmailAndPassword(firebaseAuth, email, password);
        }
      }

      resetClientAppData();
      setMessage(authMode === "signup" ? "会員登録しました。" : "ログインしました。");
      router.push("/home");
    } catch (error) {
      setMessage(
        error instanceof Error && error.message
          ? `認証に失敗しました: ${error.message}`
          : "認証に失敗しました。",
      );
    } finally {
      setAuthState("idle");
    }
  }

  async function handleGoogleLogin() {
    if (authState === "saving") return;
    setAuthState("saving");
    try {
      if (firebaseAuth && isFirebaseConfigured) {
        const { GoogleAuthProvider, signInWithRedirect, signOut } = await import("firebase/auth");
        resetClientAppData();
        await signOut(firebaseAuth);
        const provider = new GoogleAuthProvider();
        provider.addScope("email");
        provider.addScope("profile");
        provider.setCustomParameters({ prompt: "select_account" });
        await signInWithRedirect(firebaseAuth, provider);
        return;
      }

      resetClientAppData();
      setMessage("Googleログインでログインしました。");
      router.push("/home");
    } catch (error) {
      setMessage(
        error instanceof Error && error.message
          ? `Googleログインに失敗しました: ${error.message}`
          : "Googleログインに失敗しました。",
      );
    } finally {
      setAuthState("idle");
    }
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
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setAuthMode("login")}
              className={`h-11 rounded-md text-sm font-black ${
                authMode === "login" ? "bg-white text-blue-900 shadow-sm" : "text-slate-600"
              }`}
            >
              ログイン
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("signup")}
              className={`h-11 rounded-md text-sm font-black ${
                authMode === "signup" ? "bg-white text-blue-900 shadow-sm" : "text-slate-600"
              }`}
            >
              新規会員登録
            </button>
          </div>
          {authMode === "signup" ? (
            <label className="block">
              <span className="text-sm font-bold text-slate-700">お名前</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-2 h-14 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-base outline-none ring-blue-600 transition focus:ring-2"
                autoComplete="name"
                placeholder="例: 山田 太郎"
              />
            </label>
          ) : null}
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
            disabled={authState === "saving"}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-5 text-base font-black text-white shadow-lg shadow-blue-900/20 disabled:bg-slate-300"
          >
            {authMode === "signup" ? (
              <UserPlus size={22} aria-hidden="true" />
            ) : (
              <LogIn size={22} aria-hidden="true" />
            )}
            {authState === "saving"
              ? "処理中..."
              : authMode === "signup"
                ? "会員登録する"
                : "ログイン"}
          </button>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={authState === "saving"}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-5 text-base font-black text-slate-800 shadow-sm disabled:bg-slate-100 disabled:text-slate-400"
          >
            <span className="grid size-7 place-items-center rounded-full bg-white text-lg font-black text-blue-700 ring-1 ring-slate-200">
              G
            </span>
            Googleでログイン/登録
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
