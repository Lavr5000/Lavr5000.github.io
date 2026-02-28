import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "No-code AI Founder - Создаю AI-продукты без кода",
  description: "Работаю в строительстве, создаю AI-инструменты для автоматизации рутинных задач. Никакого кода — только нейросети и правильные вопросы.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
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
        {children}
      </body>
    </html>
  );
}
