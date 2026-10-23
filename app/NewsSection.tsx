'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Globe, Clock, ExternalLink, RefreshCw, Filter } from 'lucide-react';

interface NewsItem {
  title: string;
  pubDate: string;
  link: string;
  description: string;
  source: string;
  image?: string;
  isFallback?: boolean;
}

// ЗАПАСНЫЕ ССЫЛКИ (если источники недоступны)
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
    title: "Бизнес и финансы на Economist.kg",
    pubDate: "",
    link: "https://economist.kg/",
    description: "Новости банков, бизнеса и экономики Кыргызстана.",
    source: "Economist.kg",
    isFallback: true
  }
];

const NEWS_LIMIT = 6;

async function loadFromPhp(): Promise<NewsItem[]> {
  const res = await fetch('/news.php', { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: { news: NewsItem[] } = await res.json();
  return data.news;
}

async function loadFrom24kg(): Promise<NewsItem[]> {
  const res = await fetch('https://24.kg/ekonomika/rss/', { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // DOMParser не выполняет скрипты из чужого XML/HTML
  const xml = new DOMParser().parseFromString(await res.text(), 'text/xml');
  const toText = (html: string) =>
    (new DOMParser().parseFromString(html, 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim();

  return Array.from(xml.querySelectorAll('item'))
    .slice(0, NEWS_LIMIT)
    .flatMap((item) => {
      const title = toText(item.querySelector('title')?.textContent || '');
      const link = item.querySelector('link')?.textContent?.trim() || '';
      const date = new Date(item.querySelector('pubDate')?.textContent || '');
      if (!title || !link.startsWith('https://') || isNaN(date.getTime())) return [];

      let description = toText(item.querySelector('description')?.textContent || '');
      if (description.length > 160) description = description.slice(0, 157).trimEnd() + '…';
      const enclosure = item.querySelector('enclosure');
      const image = enclosure?.getAttribute('type')?.startsWith('image') ? enclosure.getAttribute('url') || undefined : undefined;

      return [{ title, link, description, pubDate: date.toISOString(), source: '24.kg', image }];
    });
}

export default function NewsSection() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  // 1) /news.php на хостинге собирает и кэширует 24.kg + Economist.kg
  // 2) если PHP недоступен — читаем RSS 24.kg прямо из браузера (он разрешает CORS)
  // 3) иначе показываем запасные ссылки
  const fetchNews = useCallback(async () => {
    for (const load of [loadFromPhp, loadFrom24kg]) {
      try {
        const items = await load();
        if (items.length > 0) {
          setNews(items);
          setIsLive(true);
          setLoading(false);
          return;
        }
      } catch {
        // пробуем следующий источник
      }
    }
    setNews(FALLBACK_RESOURCES);
    setIsLive(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- состояние меняется только после await
    fetchNews();
  }, [fetchNews]);

  const formatDateTime = (dateStr: string, isFallback?: boolean) => {
    if (isFallback) return "Раздел";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Свежее";
    return date.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Bishkek'
    });
  };

  return (
    <section className="py-20 px-4 bg-slate-50 relative z-20 border-t border-slate-200">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
            <div>
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4 ${isLive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'}`}>
                    {isLive ? <Filter size={14} /> : <Globe size={14} />}
                    {isLive ? 'Live: Экономика и финансы' : 'Полезные ресурсы'}
                </div>
                <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-2">
                    Экономическая сводка
                </h2>
                <p className="text-slate-500">
                    {isLive ? 'Последние новости бизнеса и финансов Кыргызстана' : 'Прямые ссылки на разделы'}
                </p>
            </div>

            <button
                onClick={() => { setLoading(true); fetchNews(); }}
                disabled={loading}
                className="text-blue-900 font-bold flex items-center gap-2 hover:opacity-70 transition text-sm md:text-base cursor-pointer disabled:opacity-50"
            >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> {loading ? 'Обновление...' : 'Обновить'}
            </button>
        </div>

        {loading && news.length === 0 ? (
            <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-blue-900" size={40} />
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((item) => (
                <a
                    key={item.link}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block h-full"
                >
                    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 hover:-translate-y-1 transition duration-300 h-full flex flex-col overflow-hidden">
                        {item.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={item.image}
                                alt=""
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="w-full aspect-[16/9] object-cover bg-slate-100"
                            />
                        )}
                        <div className="p-6 flex flex-col flex-grow">
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
                            {item.description && (
                                <p className="text-slate-500 text-sm leading-relaxed mb-4 line-clamp-3">
                                    {item.description}
                                </p>
                            )}
                            <div className="text-blue-700 text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all mt-auto pt-4 border-t border-slate-50">
                                {item.isFallback ? 'Перейти в раздел' : `Читать на ${item.source}`} <ExternalLink size={14} />
                            </div>
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
