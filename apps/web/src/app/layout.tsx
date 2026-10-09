import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prepzii for Institutions",
  description: "A focused learning management system for schools and coaching institutes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
