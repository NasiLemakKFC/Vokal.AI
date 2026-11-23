import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
import "./globals.css";

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Vokal.ai — Real-Time Voice & Vision Interview Coach",
  description:
    "Vokal.ai is a real-time multimodal behavioral interview studio with client-side computer vision and speech telemetry for STAR structure, eye contact, posture, and fluency.",
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('vokalai_theme');var m=localStorage.getItem('vokalai_mode');var theme=(t==='editorial'||t==='studio'||t==='bento')?t:'editorial';var mode=(m==='light'||m==='dark'||m==='system')?m:'light';var sys=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var res=mode==='system'?sys:mode;var r=document.documentElement;r.dataset.theme=theme;r.dataset.mode=res;r.style.colorScheme=res;if(res==='dark'){r.classList.add('dark');}else{r.classList.remove('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="editorial"
      data-mode="light"
      suppressHydrationWarning
      className={`${instrument.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,300..500,0..1,-50..200&display=swap"
        />
      </head>
      <body className="min-h-full bg-[var(--ground)] text-[var(--text)] font-sans">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
