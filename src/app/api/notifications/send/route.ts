import { NextResponse } from "next/server";
import { getFirebaseAdminServices } from "@/lib/firebase-admin";
import type {
  NotificationCategory,
  NotificationPriority,
  NotificationToken,
} from "@/types/domain";

export const runtime = "nodejs";

type SendNotificationBody = {
  organizationId?: string;
  title?: string;
  body?: string;
  relatedPath?: string;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  recipientUserIds?: string[];
  excludeUserId?: string;
};

function absoluteLink(request: Request, relatedPath: string) {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    request.headers.get("origin") ??
    new URL(request.url).origin;

  return new URL(relatedPath || "/home", origin).toString();
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export async function POST(request: Request) {
  let admin: ReturnType<typeof getFirebaseAdminServices>;
  try {
    admin = getFirebaseAdminServices();
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "firebase_admin_init_failed",
        message:
          error instanceof Error
            ? error.message
            : "Firebase Admin SDKの初期化に失敗しました。",
      },
      { status: 500 },
    );
  }

  if (!admin) {
    return NextResponse.json({
      ok: false,
      skipped: true,
      reason: "firebase_admin_not_configured",
    });
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    await admin.auth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as SendNotificationBody;
  if (
    !payload.organizationId ||
    !payload.title ||
    !payload.body ||
    !payload.relatedPath ||
    !payload.category ||
    !payload.priority
  ) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  try {
    const snapshot = await admin.firestore
      .collection("notificationTokens")
      .where("organizationId", "==", payload.organizationId)
      .get();

    const recipientSet = payload.recipientUserIds?.length
      ? new Set(payload.recipientUserIds)
      : undefined;
    const allTokenDocs = snapshot.docs.map((document) => ({
      id: document.id,
      data: document.data() as NotificationToken,
    }));
    const tokenDocs = allTokenDocs
      .filter(({ data }) => !data.disabledAt)
      .filter(({ data }) => data.userId !== payload.excludeUserId)
      .filter(({ data }) => (recipientSet ? recipientSet.has(data.userId) : true));
    const tokens = Array.from(new Set(tokenDocs.map(({ data }) => data.token)));

    if (tokens.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        tokenCount: allTokenDocs.length,
        matchedTokenCount: tokenDocs.length,
        recipientUserIds: payload.recipientUserIds ?? [],
      });
    }

    const link = absoluteLink(request, payload.relatedPath);
    let sent = 0;
    const invalidTokens = new Set<string>();
    const errors: { code?: string; message?: string }[] = [];

    for (const tokenChunk of chunk(tokens, 500)) {
      const response = await admin.messaging.sendEachForMulticast({
        tokens: tokenChunk,
        data: {
          title: payload.title,
          body: payload.body,
          relatedPath: payload.relatedPath,
          link,
          category: payload.category,
          priority: payload.priority,
        },
        webpush: {
          fcmOptions: {
            link,
          },
          notification: {
            icon: "/icons/tapoyota-icon-192.png",
            badge: "/icons/tapoyota-icon-192.png",
            tag: payload.relatedPath,
            renotify: payload.priority === "urgent",
            requireInteraction: payload.priority === "urgent",
          },
        },
      });

      sent += response.successCount;
      response.responses.forEach((result, index) => {
        const code = result.error?.code;
        if (result.error) {
          errors.push({
            code,
            message: result.error.message,
          });
        }
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          invalidTokens.add(tokenChunk[index]);
        }
      });
    }

    if (invalidTokens.size > 0) {
      const now = new Date().toISOString();
      await Promise.all(
        tokenDocs
          .filter(({ data }) => invalidTokens.has(data.token))
          .map(({ id }) =>
            admin.firestore.collection("notificationTokens").doc(id).set(
              {
                disabledAt: now,
                updatedAt: now,
              },
              { merge: true },
            ),
          ),
      );
    }

    return NextResponse.json({
      ok: sent > 0,
      sent,
      disabled: invalidTokens.size,
      tokenCount: allTokenDocs.length,
      matchedTokenCount: tokenDocs.length,
      errors: errors.slice(0, 5),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "push_send_failed",
        message:
          error instanceof Error
            ? error.message
            : "プッシュ通知の送信処理に失敗しました。",
      },
      { status: 500 },
    );
  }
}
