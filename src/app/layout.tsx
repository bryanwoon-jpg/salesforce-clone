import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Cumulus CRM", template: "%s | Cumulus CRM" },
  description: "A Salesforce-style CRM built on Next.js and Supabase.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
