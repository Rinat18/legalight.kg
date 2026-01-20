'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, TrendingUp, Globe, Clock, ExternalLink, RefreshCw, Filter } from 'lucide-react';

interface NewsItem {
  title: string;
  pubDate: string;
  link: string;
  description: string;
  source: string;
  isFallback?: boolean;
}

// ЗАПАСНЫЕ ССЫЛКИ
const FALLBACK_RESOURCES: NewsItem[] = [
  {
    title: "Раздел Экономика на 24.kg",
    pubDate: "",
    link: "https://24.kg/ekonomika/",
    description: "Перейти к полному списку экономических новостей.",
    source: "24.kg",
    isFallback: true
  },
  {
    title: "Курсы валют (НБКР)",
    pubDate: "",
    link: "https://www.nbkr.kg/",
    description: "Официальные курсы и статистика.",
    source: "НБКР",
    isFallback: true
  },
  {
    title: "Финансовый портал Akchabar",
    pubDate: "",
    link: "https://www.akchabar.kg/ru/news/",
    description: "Новости банковского сектора.",
    source: "Akchabar",
    isFallback: true
  }
];

export default function NewsSection() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    fetchNews();
  }, []);

  // --- ФУНКЦИЯ ДЛЯ ОЧИСТКИ ТЕКСТА ОТ МУСОРА (&nbsp;, &mdash;) ---
  const cleanText = (rawText: string) => {
    if (!rawText) return "";
    
    // 1. Создаем временный элемент, чтобы браузер сам расшифровал HTML-символы
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = rawText;
    let decoded = tempDiv.textContent || rawText;

    // 2. Дополнительная зачистка, если браузер пропустил
    decoded = decoded
        .replace(/&nbsp;/g, ' ')
        .replace(/&mdash;/g, '—')
        .replace(/&quot;/g, '"')
        .replace(/&laquo;/g, '«')
        .replace(/&raquo;/g, '»')
        .replace(/&amp;/g, '&');

    return decoded.trim();
  };

  async function fetchNews() {
    setLoading(true);

    const SOURCES = [
      {
        name: '24.kg',
        url: 'https://24.kg/rss/', 
        type: 'direct'
      },
      {
        name: 'Google News',
        url: 'https://news.google.com/rss/search?q=site:24.kg+ekonomika&hl=ru&gl=KG&ceid=KG:ru',
        type: 'google'
      }
    ];

    const PROXY_DIRECT = 'https://api.codetabs.com/v1/proxy?quest=';
    const PROXY_GOOGLE = 'https://api.rss2json.com/v1/api.json?api_key=0&rss_url=';
    const timestamp = new Date().getTime();

    let foundNews: NewsItem[] = [];

    for (const source of SOURCES) {
      if (foundNews.length >= 3) break;

      try {
        let response;
        let dataItems = [];

        if (source.type === 'direct') {
          // Читаем XML через CodeTabs
          const fetchUrl = `${PROXY_DIRECT}${encodeURIComponent(source.url)}&dummy=${timestamp}`;
          response = await fetch(fetchUrl, { signal: AbortSignal.timeout(6000) });
          if (!response.ok) continue;

          const xmlText = await response.text();
          const parser = new DOMParser();
          const xml = parser.parseFromString(xmlText, "text/xml");
          const items = xml.querySelectorAll("item");
          
          items.forEach(item => {
             let title = item.querySelector("title")?.textContent || "";
             let link = item.querySelector("link")?.textContent || "";
             const pubDate = item.querySelector("pubDate")?.textContent || "";
             let description = item.querySelector("description")?.textContent || "";

             // Чиним ссылки
             if (link.startsWith('/')) link = `https://24.kg${link}`;
             if (!link.startsWith('http')) link = `https://24.kg/${link.replace(/^\//, '')}`;

             // --- ЧИСТИМ ЗАГОЛОВОК И ОПИСАНИЕ ТУТ ---
             title = cleanText(title);
             description = cleanText(description);

             dataItems.push({ title, link, pubDate, description });
          });
        } else {
          // Читаем Google JSON
          const fetchUrl = `${PROXY_GOOGLE}${encodeURIComponent(source.url)}&t=${timestamp}`;
          response = await fetch(fetchUrl);
          if (!response.ok) continue;
          const data = await response.json();
          if (data.items) dataItems = data.items;
        }

        // ФИЛЬТР: ОСТАВЛЯЕМ ТОЛЬКО ЭКОНОМИКУ
        dataItems.forEach((item: any) => {
           if (foundNews.length >= 3) return;

           const linkLower = item.link.toLowerCase();
           const titleLower = item.title.toLowerCase();

           const isEconomics = 
                linkLower.includes('/ekonomika/') || 
                linkLower.includes('/economics/') ||
                titleLower.includes('ювелир') || // костыль для вашей конкретной новости, если ссылка другая
                titleLower.includes('банк') ||
                titleLower.includes('экспорт') ||
                titleLower.includes('импорт') ||
                titleLower.includes('цена') ||
                titleLower.includes('сом');

           if (isEconomics) {
               // Финальная очистка перед добавлением
               let cleanTitle = cleanText(item.title);
               let cleanDesc = cleanText(item.description);

               cleanDesc = cleanDesc.replace(/Google News/g, "").replace(/Посмотреть статью полностью/g, "");
               if (cleanDesc.length > 110) cleanDesc = cleanDesc.slice(0, 110) + "...";
               if (cleanDesc.length < 5) cleanDesc = "Нажмите для перехода к новости.";

               foundNews.push({
                 title: cleanTitle,
                 pubDate: item.pubDate,
                 link: item.link,
                 description: cleanDesc,
                 source: "24.kg",
                 isFallback: false
               });
           }
        });

      } catch (e) {
        console.warn(`Источник ${source.name} пропущен`);
      }
    }

    if (foundNews.length > 0) {
      setNews(foundNews);
      setIsLive(true);
    } else {
      setNews(FALLBACK_RESOURCES);
      setIsLive(false);
    }
    setLoading(false);
  }

  const formatDateTime = (dateStr: string, isFallback?: boolean) => {
    if (isFallback) return "Раздел";
    try {
      const safeDate = dateStr.replace(" ", "T");
      const date = new Date(safeDate);
      if (isNaN(date.getTime())) return "Свежее";
      
      return date.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch { return "Свежее"; }
  };

  return (
    <section className="py-20 px-4 bg-slate-50 relative z-20 border-t border-slate-200">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
            <div>
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4 ${isLive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'}`}>
                    {isLive ? <Filter size={14} /> : <Globe size={14} />} 
                    {isLive ? 'Live: Экономика 24.kg' : 'Полезные ресурсы'}
                </div>
                <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-2">
                    Экономическая сводка
                </h2>
                <p className="text-slate-500">
                    {isLive ? 'Последние новости бизнеса и финансов' : 'Прямые ссылки на разделы'}
                </p>
            </div>
            
            <button 
                onClick={fetchNews} 
                className="text-blue-900 font-bold flex items-center gap-2 hover:opacity-70 transition text-sm md:text-base cursor-pointer"
            >
                <RefreshCw size={18} /> {loading ? 'Обновление...' : 'Обновить'}
            </button>
        </div>

        {loading ? (
            <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-blue-900" size={40} />
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {news.map((item, index) => (
                <a 
                    key={index} 
                    href={item.link} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="group block h-full"
                >
                    <article className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 hover:-translate-y-1 transition duration-300 h-full flex flex-col justify-between">
                        <div>
                            {/* Верхняя строка */}
                            <div className="flex items-center justify-between mb-3">
                                <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${item.isFallback ? 'text-blue-500' : 'text-slate-400'}`}>
                                    {item.isFallback ? <Globe size={12}/> : <Clock size={12} />}
                                    <span>{formatDateTime(item.pubDate, item.isFallback)}</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold max-w-[120px] truncate ${item.isFallback ? 'bg-slate-100 text-slate-600' : 'bg-green-50 text-green-700'}`}>
                                    {item.source}
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-slate-900 mb-3 group-hover:text-blue-900 transition leading-snug line-clamp-3">
                                {item.title}
                            </h3>
                            <p className="text-slate-500 text-sm leading-relaxed mb-4 line-clamp-3">
                                {item.description}
                            </p>
                        </div>
                        <div className="text-blue-700 text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all mt-auto pt-4 border-t border-slate-50">
                            {item.isFallback ? 'Перейти в раздел' : 'Читать на 24.kg'} <ExternalLink size={14} />
                        </div>
                    </article>
                </a>
            ))}
            </div>
        )}
      </div>
    </section>
  );
}