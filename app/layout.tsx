import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import { Shell } from "@/components/shell";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: {
    default: "BuzzFi",
    template: "%s · BuzzFi",
  },
  description: "A local personal finance app that reads statement files from your computer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${fraunces.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
