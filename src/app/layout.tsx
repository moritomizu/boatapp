import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://tapiyota-boatapp.vercel.app"),
  title: "TaPiYoTa Grand Boat Club",
  description: "共同保有艇を安全に運用するボートオーナー運営PWA",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/tapiyota_icon.jpg", type: "image/jpeg" },
      { url: "/icons/tapoyota-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/tapoyota-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/tapoyota-icon-512.png", sizes: "512x512", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "TaPiYoTa Grand Boat Club",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "TaPiYoTa Grand Boat Club",
    description: "共同保有艇を安全に運用するボートオーナー運営PWA",
    url: "https://tapiyota-boatapp.vercel.app",
    siteName: "TaPiYoTa Grand Boat Club",
    images: [
      {
        url: "/ogp.png",
        width: 1200,
        height: 630,
        alt: "TaPiYoTa Grand Boat Club",
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TaPiYoTa Grand Boat Club",
    description: "共同保有艇を安全に運用するボートオーナー運営PWA",
    images: ["/ogp.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
