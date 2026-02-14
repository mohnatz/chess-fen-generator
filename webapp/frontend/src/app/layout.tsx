import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chess FEN Generator | Screenshot to FEN",
  description: "Convert chess screenshots to FEN notation using computer vision and machine learning. Instantly analyze positions on Lichess or Chess.com.",
  keywords: ["chess", "FEN", "screenshot", "board recognition", "Lichess", "Chess.com", "analysis"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased noise-overlay">
        {/* Subtle checkered background */}
        <div className="fixed inset-0 checkered-bg pointer-events-none" />

        {/* Main content */}
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
