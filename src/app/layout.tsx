import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://lavr5000.github.io"),
  title: "AI Vibes — AI-инструменты для реальной жизни",
  description: "Создаю AI-инструменты, которые реально работают. Transkribator, AI Box и другие проекты.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "AI Vibes — AI-инструменты для реальной жизни",
    description: "Создаю AI-инструменты, которые реально работают. Transkribator, AI Box и другие проекты.",
    images: ["/images/og-image.png"],
    type: "website",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Vibes — AI-инструменты для реальной жизни",
    description: "Создаю AI-инструменты, которые реально работают.",
    images: ["/images/og-image.png"],
  },
  other: {
    "theme-color": "#0b0b12",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <noscript>
          <style>{`
            .scroll-reveal, .robot-entrance, .hero-content > *, .project-card {
              opacity: 1 !important; transform: none !important;
            }
          `}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
