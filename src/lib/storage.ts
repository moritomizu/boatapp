"use client";

import { firebaseAuth, firebaseStorage } from "@/lib/firebase";
import { useMockData } from "@/lib/data-source";
import type { SupportAttachment } from "@/types/domain";

const BOAT_IMAGE_QUEUE_KEY = "tapiyota-grand-boat-club:queued-boat-image:v1";
const MAX_IMAGE_WIDTH = 1280;
const IMAGE_QUALITY = 0.72;
const IMAGE_LOAD_TIMEOUT_MS = 10000;
const IMAGE_COMPRESS_TIMEOUT_MS = 10000;
const STORAGE_UPLOAD_TIMEOUT_MS = 30000;

type QueuedBoatImage = {
  boatId: string;
  userId: string;
  name: string;
  contentType: string;
  dataUrl: string;
  queuedAt: string;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => window.clearTimeout(timeoutId));
  });
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const timeoutId = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          "画像の読み込みに時間がかかっています。JPEG/PNG/WebP形式の写真で再度お試しください。",
        ),
      );
    }, IMAGE_LOAD_TIMEOUT_MS);
    image.addEventListener("load", () => {
      window.clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      resolve(image);
    });
    image.addEventListener("error", () => {
      window.clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした。別の写真でお試しください。"));
    });
    image.src = url;
  });
}

async function requireFirebaseStorageUser() {
  if (useMockData || !firebaseStorage) return;
  if (firebaseAuth?.currentUser) return;

  const { onAuthStateChanged } = await import("firebase/auth");
  const user = await withTimeout(
    new Promise((resolve) => {
      if (!firebaseAuth) {
        resolve(undefined);
        return;
      }

      const unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
        unsubscribe();
        resolve(currentUser ?? undefined);
      });
    }),
    3000,
    "Firebase Authのログイン状態を確認できませんでした。",
  );

  if (!user) {
    throw new Error(
      "Firebaseにログインしていないため、Storageへ写真を保存できません。ログイン画面からメール/Googleでログインし直してください。",
    );
  }
}

function dataUrlToFile(dataUrl: string, name: string, contentType: string) {
  const [header, base64] = dataUrl.split(",");
  const typeMatch = header.match(/^data:(.*?);base64$/);
  const type =
    contentType ||
    typeMatch?.[1] ||
    "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], name, { type });
}

export async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const image = await loadImageElement(file);
  const scale = Math.min(1, MAX_IMAGE_WIDTH / image.width);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;

  context.drawImage(image, 0, 0, width, height);
  const blob = await withTimeout(
    new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", IMAGE_QUALITY),
    ),
    IMAGE_COMPRESS_TIMEOUT_MS,
    "画像の圧縮に時間がかかっています。少し小さい写真で再度お試しください。",
  );
  if (!blob) return file;

  const name = file.name.replace(/\.[^.]+$/, "") || "boat-image";
  return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
}

export async function uploadSupportAttachment({
  file,
  supportRequestId,
  userId,
}: {
  file: File;
  supportRequestId: string;
  userId: string;
}): Promise<SupportAttachment> {
  if (!firebaseStorage) {
    if (useMockData) {
      const uploadFile = await compressImageFile(file);
      return {
        url: await readFileAsDataUrl(uploadFile),
        name: uploadFile.name,
        contentType: uploadFile.type || "image/jpeg",
        uploadedAt: new Date().toISOString(),
        uploadedBy: userId,
      };
    }

    throw new Error("Firebase Storage is not configured.");
  }

  await requireFirebaseStorageUser();
  const { getDownloadURL, ref, uploadBytes } = await import("firebase/storage");
  const uploadFile = file.type.startsWith("image/")
    ? await compressImageFile(file)
    : file;
  const safeName = uploadFile.name.replaceAll("/", "_");
  const path = `supportRequests/${supportRequestId}/${crypto.randomUUID()}-${safeName}`;
  const storageRef = ref(firebaseStorage, path);
  const snapshot = await withTimeout(
    uploadBytes(storageRef, uploadFile, {
      contentType: uploadFile.type || "application/octet-stream",
    }),
    STORAGE_UPLOAD_TIMEOUT_MS,
    "Firebase Storageへのアップロードが30秒以内に完了しませんでした。Storage Rules、Storage Bucket、通信状態を確認してください。",
  );
  const url = await getDownloadURL(snapshot.ref);

  return {
    url,
    name: uploadFile.name,
    contentType: uploadFile.type || "application/octet-stream",
    uploadedAt: new Date().toISOString(),
    uploadedBy: userId,
  };
}

