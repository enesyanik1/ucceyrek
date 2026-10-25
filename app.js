
const $ = s => document.querySelector(s);
const money = (n, d = 2) => Number(n).toLocaleString('tr-TR', {
  minimumFractionDigits: d,
  maximumFractionDigits: d
});
const safe = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const today = new Date();
$('#date').textContent = today.toLocaleDateString('tr-TR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});
$('#year').textContent = today.getFullYear();

const goldCodes = [
  'GRAM_ALTIN_TRY', 'CEYREK_YENI_TRY', 'YARIM_YENI_TRY',
  'TAM_YENI_TRY', 'ATA_YENI_TRY', 'HAS_ALTIN_TRY', 'ONS_ALTIN_USD'
];
const fxCodes = ['USD_TRY', 'EUR_TRY', 'GBP_TRY'];

function price(v, item) {
  if (v == null || !Number.isFinite(Number(v))) return 'Veri yok';
  const decimals = item.birim === 'TRY' && Number(v) < 100 ? 4 : 2;
  return (item.birim === 'USD' ? '$ ' : '₺ ') + money(v, decimals);
}

function stale(item) {
  const t = new Date(item.guncelleme).getTime();
  return !Number.isFinite(t) || Date.now() - t > 3600000;
}

function change(item) {
  if (item.degisim24s == null) return 'Değişim yok';
  const n = Number(item.degisim24s);
  return '24s: ' + (n > 0 ? '+' : '') + money(n) + '%';
}

function card(item) {
  return `<div class="pricecard">
    <div class="label">${safe(item.etiket)}</div>
    <div class="price">${price(item.satis, item)}</div>
    <div class="sub">Alış: ${price(item.alis, item)}</div>
    <div class="sub">Satış: ${price(item.satis, item)}</div>
    <div class="sub">${safe(change(item))}</div>
    <div class="sub">${stale(item) ? '⚠ Eski veri' : 'Güncel veri'}</div>
  </div>`;
}

function row(item) {
  return `<tr>
    <td>${safe(item.etiket)}${stale(item) ? ' ⚠' : ''}</td>
    <td>${price(item.alis, item)}</td>
    <td>${price(item.satis, item)}</td>
  </tr>`;
}

async function markets() {
  try {
    const r = await fetch('/api/markets', { cache: 'no-store' });
    if (!r.ok) throw Error('Fiyat API hatası');

    const data = await r.json();
    if (!data.success || !data.kalemler) throw Error('Fiyat bulunamadı');

    const k = data.kalemler;
    const gold = goldCodes.map(c => k[c]).filter(Boolean);
    const fx = fxCodes.map(c => k[c]).filter(Boolean);
    const summary = [
      'GRAM_ALTIN_TRY', 'CEYREK_YENI_TRY', 'YARIM_YENI_TRY',
      'TAM_YENI_TRY', 'USD_TRY', 'EUR_TRY'
    ].map(c => k[c]).filter(Boolean);

    $('#summary').innerHTML = summary.map(card).join('');
    $('#ticker').innerHTML = summary.map(i =>
      `<span>${safe(i.etiket)} <b>${price(i.satis, i)}</b></span>`
    ).join('');
    $('#goldrows').innerHTML = gold.map(row).join('');
    $('#fxrows').innerHTML = fx.map(row).join('');

    $('#updated').textContent = 'Son kontrol: ' +
      new Date(data.fetchedAt).toLocaleTimeString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        hour: '2-digit', minute: '2-digit'
      });

    $('#market-note').textContent =
      'Alış-satış fiyatları Hesaplı Altın veri sağlayıcısından alınır. ' +
      '⚠ işareti bir saatten eski fiyatları belirtir. ' +
      'Fiyatlar işlem yapılan kuruma göre değişebilir. Kaynak: hesaplialtin.com.';
  } catch (e) {
    console.error('Piyasa hatası:', e);
    $('#summary').innerHTML =
      '<div class="skeleton error">Piyasa verileri şu anda alınamıyor.</div>';
    $('#goldrows').innerHTML = $('#fxrows').innerHTML =
      '<tr><td colspan="3">Veri bağlantısı kurulamadı</td></tr>';
    $('#updated').textContent = 'Veri alınamadı';
    $('#ticker').textContent = 'Piyasa bağlantısı kullanılamıyor';
  }
}

async function news(topic = 'ekonomi') {
  const root = $('#news');
  root.innerHTML = '<div class="skeleton">Haberler yükleniyor…</div>';
  try {
    const r = await fetch('/api/news?topic=' + encodeURIComponent(topic), {
      cache: 'no-store'
    });
    if (!r.ok) throw Error('Haber kaynağı erişilemiyor');
    const d = await r.json();
    if (!d.items?.length) throw Error('Haber bulunamadı');
    root.innerHTML = d.items.map(x =>
      `<a class="news" href="${safe(x.link)}" target="_blank" rel="noopener noreferrer">
        <span class="newstag">${safe(x.source || 'FİNANS HABERİ')} · ${safe(topic.toUpperCase())}</span>
        <h3>${safe(x.title)}</h3>
        <p>${x.date ? new Date(x.date).toLocaleDateString('tr-TR') : 'Güncel haber'} · Kaynağa git ↗</p>
      </a>`
    ).join('');
  } catch (e) {
    root.innerHTML =
      '<div class="skeleton error">Haberler şu anda yüklenemedi. Lütfen daha sonra tekrar deneyin.</div>';
  }
}

document.querySelectorAll('[data-topic]').forEach(b =>
  b.addEventListener('click', () => {
    document.querySelectorAll('[data-topic]').forEach(x =>
      x.classList.remove('active')
    );
    b.classList.add('active');
    news(b.dataset.topic);
  })
);

$('#refresh').addEventListener('click', () => {
  markets();
  news(document.querySelector('[data-topic].active')?.dataset.topic || 'ekonomi');
});

markets();
news();
setInterval(markets, 5 * 60 * 1000);
