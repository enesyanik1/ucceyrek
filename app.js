
const $ = s => document.querySelector(s);

const money = (n, d = 2) =>
  Number(n).toLocaleString('tr-TR', {
    minimumFractionDigits: d,
    maximumFractionDigits: d
  });

const safe = s =>
  String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

// Yalnızca görsellerin yeniden yayınlama izni
// doğrulandığında true yapılmalıdır.
const HABER_GORSELLERINE_IZIN_VAR = false;

const today = new Date();

$('#date').textContent = today.toLocaleDateString(
  'tr-TR',
  {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }
);

$('#year').textContent = today.getFullYear();

const goldCodes = [
  'GRAM_ALTIN_TRY',
  'CEYREK_YENI_TRY',
  'YARIM_YENI_TRY',
  'TAM_YENI_TRY',
  'ATA_YENI_TRY',
  'HAS_ALTIN_TRY',
  'ONS_ALTIN_USD'
];

const fxCodes = [
  'USD_TRY',
  'EUR_TRY',
  'GBP_TRY'
];

/* ALTIN VE DÖVİZ */

function price(v, item) {
  if (v == null || !Number.isFinite(Number(v))) {
    return 'Veri yok';
  }

  const decimals =
    item.birim === 'TRY' && Number(v) < 100
      ? 4
      : 2;

  return (
    (item.birim === 'USD' ? '$ ' : '₺ ') +
    money(v, decimals)
  );
}

function stale(item) {
  const t = new Date(item.guncelleme).getTime();

  return (
    !Number.isFinite(t) ||
    Date.now() - t > 3600000
  );
}

function change(item) {
  if (item.degisim24s == null) {
    return 'Değişim yok';
  }

  const n = Number(item.degisim24s);

  return (
    '24s: ' +
    (n > 0 ? '+' : '') +
    money(n) +
    '%'
  );
}

function card(item) {
  return `
    <div class="pricecard">
      <div class="label">
        ${safe(item.etiket)}
      </div>

      <div class="price">
        ${price(item.satis, item)}
      </div>

      <div class="sub">
        Alış: ${price(item.alis, item)}
      </div>

      <div class="sub">
        Satış: ${price(item.satis, item)}
      </div>

      <div class="sub">
        ${safe(change(item))}
      </div>

      <div class="sub">
        ${stale(item)
          ? '⚠ Eski veri'
          : 'Güncel veri'}
      </div>
    </div>
  `;
}

function row(item) {
  return `
    <tr>
      <td>
        ${safe(item.etiket)}
        ${stale(item) ? ' ⚠' : ''}
      </td>

      <td>${price(item.alis, item)}</td>
      <td>${price(item.satis, item)}</td>
    </tr>
  `;
}

async function markets() {
  try {
    const r = await fetch('/api/markets', {
      cache: 'no-store'
    });

    if (!r.ok) {
      throw Error('Fiyat API hatası');
    }

    const data = await r.json();

    if (!data.success || !data.kalemler) {
      throw Error('Fiyat bulunamadı');
    }

    const k = data.kalemler;

    const gold = goldCodes
      .map(c => k[c])
      .filter(Boolean);

    const fx = fxCodes
      .map(c => k[c])
      .filter(Boolean);

    const summary = [
      'GRAM_ALTIN_TRY',
      'CEYREK_YENI_TRY',
      'YARIM_YENI_TRY',
      'TAM_YENI_TRY',
      'USD_TRY',
      'EUR_TRY'
    ]
      .map(c => k[c])
      .filter(Boolean);

    $('#summary').innerHTML =
      summary.map(card).join('');

    $('#ticker').innerHTML =
      summary.map(i => `
        <span>
          ${safe(i.etiket)}
          <b>${price(i.satis, i)}</b>
        </span>
      `).join('');

    $('#goldrows').innerHTML =
      gold.map(row).join('');

    $('#fxrows').innerHTML =
      fx.map(row).join('');

    $('#updated').textContent =
      'Son kontrol: ' +
      new Date(data.fetchedAt)
        .toLocaleTimeString('tr-TR', {
          timeZone: 'Europe/Istanbul',
          hour: '2-digit',
          minute: '2-digit'
        });

    $('#market-note').textContent =
      'Alış-satış fiyatları Hesaplı Altın veri sağlayıcısından alınır. ' +
      '⚠ işareti bir saatten eski fiyatları belirtir. ' +
      'Fiyatlar işlem yapılan kuruma göre değişebilir. ' +
      'Kaynak: hesaplialtin.com.';

  } catch (e) {
    console.error('Piyasa hatası:', e);

    $('#summary').innerHTML =
      '<div class="skeleton error">' +
      'Piyasa verileri şu anda alınamıyor.' +
      '</div>';

    $('#goldrows').innerHTML =
      $('#fxrows').innerHTML =
      '<tr><td colspan="3">' +
      'Veri bağlantısı kurulamadı' +
      '</td></tr>';

    $('#updated').textContent =
      'Veri alınamadı';

    $('#ticker').textContent =
      'Piyasa bağlantısı kullanılamıyor';
  }
}

