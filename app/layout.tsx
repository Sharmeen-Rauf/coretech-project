import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "CoreTECH Solar - Enterprise Management System",
    template: "%s | CoreTECH Solar",
  },
  description: "CoreTECH Solar distribution, inventory management, and technician network platform.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "CoreTECH Solar Platform",
    description: "CoreTECH Solar distribution, inventory management, and technician network platform.",
    url: "https://www.coretechsolar.com",
    siteName: "CoreTECH Solar",
    images: [
      {
        url: "https://www.coretechsolar.com/favicon.svg",
        width: 512,
        height: 512,
        alt: "CoreTECH Solar Logo",
      },
    ],
    type: "website",
  },
};

// Next injects a default width=device-width viewport tag when this isn't
// declared, so phones already scaled - but nothing was declared, which left
// two things unset that matter on mobile:
//   - interactiveWidget: without it, the phone keyboard opening resizes the
//     visual viewport and shoves `fixed` elements (Topbar, modal footers)
//     around. 'resizes-content' keeps the layout viewport stable instead.
//   - maximumScale/userScalable: left explicit and permissive on purpose.
//     Pinch-zoom must stay available - disabling it is an accessibility
//     regression, and it is NOT the fix for iOS's focus-zoom (that's the
//     16px input rule in globals.css).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased bg-[#F8FAFC]`}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}

