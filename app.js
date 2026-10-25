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

/* TARİH */

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

/* PİYASA KODLARI */

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

/* HABER GÖRSELLERİ */

const kategoriGorselleri = {
  ekonomi: '/ekonomi.webp',
  'altın': '/altin.webp',
  'döviz': '/doviz.webp',
  borsa: '/borsa.webp'
};

/* FİYAT FORMATLAMA */

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

/* VERİ GÜNCELLİĞİ */

function stale(item) {
  const t = new Date(item.guncelleme).getTime();

  return (
    !Number.isFinite(t) ||
    Date.now() - t > 3600000
  );
}

/* FİYAT DEĞİŞİMİ */

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

/* PİYASA KARTLARI */

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
        ${
          stale(item)
            ? '⚠ Eski veri'
            : 'Güncel veri'
        }
      </div>
    </div>
  `;
}

/* PİYASA TABLOLARI */

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

/* =====================================
   ALTIN VE DÖVİZ AL-SAT HESAPLAYICI
===================================== */

let marketKalemler = {};
let calcMode = 'buy';

const calcAsset = $('#calc-asset');
const calcQuantity = $('#calc-quantity');
const calcBuy = $('#calc-buy');
const calcSell = $('#calc-sell');

const calcTotal = $('#calc-total');
const calcResultLabel = $('#calc-result-label');
const calcUnitPrice = $('#calc-unit-price');
const calcAmount = $('#calc-amount');

/* HESAPLAMA */

function updateCalculator() {
  if (!calcAsset || !calcQuantity || !calcTotal) {
    return;
  }

  const item = marketKalemler[calcAsset.value];

  const rawQuantity = calcQuantity.value.trim();

  const quantity = Number(
    rawQuantity.replace(',', '.')
  );

  const unit =
    calcAsset.value === 'GRAM_ALTIN_TRY' ||
    calcAsset.value === 'HAS_ALTIN_TRY'
      ? 'gram'
      : fxCodes.includes(calcAsset.value)
        ? 'birim'
        : 'adet';

  const isBuy = calcMode === 'buy';

  calcBuy?.classList.toggle('active', isBuy);
  calcSell?.classList.toggle('active', !isBuy);

  calcBuy?.setAttribute(
    'aria-pressed',
    String(isBuy)
  );

  calcSell?.setAttribute(
    'aria-pressed',
    String(!isBuy)
  );

  calcResultLabel.textContent = isBuy
    ? 'Tahmini ödenecek tutar'
    : 'Tahmini alınacak tutar';

  /* VERİ KONTROLÜ */

  if (!item) {
    calcTotal.textContent =
      'Fiyat verisi bekleniyor…';

    calcUnitPrice.textContent =
      'Birim fiyat: —';

    calcAmount.textContent =
      'Miktar: —';

    return;
  }

  /* MİKTAR KONTROLÜ */

  const unitPrice = Number(
    isBuy ? item.satis : item.alis
  );

  if (
    !rawQuantity ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    calcTotal.textContent =
      'Geçerli bir miktar girin';

    calcUnitPrice.textContent =
      'Birim fiyat: ' + price(unitPrice, item);

    calcAmount.textContent =
      'Miktar: —';

    return;
  }

  /* FİYAT KONTROLÜ */

  if (
    !Number.isFinite(unitPrice) ||
    unitPrice <= 0
  ) {
    calcTotal.textContent =
      'Fiyat mevcut değil';

    calcUnitPrice.textContent =
      'Birim fiyat: —';

    calcAmount.textContent =
      'Miktar: ' + money(quantity, 4) + ' ' + unit;

    return;
  }

  /* TOPLAM TUTAR */

  const total = quantity * unitPrice;

  calcTotal.textContent =
    '₺ ' + money(total, 2);

  calcUnitPrice.textContent =
    (
      isBuy
        ? 'Piyasa satış fiyatı: '
        : 'Piyasa alış fiyatı: '
    ) +
    price(unitPrice, item);

  calcAmount.textContent =
    'Miktar: ' +
    quantity.toLocaleString('tr-TR', {
      maximumFractionDigits: 4
    }) +
    ' ' +
    unit +
    (
      stale(item)
        ? ' · ⚠ Eski fiyat'
        : ''
    );
}

/* HESAPLAYICI OLAYLARI */

calcAsset?.addEventListener(
  'change',
  updateCalculator
);

calcQuantity?.addEventListener(
  'input',
  updateCalculator
);

calcBuy?.addEventListener(
  'click',
  () => {
    calcMode = 'buy';
    updateCalculator();
  }
);

calcSell?.addEventListener(
  'click',
  () => {
    calcMode = 'sell';
    updateCalculator();
  }
);

/* =====================================
   ALTIN VE DÖVİZ ÇEVİRİCİ
===================================== */

let converterDirection = 'toAsset';
const converterAsset = $('#converter-asset');
const converterAmount = $('#converter-amount');
const converterTotal = $('#converter-total');
const converterRate = $('#converter-rate');
const converterLabel = $('#converter-input-label');
const converterToAsset = $('#converter-to-asset');
const converterToTry = $('#converter-to-try');

const converterUnits = {
  GRAM_ALTIN_TRY: 'gram',
  CEYREK_YENI_TRY: 'adet',
  YARIM_YENI_TRY: 'adet',
  TAM_YENI_TRY: 'adet',
  ATA_YENI_TRY: 'adet',
  HAS_ALTIN_TRY: 'gram',
  USD_TRY: 'USD',
  EUR_TRY: 'EUR',
  GBP_TRY: 'GBP'
};

function updateConverter() {
  if (!converterAsset || !converterAmount || !converterTotal) return;
  const item = marketKalemler[converterAsset.value];
  const unit = converterUnits[converterAsset.value] || 'birim';
  const toAsset = converterDirection === 'toAsset';
  const raw = converterAmount.value.trim();
  const quantity = Number(raw.replace(',', '.'));

  converterToAsset.classList.toggle('active', toAsset);
  converterToTry.classList.toggle('active', !toAsset);
  converterToAsset.setAttribute('aria-pressed', String(toAsset));
  converterToTry.setAttribute('aria-pressed', String(!toAsset));
  converterLabel.textContent = toAsset
    ? 'Türk lirası miktarı (₺)'
    : 'Altın / döviz miktarı (' + unit + ')';

  if (!item) {
    converterTotal.textContent = 'Fiyat verisi bekleniyor…';
    converterRate.textContent = 'Seçilen varlığın fiyatı henüz alınamadı';
    return;
  }
  if (!raw || !Number.isFinite(quantity) || quantity <= 0) {
    converterTotal.textContent = 'Geçerli bir miktar girin';
    converterRate.textContent = 'Miktar sıfırdan büyük olmalıdır';
    return;
  }

  const rawPrice = toAsset ? item.satis : item.alis;
  const unitPrice = rawPrice == null || rawPrice === '' ? NaN : Number(rawPrice);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    converterTotal.textContent = 'Fiyat mevcut değil';
    converterRate.textContent = 'Bu varlık için geçerli fiyat bulunamadı';
    return;
  }
  const result = toAsset ? quantity / unitPrice : quantity * unitPrice;
  if (!Number.isFinite(result)) {
    converterTotal.textContent = 'Hesaplama yapılamadı';
    converterRate.textContent = 'Miktarı kontrol edin';
    return;
  }
  converterTotal.textContent = toAsset
    ? result.toLocaleString('tr-TR', { maximumFractionDigits: 6 }) + ' ' + unit
    : '₺ ' + money(result, 2);
  converterRate.textContent = '1 ' + unit + ' = ₺ ' + money(unitPrice, 2) +
    (toAsset ? ' (piyasa satış fiyatı)' : ' (piyasa alış fiyatı)') +
    (stale(item) ? ' · ⚠ Eski fiyat' : '');
}

converterAsset?.addEventListener('change', updateConverter);
converterAmount?.addEventListener('input', updateConverter);
converterToAsset?.addEventListener('click', () => {
  converterDirection = 'toAsset';
  updateConverter();
});
converterToTry?.addEventListener('click', () => {
  converterDirection = 'toTry';
  updateConverter();
});

/* =====================================
   ALTIN VE DÖVİZ VERİLERİ
===================================== */

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

    /* FİYATLARI HESAPLAYICIYA AKTAR */

    marketKalemler = k;

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

    /* HESAPLAYICIYI GÜNCELLE */

    updateCalculator();
    updateConverter();

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

    marketKalemler = {};

    updateCalculator();
    updateConverter();
  }
}

/* =====================================
   HABER TARİHİ
===================================== */

function haberTarihi(value) {
  if (!value) {
    return 'Güncel haber';
  }

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

/* GÜVENLİ HABER BAĞLANTISI */

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

/* =====================================
   HABER KARTLARI
===================================== */

function haberKarti(item, topic) {
  const title = safe(
    item.title || 'Finans haberi'
  );

  const source = safe(
    item.source || 'Haber kaynağı'
  );

  const category = safe(
    topic.toLocaleUpperCase('tr-TR')
  );

  const date = safe(
    haberTarihi(item.date)
  );

  const link = guvenliAdres(item.link);

  if (!link) {
    return '';
  }

  const image =
    kategoriGorselleri[topic] ||
    kategoriGorselleri.ekonomi;

  return `
    <a
      class="news"
      href="${safe(link)}"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="${title} - Kaynağa git"
    >
      <div class="newsimage">
        <img
          src="${safe(image)}"
          alt="${category} haber görseli"
          loading="lazy"
          decoding="async"
          onerror="this.remove()"
        >
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

