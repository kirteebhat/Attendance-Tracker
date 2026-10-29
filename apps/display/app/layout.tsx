import React from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VorldX Office Attendance Display",
  description: "Dedicated full-screen terminal kiosk showing dynamic rotating attendance QR code",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-brand-950 text-slate-100 min-h-screen select-none font-sans antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}

