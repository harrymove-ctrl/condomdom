import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "condomdom",
  description: "My personal library of UI components, videos and skills, arranged around how I build.",
  icons: { icon: "/favicon.svg" },
};

// Before first paint: apply the saved theme (DESIGN.md §5), and skip the boot screen if this tab has already seen it.
const themeScript = `try{var d=document.documentElement,t=localStorage.getItem("condomdom:theme");if(t==="light"||t==="dark")d.dataset.theme=t;if(sessionStorage.getItem("condomdom:booted"))d.dataset.booted=""}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* DESIGN.md §1: one face. Loaded whole from Google Fonts, not through next/font: next/font keeps only the
            subsets you name, and the ascii art needs JetBrains Mono's block and box-drawing glyphs (▓ ╭ │), which are in
            none of them. Without them the browser draws those cells in another font and the art falls apart. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
