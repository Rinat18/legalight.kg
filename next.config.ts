import type { NextConfig } from "next";

// Статичная сборка в папку out/ — она заливается на хостинг (Plesk, satcom.kg).
// Новости собирает public/news.php прямо на хостинге.
const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
