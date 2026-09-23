import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "S-CUBUS Fee Portal",
  description: "Admission fee calculator and business dashboard for S-CUBUS"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
