import type { Metadata } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Providers } from "@/app/providers";
import "./globals.css";

const displayFont = Montserrat({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["700", "800", "900"]
});

const sansFont = Open_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: "MKE Black",
  description: "Milwaukee's community-forward Black business directory.",
  icons: {
    icon: "/header-mark.avif"
  }
};

const themeBootstrapScript = `
(function() {
  try {
    var preference = window.localStorage.getItem("mkeblack_theme_preference") || "system";
    var resolved = preference === "light" || preference === "dark"
      ? preference
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = preference;
  } catch (error) {
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.themePreference = "system";
  }
})();
`;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body
        className={`${displayFont.variable} ${sansFont.variable} min-h-screen bg-canvas font-sans text-ink antialiased`}
      >
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <SiteHeader />
            <main className="relative flex-1">{children}</main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
