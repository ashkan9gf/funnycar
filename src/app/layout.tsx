import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "فانی‌کار — FunnyCarIR",
  description:
    "بازی موبایلی طنز فارسی: رانندگی کارتونی از نمای بالا با طنز روزمره خیابان‌های ایران. پارک دوبل، بوق، چاله، تاکسی و پلیس بامزه!",
  keywords: ["بازی", "فارسی", "طنز", "رانندگی", "ماشین", "FunnyCarIR"],
  authors: [{ name: "FunnyCarIR Team" }],
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2A9D8F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground font-vazir">
        {children}
      </body>
    </html>
  );
}