/* =====================================
   HABERLERİ GETİR
===================================== */

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
      '/api/news?topic=' +
      encodeURIComponent(topic),
      {
        cache: 'no-store'
      }
    );

    if (!r.ok) {
      throw Error('Haber kaynağı erişilemiyor');
    }

    const data = await r.json();

    if (!data.items?.length) {
      throw Error('Haber bulunamadı');
    }

    if (requestId !== newsRequestId) {
      return;
    }

    const cards = data.items
      .map(item => haberKarti(item, topic))
      .filter(Boolean);

    if (!cards.length) {
      throw Error(
        'Gösterilecek haber bulunamadı'
      );
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

/* HABER KATEGORİ BUTONLARI */

document.querySelectorAll('[data-topic]')
  .forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-topic]')
        .forEach(x =>
          x.classList.remove('active')
        );

      b.classList.add('active');

      news(b.dataset.topic);
    });
  });

/* =====================================
   YENİLE BUTONU
===================================== */

$('#refresh').addEventListener(
  'click',
  () => {
    markets();

    news(
      document.querySelector(
        '[data-topic].active'
      )?.dataset.topic || 'ekonomi'
    );
  }
);

/* SİTEYİ BAŞLAT */

updateCalculator();
updateConverter();

markets();

news();

/* 5 DAKİKADA BİR FİYATLARI YENİLE */

setInterval(
  markets,
  5 * 60 * 1000
);
