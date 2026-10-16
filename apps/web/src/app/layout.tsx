import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://institutes.prepzii.com"),
  title: "PrepZii for Institutes | Coaching Institute Management System & LMS",
  description:
    "The all-in-one multi-tenant coaching management software for JEE, NEET, UPSC & State exam institutes across India. CBT mock simulator, admissions CRM, fee ledgers, and attendance.",
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
  const fontClasses = "font-sans antialiased";

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
