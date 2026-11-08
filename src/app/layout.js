import "./globals.css";

// iPadでのダブルタップ拡大やピンチで画面がずれないよう固定する
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata = {
  title: "Simple Piano",
  description: "左右にスクロールできる88鍵のシンプルなピアノ",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
