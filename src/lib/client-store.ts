"use client";

import { useSyncExternalStore } from "react";
import { getInitialAppData } from "@/lib/data-source";
import { useMockData } from "@/lib/data-source";
import {
  canUseFirestore,
  getFirestoreAppData,
  saveFirestoreAppData,
} from "@/lib/firebase-repository";
import type { AppData } from "@/types/domain";

const STORAGE_KEY = "tapiyota-grand-boat-club:app-data:v1";
const STORE_EVENT = "tapiyota-grand-boat-club:app-data-updated";

const isBrowser = () => typeof window !== "undefined";
const shouldUseFirestore = () => !useMockData && canUseFirestore;

let cachedRaw: string | null | undefined;
let cachedSnapshot: AppData | undefined;

export function loadClientAppData(fallback: AppData = getInitialAppData()) {
  if (shouldUseFirestore()) return cachedSnapshot ?? fallback;
  if (!isBrowser()) return fallback;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === cachedRaw && cachedSnapshot) return cachedSnapshot;

  cachedRaw = stored;
  if (!stored) return fallback;

  try {
    cachedSnapshot = {
      ...fallback,
      ...JSON.parse(stored),
    } as AppData;
    return cachedSnapshot;
  } catch {
    cachedSnapshot = fallback;
    return fallback;
  }
}

export async function saveClientAppData(data: AppData) {
  if (shouldUseFirestore()) {
    cachedSnapshot = data;
    if (isBrowser()) window.dispatchEvent(new Event(STORE_EVENT));
    await saveFirestoreAppData(data);
    await refreshClientAppData(data);
    return;
  }

  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  cachedRaw = window.localStorage.getItem(STORAGE_KEY);
  cachedSnapshot = data;
  window.dispatchEvent(new Event(STORE_EVENT));
}

export async function updateClientAppData(
  updater: (current: AppData) => AppData,
  fallback: AppData = getInitialAppData(),
) {
  const next = updater(loadClientAppData(fallback));
  await saveClientAppData(next);
  return next;
}

export async function refreshClientAppData(
  fallback: AppData = getInitialAppData(),
) {
  if (!shouldUseFirestore()) return loadClientAppData(fallback);

  cachedSnapshot = await getFirestoreAppData(fallback);
  if (isBrowser()) window.dispatchEvent(new Event(STORE_EVENT));

  return cachedSnapshot;
}

export function resetClientAppData() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
  cachedRaw = null;
  cachedSnapshot = undefined;
  window.dispatchEvent(new Event(STORE_EVENT));
}

export function useClientAppData(fallback: AppData = getInitialAppData()) {
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener(STORE_EVENT, onStoreChange);
      window.addEventListener("storage", onStoreChange);
      void refreshClientAppData(fallback).then(onStoreChange);

      return () => {
        window.removeEventListener(STORE_EVENT, onStoreChange);
        window.removeEventListener("storage", onStoreChange);
      };
    },
    () => loadClientAppData(fallback),
    () => fallback,
  );
}