export async function uploadHandoverAttachment({
  file,
  handoverNoteId,
  userId,
}: {
  file: File;
  handoverNoteId: string;
  userId: string;
}): Promise<SupportAttachment> {
  if (!firebaseStorage) {
    if (useMockData) {
      const uploadFile = await compressImageFile(file);
      return {
        url: await readFileAsDataUrl(uploadFile),
        name: uploadFile.name,
        contentType: uploadFile.type || "image/jpeg",
        uploadedAt: new Date().toISOString(),
        uploadedBy: userId,
      };
    }

    throw new Error("Firebase Storage is not configured.");
  }

  await requireFirebaseStorageUser();
  const { getDownloadURL, ref, uploadBytes } = await import("firebase/storage");
  const uploadFile = file.type.startsWith("image/")
    ? await compressImageFile(file)
    : file;
  const safeName = uploadFile.name.replaceAll("/", "_");
  const path = `handoverNotes/${handoverNoteId}/${crypto.randomUUID()}-${safeName}`;
  const storageRef = ref(firebaseStorage, path);
  const snapshot = await withTimeout(
    uploadBytes(storageRef, uploadFile, {
      contentType: uploadFile.type || "application/octet-stream",
      customMetadata: { uploadedBy: userId },
    }),
    STORAGE_UPLOAD_TIMEOUT_MS,
    "Firebase Storageへのアップロードが30秒以内に完了しませんでした。Storage Rules、Storage Bucket、通信状態を確認してください。",
  );
  const url = await getDownloadURL(snapshot.ref);

  return {
    url,
    name: uploadFile.name,
    contentType: uploadFile.type || "application/octet-stream",
    uploadedAt: new Date().toISOString(),
    uploadedBy: userId,
  };
}

export async function uploadCheckImage({
  file,
  mode,
  checkId,
  userId,
}: {
  file: File;
  mode: "pre-departure" | "post-return";
  checkId: string;
  userId: string;
}): Promise<string> {
  if (!firebaseStorage) {
    if (useMockData) {
      return readFileAsDataUrl(await compressImageFile(file));
    }

    throw new Error("Firebase Storage is not configured.");
  }

  await requireFirebaseStorageUser();
  const { getDownloadURL, ref, uploadBytes } = await import("firebase/storage");
  const uploadFile = file.type.startsWith("image/")
    ? await compressImageFile(file)
    : file;
  const safeName = uploadFile.name.replaceAll("/", "_");
  const collection =
    mode === "pre-departure" ? "preDepartureChecks" : "postReturnChecks";
  const path = `${collection}/${checkId}/${crypto.randomUUID()}-${safeName}`;
  const storageRef = ref(firebaseStorage, path);
  const snapshot = await withTimeout(
    uploadBytes(storageRef, uploadFile, {
      contentType: uploadFile.type || "application/octet-stream",
      customMetadata: { uploadedBy: userId },
    }),
    STORAGE_UPLOAD_TIMEOUT_MS,
    "Firebase Storageへのアップロードが30秒以内に完了しませんでした。Storage Rules、Storage Bucket、通信状態を確認してください。",
  );

  return getDownloadURL(snapshot.ref);
}

