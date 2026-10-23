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

const description =
  "Юридическая компания LegaLight в Бишкеке: лицензирование платежных систем, МФО и МКК, регистрация компаний, юридический аутсорсинг и суды. +996 (772) 77-44-33";

export const metadata: Metadata = {
  metadataBase: new URL("https://legalight.vercel.app"),
  title: {
    default: "LegaLight — Юридические услуги в Бишкеке",
    template: "%s | LegaLight",
  },
  description,
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    type: "website",
    locale: "ru_KG",
    siteName: "LegaLight",
    title: "LegaLight — Юридические услуги в Бишкеке",
    description,
  },
};

// Разметка организации для поисковиков (карточка в Google/Яндекс)
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "LegalService",
  name: "LegaLight",
  legalName: "ОсОО «Легалайт»",
  url: "https://legalight.vercel.app",
  telephone: ["+996772774433", "+996554900928"],
  email: "info@legalight.kg",
  address: {
    "@type": "PostalAddress",
    streetAddress: "ул. Токтогула 125/1, БЦ «Авангард», Tower B",
    addressLocality: "Бишкек",
    addressCountry: "KG",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}