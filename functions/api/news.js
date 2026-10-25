
const queries = {
  ekonomi: "Türkiye ekonomi finans",
  "altın": "gram altın altın fiyatları",
  "döviz": "dolar euro döviz kurları",
  borsa: "Borsa İstanbul BIST"
};

const feeds = {
  ekonomi: [
    "https://www.trthaber.com/ekonomi_articles.rss",
    "https://www.aa.com.tr/tr/rss/default?cat=ekonomi"
  ],
  "altın": [],
  "döviz": [],
  borsa: []
};

function decode(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getValue(xml, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(
    new RegExp(
      `<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`,
      "i"
    )
  );

  return decode(match?.[1] || "").trim();
}

function getAttribute(tag, attribute) {
  const escaped = attribute.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const match = tag.match(
    new RegExp(
      `\\b${escaped}\\s*=\\s*["']([^"']+)["']`,
      "i"
    )
  );

  return decode(match?.[1] || "").trim();
}

function validImage(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

function extractImage(xml) {
  // RSS Media RSS görselleri
  const mediaContent = xml.match(
    /<media:content\b[^>]*>/i
  );

  if (mediaContent) {
    const type = getAttribute(
      mediaContent[0],
      "type"
    );

    if (!type || type.startsWith("image/")) {
      const image = validImage(
        getAttribute(mediaContent[0], "url")
      );

      if (image) return image;
    }
  }

  // Küçük haber görseli
  const thumbnail = xml.match(
    /<media:thumbnail\b[^>]*>/i
  );

  if (thumbnail) {
    const image = validImage(
      getAttribute(thumbnail[0], "url")
    );

    if (image) return image;
  }

  // RSS enclosure görseli
  const enclosures = [
    ...xml.matchAll(/<enclosure\b[^>]*>/gi)
  ];

  for (const match of enclosures) {
    const type = getAttribute(
      match[0],
      "type"
    );

    if (type.startsWith("image/")) {
      const image = validImage(
        getAttribute(match[0], "url")
      );

      if (image) return image;
    }
  }

  return null;
}

function parseRSS(xml, fallbackSource) {
  return [
    ...xml.matchAll(
      /<item\b[^>]*>([\s\S]*?)<\/item>/gi
    )
  ]
    .slice(0, 30)
    .map(match => {
      const item = match[1];

      return {
        title: getValue(item, "title"),
        link: getValue(item, "link"),
        source:
          getValue(item, "source") ||
          fallbackSource,
        date: getValue(item, "pubDate"),
        image: extractImage(item)
      };
    })
    .filter(item =>
      item.title &&
      /^https:\/\//i.test(item.link)
    );
}

async function fetchFeed(url, source) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    7000
  );

  try {
    const response = await fetch(url, {
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
    const items = parseRSS(xml, source);

    if (!items.length) {
      throw new Error(
        "RSS içerisinde haber bulunamadı"
      );
    }

    return items;
  } finally {
    clearTimeout(timeout);
  }
}

export async function onRequestGet({ request }) {
  const topic = new URL(request.url)
    .searchParams.get("topic") || "ekonomi";

  const selected = Object.hasOwn(
    queries,
    topic
  ) ? topic : "ekonomi";

  const googleURL =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(queries[selected]) +
    "&hl=tr&gl=TR&ceid=TR:tr";

  const sources = [
    {
      url: googleURL,
      name: "Google News"
    },
    ...(feeds[selected] || []).map(url => ({
      url,
      name: url.includes("trthaber")
        ? "TRT Haber"
        : "Anadolu Ajansı"
    }))
  ];

  const results = await Promise.allSettled(
    sources.map(source =>
      fetchFeed(source.url, source.name)
    )
  );

  const items = [];
  const errors = [];
  const seen = new Set();

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      for (const item of result.value) {
        const key =
          item.title.toLocaleLowerCase("tr-TR");

        if (!seen.has(key)) {
          seen.add(key);
          items.push(item);
        }
      }
    } else {
      errors.push({
        source: sources[index].name,
        message: String(
          result.reason?.message ||
          "Bilinmeyen hata"
        )
      });
    }
  });

  items.sort(
    (a, b) =>
      (Date.parse(b.date) || 0) -
      (Date.parse(a.date) || 0)
  );

  return new Response(
    JSON.stringify({
      items: items.slice(0, 12),
      error: items.length
        ? null
        : "Haber kaynaklarına erişilemedi",
      diagnostics: errors
    }),
    {
      status: items.length ? 200 : 503,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control":
          "public, max-age=600"
      }
    }
  );
}
