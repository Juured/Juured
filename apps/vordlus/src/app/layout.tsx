import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "võrdlus — Kinnisvara võrdlus · Estonian property comparison",
  description:
    "Võrdle kuni viit Eesti kinnisvaraobjekti kõrvuti: hind, energiamärgis, kasutusluba, elamispind, naabruskond.",
  openGraph: {
    title: "võrdlus",
    description: "Kinnisvara võrdlus — kuni viis objekti kõrvuti.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="et">
      <body className="min-h-screen bg-paper text-body antialiased">{children}</body>
    </html>
  );
}
