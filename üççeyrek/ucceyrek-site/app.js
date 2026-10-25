
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

const today = new Date();

$('#date').textContent = today.toLocaleDateString('tr-TR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

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

function unitOf(item) {
  return item?.birim === 'USD' ? '$' : '₺';
}

function formatPrice(value, item) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return 'Veri yok';
  }

  const digits = item?.birim === 'TRY' &&
    Number(value) < 100 ? 4 : 2;

  return unitOf(item) + ' ' + money(value, digits);
}

function changeText(item) {
  const value = Number(item?.degisim24s);

  if (item?.degisim24s == null || !Number.isFinite(value)) {
    return 'Değişim verisi yok';
  }

  const sign = value > 0 ? '+' : '';
  return '24s: ' + sign + money(value, 2) + '%';
}

function updateTime(item) {
  if (!item?.guncelleme) return 'Bilinmiyor';

  const date = new Date(item.guncelleme);

  if (Number.isNaN(date.getTime())) return 'Bilinmiyor';

  return date.toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function isStale(item) {
  if (!item?.guncelleme) return true;

  const timestamp = new Date(item.guncelleme).getTime();

  return !Number.isFinite(timestamp) ||
    Date.now() - timestamp > 60 * 60 * 1000;
}

function priceCard(item) {
  const stale = isStale(item);

  return `
    <div class="pricecard">
      <div class="label">${safe(item.etiket)}</div>

      <div class="price">
        ${formatPrice(item.satis, item)}
      </div>

      <div class="sub">
        Alış: ${formatPrice(item.alis, item)}
      </div>

      <div class="sub">
        Satış: ${formatPrice(item.satis, item)}
      </div>

      <div class="sub">
        ${safe(changeText(item))}
      </div>

      <div class="sub">
        ${stale ? '⚠ Eski veri · ' : 'Güncelleme: '}
        ${safe(updateTime(item))}
      </div>
    </div>
  `;
}

function priceRow(item) {
  const stale = isStale(item);

  return `
    <tr>
      <td>
        ${safe(item.etiket)}
        ${stale ? ' ⚠' : ''}
      </td>
      <td>${formatPrice(item.alis, item)}</td>
      <td>${formatPrice(item.satis, item)}</td>
    </tr>
  `;
}

async function markets() {
  try {
    const r = await fetch('/api/markets', {
      cache: 'no-store'
    });

    if (!r.ok) {
      throw Error('Fiyat servisi yanıt vermedi');
    }

    const data = await r.json();

    if (!data.success || !data.kalemler) {
      throw Error('Fiyat verisi bulunamadı');
    }

    const k = data.kalemler;

    const gold = goldCodes
      .map(code => k[code])
      .filter(Boolean);

    const fx = fxCodes
      .map(code => k[code])
      .filter(Boolean);

    if (!gold.length || !fx.length) {
      throw Error('Altın veya döviz fiyatları eksik');
    }

    const summaryCodes = [
      'GRAM_ALTIN_TRY',
      'CEYREK_YENI_TRY',
      'YARIM_YENI_TRY',
      'TAM_YENI_TRY',
      'USD_TRY',
      'EUR_TRY'
    ];

    const summaryItems = summaryCodes
      .map(code => k[code])
      .filter(Boolean);

    $('#summary').innerHTML =
      summaryItems.map(priceCard).join('');

    $('#ticker').innerHTML =
      summaryItems.map(item => `
        <span>
          ${safe(item.etiket)}
          <b>${formatPrice(item.satis, item)}</b>
        </span>
      `).join('');

    $('#goldrows').innerHTML =
      gold.map(priceRow).join('');

    $('#fxrows').innerHTML =
      fx.map(priceRow).join('');

    const fetched = new Date(data.fetchedAt);

    $('#updated').textContent =
      'Son kontrol: ' +
      (Number.isNaN(fetched.getTime())
        ? 'Bilinmiyor'
        : fetched.toLocaleTimeString('tr-TR', {
            timeZone: 'Europe/Istanbul',
            hour: '2-digit',
            minute: '2-digit'
          }));

    $('#market-note').textContent =
      'Alış ve satış fiyatları Hesaplı Altın veri sağlayıcısından alınmaktadır. ' +
      'Günlük değişim sağlayıcının bildirdiği yüzde değerdir. ' +
      '⚠ işareti, fiyatın son güncellemesinin 1 saatten eski olduğunu belirtir. ' +
      'Fiyatlar piyasa koşullarına ve işlem yapılan kuruma göre farklılık gösterebilir. ' +
      'Kaynak: hesaplialtin.com.';

  } catch (error) {
    console.error('Piyasa verisi hatası:', error);

    $('#summary').innerHTML =
      '<div class="skeleton error">Fiyatlar şu anda alınamıyor.</div>';

    $('#goldrows').innerHTML =
      '<tr><td colspan="3">Altın fiyatları alınamadı</td></tr>';

    $('#fxrows').innerHTML =
      '<tr><td colspan="3">Döviz fiyatları alınamadı</td></tr>';

    $('#updated').textContent = 'Veri alınamadı';

    $('#ticker').textContent =
      'Piyasa bağlantısı geçici olarak kullanılamıyor';
  }
}

// Mevcut haber sistemi korunuyor.
async function news(topic = 'ekonomi') {
  const root = $('#news');

  root.innerHTML =
    '<div class="skeleton">Haberler yükleniyor…</div>';

  try {
    const r = await fetch(
      '/api/news?topic=' + encodeURIComponent(topic),
      { cache: 'no-store' }
    );

    if (!r.ok) {
      throw Error('Haber kaynağı erişilemiyor');
    }

    const d = await r.json();

    if (!d.items?.length) {
      throw Error('Haber bulunamadı');
    }

    root.innerHTML = d.items.map(x => `
      <a class="news"
         href="${safe(x.link)}"
         target="_blank"
         rel="noopener noreferrer">

        <span class="newstag">
          ${safe(x.source || 'FİNANS HABERİ')}
          · ${safe(topic.toUpperCase())}
        </span>

        <h3>${safe(x.title)}</h3>

        <p>
          ${x.date
            ? new Date(x.date).toLocaleDateString('tr-TR')
            : 'Güncel haber'}
          · Kaynağa git ↗
        </p>
      </a>
    `).join('');

  } catch (error) {
    root.innerHTML =
      '<div class="skeleton error">' +
      'Haberler şu anda yüklenemedi. ' +
      'Lütfen daha sonra tekrar deneyin.' +
      '</div>';
  }
}

document.querySelectorAll('[data-topic]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-topic]').forEach(x =>
      x.classList.remove('active')
    );

    button.classList.add('active');

    news(button.dataset.topic);
  });
});

$('#refresh').addEventListener('click', () => {
  markets();

  const active = document.querySelector('[data-topic].active');

  news(active?.dataset.topic || 'ekonomi');
});

markets();
news();

setInterval(markets, 5 * 60 * 1000);