/* HABERLER */

function haberTarihi(value) {
  if (!value) return 'Güncel haber';

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return 'Güncel haber';
  }

  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function guvenliAdres(value) {
  try {
    const url = new URL(value);

    return url.protocol === 'https:'
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function haberKarti(item, topic) {
  const title = safe(item.title || 'Finans haberi');
  const source = safe(item.source || 'Haber kaynağı');
  const category = safe(topic.toLocaleUpperCase('tr-TR'));
  const date = safe(haberTarihi(item.date));

  const link = guvenliAdres(item.link);
  if (!link) return '';

  const image = HABER_GORSELLERINE_IZIN_VAR
    ? guvenliAdres(item.image)
    : null;

  const imageHTML = image
    ? `
      <img
        src="${safe(image)}"
        alt="${title}"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        onerror="this.remove()"
      >
    `
    : '';

  return `
    <a
      class="news"
      href="${safe(link)}"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="${title} - Kaynağa git"
    >
      <div class="newsimage">
        ${imageHTML}
      </div>

      <div class="newsbody">
        <div class="newsmeta">
          <span class="newstag">
            ${category}
          </span>

          <span class="newssource">
            ${source}
          </span>
        </div>

        <h3>${title}</h3>

        <div class="newsfooter">
          <span class="newsdate">
            ${date}
          </span>

          <span class="newsread">
            Haberi oku ↗
          </span>
        </div>
      </div>
    </a>
  `;
}

let newsRequestId = 0;

async function news(topic = 'ekonomi') {
  const root = $('#news');
  const requestId = ++newsRequestId;

  root.innerHTML =
    '<div class="skeleton">' +
    'Haberler yükleniyor…' +
    '</div>';

  try {
    const r = await fetch(
      '/api/news?topic=' + encodeURIComponent(topic),
      { cache: 'no-store' }
    );

    if (!r.ok) {
      throw Error('Haber kaynağı erişilemiyor');
    }

    const data = await r.json();

    if (!data.items?.length) {
      throw Error('Haber bulunamadı');
    }

    // Kullanıcı kategori değiştirdiyse
    // önceki isteğin sonucunu gösterme.
    if (requestId !== newsRequestId) {
      return;
    }

    const cards = data.items
      .map(item => haberKarti(item, topic))
      .filter(Boolean);

    if (!cards.length) {
      throw Error('Gösterilecek haber bulunamadı');
    }

    root.innerHTML = cards.join('');

  } catch (e) {
    if (requestId !== newsRequestId) {
      return;
    }

    console.error('Haber hatası:', e);

    root.innerHTML =
      '<div class="skeleton error">' +
      'Haberler şu anda yüklenemedi. ' +
      'Lütfen daha sonra tekrar deneyin.' +
      '</div>';
  }
}

/* KATEGORİ BUTONLARI */

document.querySelectorAll('[data-topic]').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('[data-topic]')
      .forEach(x => x.classList.remove('active'));

    b.classList.add('active');

    news(b.dataset.topic);
  });
});

/* YENİLE */

$('#refresh').addEventListener('click', () => {
  markets();

  news(
    document.querySelector('[data-topic].active')
      ?.dataset.topic || 'ekonomi'
  );
});

/* BAŞLAT */

markets();
news();

setInterval(markets, 5 * 60 * 1000);
