// Hesaplama tarihi: her ayın 1. günü
const hesaplamaTarihi = () => {
  const bugun = new Date();
  return new Date(bugun.getFullYear(), bugun.getMonth(), 1);
};

const hesaplamaGunuStr = () => {
  const t = hesaplamaTarihi();
  return `01.${String(t.getMonth() + 1).padStart(2, '0')}.${t.getFullYear()}`;
};

// Doğum tarihinden ay cinsinden yaş hesapla (hesaplama tarihine göre)
const yasHesapla = (dogumTarihiStr) => {
  if (!dogumTarihiStr) return null;
  const parts = dogumTarihiStr.split('.');
  if (parts.length !== 3) return null;
  const dogum = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  if (isNaN(dogum)) return null;
  const ref = hesaplamaTarihi();
  const yilFark = ref.getFullYear() - dogum.getFullYear();
  const ayFark = ref.getMonth() - dogum.getMonth();
  return yilFark * 12 + ayFark;
};

// Irk "M" ile bitiyor mu? → kültür melezi
const irkTipi = (irk) => {
  if (!irk) return 'kultür';
  const irkTemiz = irk.trim();
  if (irkTemiz.endsWith(' M')) return 'melez';
  const yerliler = ['Akkaraman', 'Kıvırcık', 'Morkaraman', 'İvesi', 'Norduz', 'Hemşin', 'Kangal'];
  for (const y of yerliler) {
    if (irkTemiz.toLowerCase().includes(y.toLowerCase())) return 'yerli';
  }
  return 'kultür';
};

// Ana sınıflandırma fonksiyonu
const siniflandir = (hayvan) => {
  const tur   = (hayvan.tur || '').trim();
  const irk   = (hayvan.irk || '').trim();
  const cinsiyet = (hayvan.cinsiyet || '').trim();
  const yasAy = hayvan.yas_ay;

  // --- MANDA ---
  if (tur === 'Manda') {
    if (cinsiyet === 'Erkek') return { kategori: 'Manda (erkek)', bbhb: 0.90 };
    return { kategori: 'Manda (dişi)', bbhb: 0.75 };
  }

  // --- KOYUN / KEÇİ ---
  if (tur === 'Koyun') {
    if (yasAy !== null && yasAy <= 12) return { kategori: 'Kuzu-Oğlak', bbhb: 0.04 };
    return { kategori: 'Koyun', bbhb: 0.10 };
  }
  if (tur === 'Keçi') {
    if (yasAy !== null && yasAy <= 12) return { kategori: 'Kuzu-Oğlak', bbhb: 0.04 };
    return { kategori: 'Keçi', bbhb: 0.08 };
  }

  // --- AT / KATIR / EŞEK ---
  if (tur === 'At')    return { kategori: 'At', bbhb: 0.50 };
  if (tur === 'Katır') return { kategori: 'Katır', bbhb: 0.40 };
  if (tur === 'Eşek')  return { kategori: 'Eşek', bbhb: 0.30 };

  // --- SIĞIR ---
  if (tur === 'Sığır') {
    const tip = irkTipi(irk);

    if (cinsiyet === 'Erkek') {
      // Öküz: 97 ay ve üzeri erkek (8 yıl = 96 ay, 97+)
      if (yasAy !== null && yasAy >= 97) return { kategori: 'Öküz', bbhb: 0.60 };
      // Boğa: 13 ay ve üzeri
      if (yasAy !== null && yasAy >= 13) return { kategori: 'Boğa', bbhb: 1.50 };
      // Dana: 0-12 ay (dahil)
      if (tip === 'melez')  return { kategori: 'Dana-düve (kültür melezi)', bbhb: 0.45 };
      if (tip === 'yerli')  return { kategori: 'Dana-düve (yerli)', bbhb: 0.30 };
      return { kategori: 'Dana-düve (kültür ırkı)', bbhb: 0.60 };
    }

    if (cinsiyet === 'Dişi') {
      // Dana-düve: 0-21 ay
      if (yasAy !== null && yasAy <= 21) {
        if (tip === 'melez') return { kategori: 'Dana-düve (kültür melezi)', bbhb: 0.45 };
        if (tip === 'yerli') return { kategori: 'Dana-düve (yerli)', bbhb: 0.30 };
        return { kategori: 'Dana-düve (kültür ırkı)', bbhb: 0.60 };
      }
      // İnek: 22 ay+
      if (tip === 'melez') return { kategori: 'Kültür melezi', bbhb: 0.75 };
      if (tip === 'yerli') return { kategori: 'Yerli inek', bbhb: 0.50 };
      return { kategori: 'Kültür ırkı süt ineği', bbhb: 1.00 };
    }
  }

  return { kategori: 'Bilinmiyor', bbhb: 0 };
};

module.exports = { siniflandir, yasHesapla, hesaplamaGunuStr, irkTipi };
