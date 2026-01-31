import type { Metadata } from "next";
// Импортируем новые шрифты: Montserrat и Lora
import { Montserrat, Lora } from "next/font/google";
import "./globals.css";

// Настраиваем Montserrat (широкий, современный)
const montserrat = Montserrat({ 
  subsets: ["latin", "cyrillic"], 
  variable: '--font-montserrat',
  display: 'swap',
});

// Настраиваем Lora (элегантный с засечками)
const lora = Lora({ 
  subsets: ["latin", "cyrillic"], 
  variable: '--font-lora',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "LegaLight — Юридические услуги в Бишкеке",
  description: "Юридическая помощь, бухгалтерия и HR услуги. +996 (772) 77-44-33",
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="scroll-smooth">
      {/* Добавляем новые переменные в body */}
      <body className={`${montserrat.variable} ${lora.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}