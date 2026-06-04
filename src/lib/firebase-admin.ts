import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function serviceAccount() {
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (base64) {
    const parsed = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
    const projectId = parsed.project_id ?? parsed.projectId;
    const clientEmail = parsed.client_email ?? parsed.clientEmail;
    const privateKey = parsed.private_key ?? parsed.privateKey;

    if (!projectId || !clientEmail || !privateKey) return undefined;

    return {
      projectId,
      clientEmail,
      privateKey,
    };
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) return undefined;

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

export function getFirebaseAdminServices() {
  const account = serviceAccount();
  if (!account) return undefined;

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert(account),
      projectId:
        process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });

  return {
    auth: getAuth(app),
    firestore: getFirestore(app),
    messaging: getMessaging(app),
  };
}
