import type { Metadata } from "next";
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

