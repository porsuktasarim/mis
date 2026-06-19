/**
 * MİS – Mera İzleme Sistemi
 * Merkezi Dil Yöneticisi (lang.js)
 *
 * Kullanım:
 *   await MisLang.yukle();          // Sayfa yüklenince bir kere çağrılır
 *   L('mera.yeni_mera')             // "Yeni Mera"
 *   L('mera.kaynak_5a_aciklama')    // Uzun açıklama metni
 *   L('genel.kaydet')               // "Kaydet"
 *   L('mera.nitelikler.mera')       // "Mera"
 *
 * İçinde değişken olan metinler:
 *   L('sayfalama.sayfa_bilgi', { toplam:100, baslangic:1, bitis:20 })
 *   // "{toplam} kayıttan {baslangic}-{bitis} arası" → "100 kayıttan 1-20 arası"
 */

const MisLang = (() => {
  let _sozluk = {};
  let _yuklendi = false;

  /** JSON dil dosyasını yükle */
  const yukle = async (dosya = '/js/lang.tr.json') => {
    if (_yuklendi) return;
    try {
      const r = await fetch(dosya);
      _sozluk = await r.json();
      _yuklendi = true;
    } catch (e) {
      console.warn('[MisLang] Dil dosyası yüklenemedi:', e);
      _sozluk = {};
    }
  };

  /**
   * Anahtar çözümleme — noktalı yol desteği
   * Örnek: coz('mera.nitelikler.mera') → _sozluk.mera.nitelikler.mera
   */
  const coz = (anahtar) => {
    return anahtar.split('.').reduce((obj, parca) => {
      return obj && obj[parca] !== undefined ? obj[parca] : undefined;
    }, _sozluk);
  };

  /**
   * Ana çeviri fonksiyonu
   * @param {string} anahtar  - noktalı yol: 'mera.yeni_mera'
   * @param {Object} degiskenler - isteğe bağlı değişken haritası
   * @returns {string}
   */
  const t = (anahtar, degiskenler = {}) => {
    const deger = coz(anahtar);
    if (deger === undefined) {
      console.warn(`[MisLang] Anahtar bulunamadı: "${anahtar}"`);
      return anahtar; // Bulunamazsa anahtarı döndür
    }
    if (typeof deger !== 'string') return deger; // Obje veya array ise direkt dön
    // Değişken yer tutucuları değiştir: {anahtar} → değer
    return deger.replace(/\{(\w+)\}/g, (_, k) =>
      degiskenler[k] !== undefined ? degiskenler[k] : `{${k}}`
    );
  };

  /** Belirtilen anahtarın altındaki tüm değerleri düz obje olarak döndür */
  const grup = (anahtar) => {
    const val = coz(anahtar);
    return (val && typeof val === 'object') ? val : {};
  };

  /** Anahtar var mı kontrol et */
  const varMi = (anahtar) => coz(anahtar) !== undefined;

  return { yukle, t, grup, varMi };
})();

/**
 * Global kısayol — tüm sayfalarda doğrudan L('...') olarak kullanılır
 */
window.L = MisLang.t.bind(MisLang);
window.MisLang = MisLang;

/**
 * Sayfa yüklendiğinde otomatik yükle
 * data-l="anahtar" attribute'u olan elementleri otomatik çevir
 *
 * Örnek HTML: <span data-l="genel.kaydet"></span>
 *             <button data-l-title="genel.iptal" title="..."></button>
 *             <input data-l-placeholder="mera.il" placeholder="...">
 */
document.addEventListener('DOMContentLoaded', async () => {
  await MisLang.yukle();

  // data-l attribute — element içeriği
  document.querySelectorAll('[data-l]').forEach(el => {
    const anahtar = el.getAttribute('data-l');
    const metin = MisLang.t(anahtar);
    if (typeof metin === 'string') el.textContent = metin;
  });

  // data-l-placeholder — input placeholder
  document.querySelectorAll('[data-l-placeholder]').forEach(el => {
    const anahtar = el.getAttribute('data-l-placeholder');
    const metin = MisLang.t(anahtar);
    if (typeof metin === 'string') el.placeholder = metin;
  });

  // data-l-title — tooltip title
  document.querySelectorAll('[data-l-title]').forEach(el => {
    const anahtar = el.getAttribute('data-l-title');
    const metin = MisLang.t(anahtar);
    if (typeof metin === 'string') el.title = metin;
  });
});
