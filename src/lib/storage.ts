"use client";

import { firebaseStorage } from "@/lib/firebase";
import { useMockData } from "@/lib/data-source";
import type { SupportAttachment } from "@/types/domain";

const BOAT_IMAGE_QUEUE_KEY = "tapiyota-grand-boat-club:queued-boat-image:v1";
const MAX_IMAGE_WIDTH = 1600;
const IMAGE_QUALITY = 0.78;

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

  const image = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_WIDTH / image.width);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;

  context.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", IMAGE_QUALITY),
  );
  image.close();
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
    throw new Error("Firebase Storage is not configured.");
  }

  const { getDownloadURL, ref, uploadBytes } = await import("firebase/storage");
  const safeName = file.name.replaceAll("/", "_");
  const path = `supportRequests/${supportRequestId}/${crypto.randomUUID()}-${safeName}`;
  const storageRef = ref(firebaseStorage, path);
  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type || "application/octet-stream",
  });
  const url = await getDownloadURL(snapshot.ref);

  return {
    url,
    name: file.name,
    contentType: file.type || "application/octet-stream",
    uploadedAt: new Date().toISOString(),
    uploadedBy: userId,
  };
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

  const { getDownloadURL, ref, uploadBytes } = await import("firebase/storage");
  const compressed = await compressImageFile(file);
  const safeName = compressed.name.replaceAll("/", "_");
  const path = `boats/${boatId}/${crypto.randomUUID()}-${safeName}`;
  const storageRef = ref(firebaseStorage, path);
  const snapshot = await uploadBytes(storageRef, compressed, {
    contentType: compressed.type || "image/jpeg",
    customMetadata: { uploadedBy: userId },
  });

  return getDownloadURL(snapshot.ref);
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
