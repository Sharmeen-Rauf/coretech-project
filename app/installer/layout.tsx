import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CoreTECH Solar - Official Technician & Installer Portal",
  description: "Register and join CoreTECH Solar as a certified installation technician.",
  openGraph: {
    title: "CoreTECH Solar - Technician & Installer Portal",
    description: "Register and join CoreTECH Solar as a certified installation technician.",
    url: "https://www.coretechsolar.com/installer/register",
    siteName: "CoreTECH Solar",
    images: [
      {
        url: "https://www.coretechsolar.com/favicon.svg",
        width: 512,
        height: 512,
        alt: "CoreTECH Solar Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "CoreTECH Solar - Technician & Installer Portal",
    description: "Register and join CoreTECH Solar as a certified installation technician.",
    images: ["https://www.coretechsolar.com/favicon.svg"],
  },
};

export default function InstallerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
