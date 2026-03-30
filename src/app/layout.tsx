import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "slateVault",
  description: "Local-first, AI-native markdown document library",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-neutral-950 text-neutral-100">
        {children}
      </body>
    </html>
  );
}
