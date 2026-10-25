
const FEEDS = [
  {
    name: "TRT Haber",
    url: "https://www.trthaber.com/ekonomi_articles.rss"
  },
  {
    name: "Anadolu Ajansı",
    url: "https://www.aa.com.tr/tr/rss/default?cat=ekonomi"
  }
];

const KEYWORDS = {
  "altın": [
    /\baltın\b/i,
    /\bgram altın\b/i,
    /\bçeyrek altın\b/i,
    /\baltının\b/i,
    /\baltında\b/i,
    /\bons altın\b/i,
    /\bkülçe\b/i
  ],
  "döviz": [
    /\bdöviz\b/i,
    /\bdolar\b/i,
    /\beuro\b/i,
    /\bavro\b/i,
    /\bsterlin\b/i,
    /\bkur\b/i,
    /\bkurları\b/i,
    /\bparite\b/i,
    /\bmerkez bankası\b/i
  ],
  borsa: [
    /\bborsa\b/i,
    /\bbist\b/i,
    /\bbist 100\b/i,
    /\bhisse\b/i,
    /\bhisseleri\b/i,
    /\bendeks\b/i,
    /\bborsa istanbul\b/i,
    /\bpay piyasası\b/i,
    /\bhalka arz\b/i
  ]
};

function decode(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function getValue(xml, tag) {
  const escaped = tag.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const match = xml.match(
    new RegExp(
      `<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`,
      "i"
    )
  );

  return decode(match?.[1] || "").trim();
}

function getAttribute(tag, attribute) {
  const match = tag.match(
    new RegExp(
      `\\b${attribute}\\s*=\\s*["']([^"']+)["']`,
      "i"
    )
  );

  return decode(match?.[1] || "").trim();
}

function validUrl(value) {
  try {
    const url = new URL(value);

    return url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function extractImage(xml) {
  const media = xml.match(
    /<media:content\b[^>]*>/i
  );

  if (media) {
    const type = getAttribute(media[0], "type");

    if (!type || type.startsWith("image/")) {
      const url = validUrl(
        getAttribute(media[0], "url")
      );

      if (url) return url;
    }
  }

  const thumbnail = xml.match(
    /<media:thumbnail\b[^>]*>/i
  );

  if (thumbnail) {
    const url = validUrl(
      getAttribute(thumbnail[0], "url")
    );

    if (url) return url;
  }

  const enclosures = [
    ...xml.matchAll(/<enclosure\b[^>]*>/gi)
  ];

  for (const match of enclosures) {
    const type = getAttribute(match[0], "type");

    if (type.startsWith("image/")) {
      const url = validUrl(
        getAttribute(match[0], "url")
      );

      if (url) return url;
    }
  }

  return null;
}

function parseRSS(xml, source) {
  return [
    ...xml.matchAll(
      /<item\b[^>]*>([\s\S]*?)<\/item>/gi
    )
  ]
    .slice(0, 100)
    .map(match => {
      const item = match[1];

      return {
        title: getValue(item, "title"),
        link: getValue(item, "link"),
        source,
        date: getValue(item, "pubDate"),
        image: extractImage(item)
      };
    })
    .filter(item =>
      item.title &&
      validUrl(item.link)
    );
}

async function fetchFeed(feed) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    9000
  );

  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        Accept:
          "application/rss+xml, application/xml, text/xml",
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const xml = await response.text();

    const items = parseRSS(xml, feed.name);

    if (!items.length) {
      throw new Error("RSS boş veya okunamadı");
    }

    return items;
  } finally {
    clearTimeout(timeout);
  }
}

function matchesTopic(item, topic) {
  if (topic === "ekonomi") {
    return true;
  }

  const patterns = KEYWORDS[topic];

  if (!patterns) {
    return false;
  }

  return patterns.some(pattern =>
    pattern.test(item.title)
  );
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);

  const requested =
    url.searchParams.get("topic") || "ekonomi";

  const topic = [
    "ekonomi",
    "altın",
    "döviz",
    "borsa"
  ].includes(requested)
    ? requested
    : "ekonomi";

  const results = await Promise.allSettled(
    FEEDS.map(fetchFeed)
  );

  const allItems = [];
  const diagnostics = [];
  const seen = new Set();

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      for (const item of result.value) {
        const key = item.title
          .toLocaleLowerCase("tr-TR")
          .trim();

        if (!seen.has(key)) {
          seen.add(key);
          allItems.push(item);
        }
      }
    } else {
      diagnostics.push({
        source: FEEDS[index].name,
        message: String(
          result.reason?.message ||
          "Bilinmeyen hata"
        )
      });
    }
  });

  const items = allItems
    .filter(item => matchesTopic(item, topic))
    .sort(
      (a, b) =>
        (Date.parse(b.date) || 0) -
        (Date.parse(a.date) || 0)
    )
    .slice(0, 12);

  const sourcesAvailable =
    results.some(r => r.status === "fulfilled");

  return new Response(
    JSON.stringify({
      items,
      error: !sourcesAvailable
        ? "Haber kaynaklarına erişilemedi"
        : items.length === 0
          ? "Bu kategoride güncel haber bulunamadı"
          : null,
      diagnostics
    }),
    {
      status: sourcesAvailable ? 200 : 503,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control":
          "public, max-age=300"
      }
    }
  );
}
