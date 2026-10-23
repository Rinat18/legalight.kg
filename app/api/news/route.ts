import { NextResponse } from 'next/server';

// Новости тянем на сервере напрямую из RSS (без сторонних прокси) и кэшируем на 15 минут
export const revalidate = 900;

export interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string; // ISO
  source: string;
  image?: string;
}

const SOURCES = [
  { name: '24.kg', url: 'https://24.kg/ekonomika/rss/', categories: null },
  {
    name: 'Economist.kg',
    url: 'https://economist.kg/feed/',
    // Из общей ленты берём только бизнес и финансы
    categories: ['Экономика', 'Бизнес', 'Деньги', 'Банки', 'Финансы', 'Технологии', 'Недвижимость'],
  },
];

const LIMIT = 6;

const MONTHS: Record<string, number> = {
  янв: 0, фев: 1, мар: 2, апр: 3, мая: 4, май: 4, июн: 5,
  июл: 6, авг: 7, сен: 8, окт: 9, ноя: 10, дек: 11,
};

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', laquo: '«', raquo: '»', hellip: '…',
};

function decode(raw: string) {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(xml: string, name: string) {
  const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return match ? decode(match[1]) : '';
}

// Понимает и RFC 822 ("Fri, 23 Oct 2026 11:01:01 +0600"), и русскую локаль economist.kg ("пт, 23 окт. 2026 12:08:03 +0600")
function parseDate(raw: string) {
  const native = new Date(raw);
  if (!isNaN(native.getTime())) return native;

  const m = raw.match(/(\d{1,2})\s+([а-я]+)\.?\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{4})?/i);
  const month = m ? MONTHS[m[2].toLowerCase().slice(0, 3)] : undefined;
  if (!m || month === undefined) return null;

  const offset = m[7] ?? '+0600';
  const iso = `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}T${m[4]}:${m[5]}:${m[6] ?? '00'}${offset.slice(0, 3)}:${offset.slice(3)}`;
  const date = new Date(iso);
  return isNaN(date.getTime()) ? null : date;
}

async function loadSource(source: (typeof SOURCES)[number]): Promise<NewsItem[]> {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LegaLightBot/1.0)' },
    signal: AbortSignal.timeout(8000),
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`${source.name}: HTTP ${res.status}`);
  const xml = await res.text();

  const items: NewsItem[] = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const category = tag(item, 'category');
    if (source.categories && !source.categories.includes(category)) continue;

    const title = tag(item, 'title');
    const link = tag(item, 'link');
    const date = parseDate(tag(item, 'pubDate'));
    if (!title || !link.startsWith('https://') || !date) continue;

    let description = tag(item, 'description');
    if (description.length > 160) description = description.slice(0, 157).trimEnd() + '…';

    // 24.kg: <enclosure type="image/...">, economist.kg: <media:content medium="image">
    const mediaTag = item.match(/<(?:enclosure|media:content)\b[^>]*(?:type|medium)="image[^>]*>/)?.[0];
    const image = mediaTag?.match(/url="(https:[^"]+)"/)?.[1];

    items.push({ title, link, description, pubDate: date.toISOString(), source: source.name, image });
  }
  return items;
}

export async function GET() {
  const results = await Promise.allSettled(SOURCES.map(loadSource));

  const byDate = (a: NewsItem, b: NewsItem) => b.pubDate.localeCompare(a.pubDate);
  const queues = results.flatMap((result) => {
    if (result.status === 'rejected') {
      console.warn('Источник новостей недоступен:', result.reason);
      return [];
    }
    return [result.value.sort(byDate)];
  });

  // Берём из источников по очереди, чтобы один частый источник не занял всю ленту
  const seen = new Set<string>();
  const news: NewsItem[] = [];
  while (news.length < LIMIT && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const item = queue.shift();
      if (!item || news.length >= LIMIT) continue;
      const key = item.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      news.push(item);
    }
  }
  news.sort(byDate);

  return NextResponse.json({ news, updatedAt: new Date().toISOString() });
}
