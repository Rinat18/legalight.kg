import type { NextConfig } from "next";

// Без output: "export" — на Vercel нужен серверный роут /api/lead,
// который отправляет заявки в Telegram, не раскрывая токен бота.
const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
