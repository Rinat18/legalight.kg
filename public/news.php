<?php
// Сборщик новостей для блока «Экономическая сводка».
// Сайт лежит на статичном хостинге, поэтому RSS читаем здесь (на PHP), а не в Next.js.
// Результат кэшируется в файл на 15 минут.

// Предупреждения PHP не должны ломать JSON
ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

define('CACHE_TTL', 900);
define('LIMIT', 6);

$cacheFile = sys_get_temp_dir() . '/legalight_news_cache.json';

if (is_file($cacheFile) && time() - filemtime($cacheFile) < CACHE_TTL) {
    readfile($cacheFile);
    exit;
}

$sources = [
    ['name' => '24.kg', 'url' => 'https://24.kg/ekonomika/rss/', 'categories' => null],
    [
        'name' => 'Economist.kg',
        'url' => 'https://economist.kg/rss/',
        // Из общей ленты берём только бизнес и финансы
        'categories' => ['Экономика', 'Бизнес', 'Деньги', 'Банки', 'Финансы', 'Технологии', 'Недвижимость'],
    ],
];

$months = [
    'янв' => 1, 'фев' => 2, 'мар' => 3, 'апр' => 4, 'мая' => 5, 'май' => 5, 'июн' => 6,
    'июл' => 7, 'авг' => 8, 'сен' => 9, 'окт' => 10, 'ноя' => 11, 'дек' => 12,
];

function fetch_url(string $url): ?string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; LegaLightBot/1.0)',
        ]);
        $body = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        return ($body !== false && $code === 200) ? $body : null;
    }
    $context = stream_context_create(['http' => [
        'timeout' => 8,
        'user_agent' => 'Mozilla/5.0 (compatible; LegaLightBot/1.0)',
    ]]);
    $body = @file_get_contents($url, false, $context);
    return $body === false ? null : $body;
}

function by_date_desc(array $a, array $b): int
{
    return strcmp($b['pubDate'], $a['pubDate']);
}

function clean(string $raw): string
{
    $text = html_entity_decode(strip_tags($raw), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return trim(preg_replace('/\s+/u', ' ', $text));
}

// Понимает RFC 822 и русскую локаль economist.kg («пт, 23 окт. 2026 12:08:03 +0600»)
function parse_date(string $raw, array $months): ?int
{
    $ts = strtotime($raw);
    if ($ts !== false) {
        return $ts;
    }
    if (!preg_match('/(\d{1,2})\s+(\p{L}+)\.?\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{4})?/u', $raw, $m)) {
        return null;
    }
    $month = $months[mb_substr(mb_strtolower($m[2]), 0, 3)] ?? null;
    if ($month === null) {
        return null;
    }
    $iso = sprintf('%04d-%02d-%02dT%s:%s:%s%s', $m[3], $month, $m[1], $m[4], $m[5], !empty($m[6]) ? $m[6] : '00', !empty($m[7]) ? $m[7] : '+0600');
    $ts = strtotime($iso);
    return $ts === false ? null : $ts;
}

$queues = [];
foreach ($sources as $source) {
    $xmlText = fetch_url($source['url']);
    if ($xmlText === null) {
        continue;
    }
    $xml = @simplexml_load_string($xmlText, 'SimpleXMLElement', LIBXML_NOCDATA);
    if ($xml === false || !isset($xml->channel->item)) {
        continue;
    }

    $items = [];
    foreach ($xml->channel->item as $item) {
        $category = clean((string) $item->category);
        if ($source['categories'] !== null && !in_array($category, $source['categories'], true)) {
            continue;
        }

        $title = clean((string) $item->title);
        $link = trim((string) $item->link);
        $ts = parse_date(trim((string) $item->pubDate), $months);
        if ($title === '' || strpos($link, 'https://') !== 0 || $ts === null) {
            continue;
        }

        $description = clean((string) $item->description);
        if (mb_strlen($description) > 160) {
            $description = rtrim(mb_substr($description, 0, 157)) . '…';
        }

        // 24.kg: <enclosure type="image/...">, economist.kg: <media:content medium="image">
        $image = null;
        if (isset($item->enclosure) && strpos((string) $item->enclosure['type'], 'image') === 0) {
            $image = (string) $item->enclosure['url'];
        }
        $media = $item->children('http://search.yahoo.com/mrss/');
        if ($image === null && isset($media->content) && (string) $media->content->attributes()->medium === 'image') {
            $image = (string) $media->content->attributes()->url;
        }
        if ($image !== null && strpos($image, 'https://') !== 0) {
            $image = null;
        }

        $items[] = [
            'title' => $title,
            'link' => $link,
            'description' => $description,
            'pubDate' => gmdate('Y-m-d\TH:i:s\Z', $ts),
            'source' => $source['name'],
            'image' => $image,
        ];
    }
    usort($items, 'by_date_desc');
    $queues[] = $items;
}

// Берём из источников по очереди, чтобы один частый источник не занял всю ленту
$news = [];
$seen = [];
while (count($news) < LIMIT && array_filter($queues)) {
    foreach ($queues as &$queue) {
        $item = array_shift($queue);
        if ($item === null || count($news) >= LIMIT) {
            continue;
        }
        $key = mb_strtolower($item['title']);
        if (isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;
        $news[] = $item;
    }
    unset($queue);
}
usort($news, 'by_date_desc');

$json = json_encode(['news' => $news, 'updatedAt' => gmdate('c')], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

// Пустой результат не кэшируем, чтобы при сбое источников быстро восстановиться
if ($news) {
    @file_put_contents($cacheFile, $json, LOCK_EX);
}
echo $json;
