
export async function onRequestGet({ env }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=120"
  };

  try {
    const apiKey = env.HESAPLI_ALTIN_API_KEY;

    if (!apiKey) {
      throw new Error("API anahtarı tanımlı değil");
    }

    const response = await fetch(
      "https://hesaplialtin.com/api/v1/public-prices",
      {
        headers: {
          "X-API-Key": apiKey
        }
      }
    );

    if (!response.ok) {
      throw new Error("API HTTP " + response.status);
    }

    const data = await response.json();
    const kalemler = data.kalemler;

    if (!kalemler || !kalemler.GRAM_ALTIN_TRY) {
      throw new Error("Beklenen altın verisi bulunamadı");
    }

    return new Response(
      JSON.stringify({
        success: true,
        kalemler,
        fetchedAt: new Date().toISOString(),
        source: "Hesaplı Altın"
      }),
      { headers }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Fiyat verileri alınamadı",
        detail: error.message
      }),
      {
        status: 503,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }
}
