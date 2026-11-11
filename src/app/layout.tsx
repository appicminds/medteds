import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { TopBar } from "@/components/blog/top-bar";
import { themeScript } from "@/components/blog/theme-toggle";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const serif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: { default: "MedTeds: ideas in medicine, told well", template: "%s · MedTeds" },
  description: "Stories from clinicians, researchers and students about medicine, health and care.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint (pattern from the Next.js "preventing flash" guide). */}
        <script
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body className="min-h-dvh">
        <TopBar />
        {children}
      </body>
    </html>
  );
}
