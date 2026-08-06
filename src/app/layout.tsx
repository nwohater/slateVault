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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('sv-theme');
                if (theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
                var density = localStorage.getItem('sv-density');
                if (density) document.documentElement.setAttribute('data-density', density);
              } catch (_) {}
            `,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