export async function uploadBoatImage({
  file,
  boatId,
  userId,
}: {
  file: File;
  boatId: string;
  userId: string;
}) {
  if (!firebaseStorage) {
    if (useMockData) {
      return readFileAsDataUrl(await compressImageFile(file));
    }

    throw new Error("Firebase Storage is not configured.");
  }

  await requireFirebaseStorageUser();
  const { getDownloadURL, ref, uploadBytes } = await import("firebase/storage");
  const compressed = await compressImageFile(file);
  const safeName = compressed.name.replaceAll("/", "_");
  const path = `boats/${boatId}/${crypto.randomUUID()}-${safeName}`;
  const storageRef = ref(firebaseStorage, path);
  const snapshot = await withTimeout(
    uploadBytes(storageRef, compressed, {
      contentType: compressed.type || "image/jpeg",
      customMetadata: { uploadedBy: userId },
    }),
    STORAGE_UPLOAD_TIMEOUT_MS,
    "Firebase Storageへのアップロードが30秒以内に完了しませんでした。Storage Rules、Storage Bucket、通信状態を確認してください。",
  );

  return getDownloadURL(snapshot.ref);
}

async function uploadCompressedImageToPath({
  file,
  pathBase,
  userId,
}: {
  file: File;
  pathBase: string;
  userId: string;
}) {
  if (!firebaseStorage) {
    if (useMockData) {
      return readFileAsDataUrl(await compressImageFile(file));
    }

    throw new Error("Firebase Storage is not configured.");
  }

  await requireFirebaseStorageUser();
  const { getDownloadURL, ref, uploadBytes } = await import("firebase/storage");
  const uploadFile = await compressImageFile(file);
  const safeName = uploadFile.name.replaceAll("/", "_");
  const storageRef = ref(
    firebaseStorage,
    `${pathBase}/${crypto.randomUUID()}-${safeName}`,
  );
  const snapshot = await withTimeout(
    uploadBytes(storageRef, uploadFile, {
      contentType: uploadFile.type || "image/jpeg",
      customMetadata: { uploadedBy: userId },
    }),
    STORAGE_UPLOAD_TIMEOUT_MS,
    "Firebase Storageへのアップロードが30秒以内に完了しませんでした。Storage Rules、Storage Bucket、通信状態を確認してください。",
  );

  return getDownloadURL(snapshot.ref);
}

export function uploadUserProfileImage({
  file,
  userId,
}: {
  file: File;
  userId: string;
}) {
  return uploadCompressedImageToPath({
    file,
    pathBase: `users/${userId}/profile`,
    userId,
  });
}

export function uploadUserLicenseImage({
  file,
  userId,
}: {
  file: File;
  userId: string;
}) {
  return uploadCompressedImageToPath({
    file,
    pathBase: `users/${userId}/licenses`,
    userId,
  });
}

export function uploadBoatInspectionCertificateImage({
  file,
  boatId,
  userId,
}: {
  file: File;
  boatId: string;
  userId: string;
}) {
  return uploadCompressedImageToPath({
    file,
    pathBase: `boats/${boatId}/inspectionCertificates`,
    userId,
  });
}

export async function queueBoatImageUpload({
  file,
  boatId,
  userId,
}: {
  file: File;
  boatId: string;
  userId: string;
}) {
  const compressed = await compressImageFile(file);
  const queued: QueuedBoatImage = {
    boatId,
    userId,
    name: compressed.name,
    contentType: compressed.type || "image/jpeg",
    dataUrl: await readFileAsDataUrl(compressed),
    queuedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(BOAT_IMAGE_QUEUE_KEY, JSON.stringify(queued));
}

export function getQueuedBoatImage() {
  if (typeof window === "undefined") return undefined;
  const stored = window.localStorage.getItem(BOAT_IMAGE_QUEUE_KEY);
  if (!stored) return undefined;

  try {
    return JSON.parse(stored) as QueuedBoatImage;
  } catch {
    window.localStorage.removeItem(BOAT_IMAGE_QUEUE_KEY);
    return undefined;
  }
}

export function clearQueuedBoatImage() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(BOAT_IMAGE_QUEUE_KEY);
}

export async function uploadQueuedBoatImage() {
  const queued = getQueuedBoatImage();
  if (!queued) return undefined;

  const file = dataUrlToFile(queued.dataUrl, queued.name, queued.contentType);
  const imageUrl = await uploadBoatImage({
    file,
    boatId: queued.boatId,
    userId: queued.userId,
  });
  clearQueuedBoatImage();

  return imageUrl;
}
