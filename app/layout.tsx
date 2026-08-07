import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "11012710",
  description:
    "فروشگاه اشتراک‌های هوش مصنوعی و موسیقی شامل Gemini، ChatGPT، Claude، Grok و Spotify.",
  other: {
    enamad: "11012710",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" className="dark" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/vazir-font@30.1.0/dist/font-face.min.css"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const stored = localStorage.getItem("theme");
                const dark = stored ? stored === "dark" : true;
                document.documentElement.classList.toggle("dark", dark);
                document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
                document.documentElement.style.colorScheme = dark ? "dark" : "light";
              } catch {}
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
