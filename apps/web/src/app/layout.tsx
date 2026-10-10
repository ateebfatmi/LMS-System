import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Rajdhani, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-prepzii-display",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-prepzii-body",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-prepzii-mono",
});

export const metadata: Metadata = {
  title: "PrepZii for Institutions | JEE & NEET Coaching LMS",
  description:
    "The structured way to crack JEE & NEET. Practice PYQs, take mock tests, revise formula handbooks, detect weak chapters, and analyze student performance.",
  icons: {
    icon: [
      { url: "/images/branding/prepzii-official-logo.png", type: "image/png" },
    ],
    apple: "/images/branding/prepzii-official-logo.png",
  },
  openGraph: {
    title: "PrepZii for Institutions | JEE & NEET Learning Management System",
    description:
      "A calm, focused workspace for coaching institutes and schools to manage batches, faculty, tests, and student analytics.",
    images: ["/images/branding/prepzii-official-logo.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const fontClasses = `${rajdhani.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased`;

  if (hasClerk) {
    return (
      <ClerkProvider>
        <html lang="en" className={fontClasses} data-scroll-behavior="smooth">
          <head>
            <link rel="icon" href="/images/branding/prepzii-official-logo.png" type="image/png" />
          </head>
          <body>{children}</body>
        </html>
      </ClerkProvider>
    );
  }

  return (
    <html lang="en" className={fontClasses} data-scroll-behavior="smooth">
      <head>
        <link rel="icon" href="/images/branding/prepzii-official-logo.png" type="image/png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
