"use client";

import { firebaseStorage } from "@/lib/firebase";
import type { SupportAttachment } from "@/types/domain";

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
