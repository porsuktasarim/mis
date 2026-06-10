const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const BBHBYukle = require('./bbhbYukle.model');
const { siniflandir, yasHesapla, hesaplamaGunuStr } = require('./bbhb.siniflandirici');

// XLS/XLSX → JSON satırları (xlsx paketi ile, LibreOffice gerekmez)
const xlsToRows = (filePath) => {
  const wb = XLSX.readFile(filePath, { type: 'file', raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  return rows;
};

// CSV → JSON satırları
const csvToRows = (filePath) => {
  const icerik = fs.readFileSync(filePath, 'utf8');
  return icerik.split('\n').map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
};

// Satırı parse et
const parseSatir = (satir, kolonlar, dosyaAdi) => {
  const get = (isimler) => {
    for (const isim of isimler) {
      const idx = kolonlar.findIndex(k => k && k.toString().trim().toLowerCase().includes(isim.toLowerCase()));
      if (idx >= 0 && satir[idx] !== undefined) return (satir[idx] || '').toString().trim();
    }
    return '';
  };

  const kupe_no      = get(['küpe numarası', 'kupe']);
  const tur          = get(['tür', 'tur']);
  const irk          = get(['ırk', 'irk']);
  const cinsiyet     = get(['cinsiyet']);
  const dogum_tarihi = get(['doğum tarihi', 'dogum']);
  const durum        = get(['durumu', 'durum']);
  const sahip        = get(['işletme sahibi', 'sahibi']);
  const isletme      = get(['bulunduğu işletme', 'isletme']);
  const suru_no      = get(['sürü no', 'suru']);

  if (!kupe_no || !tur) return null;
  if (durum && durum.toUpperCase() !== 'CANLI') return null;

  const yas_ay = yasHesapla(dogum_tarihi);
  const { kategori, bbhb } = siniflandir({ tur, irk, cinsiyet, yas_ay });

  return {
    kupe_no, tur, irk, cinsiyet, dogum_tarihi,
    yas_ay: yas_ay !== null ? yas_ay : -1,
    kategori, bbhb,
    sahip, isletme, suru_no,
    kaynak_dosya: dosyaAdi,
  };
};

const dosyalariisle = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'En az bir dosya yükleyin.' });
    }

    const baslik = req.body.baslik || `BBHB Yükleme - ${new Date().toLocaleDateString('tr-TR')}`;
    const hesaplamaTarihiStr = hesaplamaGunuStr();
    const tumHayvanlar = [];
    const dosyaAdlari = [];

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();
      let rows;

      try {
        if (ext === '.xls' || ext === '.xlsx') {
          rows = xlsToRows(file.path);
        } else if (ext === '.csv') {
          rows = csvToRows(file.path);
        } else {
          continue;
        }
      } catch (e) {
        console.error(`Dosya okunamadı: ${file.originalname}`, e.message);
        continue;
      }

      // Başlık satırını bul
      let headerIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        if (row.some(c => c && c.toString().toLowerCase().includes('küpe'))) {
          headerIdx = i; break;
        }
      }
      if (headerIdx === -1) { console.warn(`Başlık bulunamadı: ${file.originalname}`); continue; }

      const kolonlar = rows[headerIdx];
      dosyaAdlari.push(file.originalname);

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const h = parseSatir(rows[i], kolonlar, file.originalname);
        if (h) tumHayvanlar.push(h);
      }

      try { fs.unlinkSync(file.path); } catch {}
    }

    if (tumHayvanlar.length === 0) {
      return res.status(400).json({ success: false, message: 'Dosyalardan geçerli veri okunamadı.' });
    }

    const kategoriler = {};
    let toplamBbhb = 0;
    tumHayvanlar.forEach(h => {
      toplamBbhb += h.bbhb;
      if (!kategoriler[h.kategori]) kategoriler[h.kategori] = { adet: 0, bbhb: 0 };
      kategoriler[h.kategori].adet++;
      kategoriler[h.kategori].bbhb = parseFloat((kategoriler[h.kategori].bbhb + h.bbhb).toFixed(4));
    });

    const BBHBHesaplama = require('../bbhb/bbhb.model');
    const { HAYVAN_TURLERI } = require('../bbhb/bbhb.controller');

    // Özet kategorilerden manuel hesaplama formatına çevir
    const katMap = {
      'Kültür ırkı süt ineği':'kult_sut','Kültür melezi':'kult_mez','Yerli inek':'yerli_inek',
      'Dana-düve (kültür ırkı)':'dana_kult','Dana-düve (kültür melezi)':'dana_mez','Dana-düve (yerli)':'dana_yerli',
      'Boğa':'boga','Öküz':'okuz','Manda (erkek)':'manda_e','Manda (dişi)':'manda_d',
      'Koyun':'koyun','Keçi':'keci','Kuzu-Oğlak':'kuzu','At':'at','Katır':'katir','Eşek':'esek'
    };
    const hesaplamaHayvanlari = Object.entries(kategoriler).map(([kategoriAdi, v]) => {
      const tur_id = katMap[kategoriAdi];
      const tur = HAYVAN_TURLERI.find(t => t.tur_id === tur_id);
      if (!tur || !v.adet) return null;
      return { tur_id: tur.tur_id, tur_adi: tur.tur_adi, katsayi: tur.katsayi, adet: v.adet, bbhb: v.bbhb };
    }).filter(Boolean);

    await BBHBHesaplama.create({
      baslik,
      aciklama: `Dosya yüklemesinden otomatik oluşturuldu: ${dosyaAdlari.join(', ')}`,
      hayvanlar: hesaplamaHayvanlari,
      toplam_adet: tumHayvanlar.length,
      toplam_bbhb: parseFloat(toplamBbhb.toFixed(4)),
      tur_sayisi: Object.keys(kategoriler).length,
      durum: 'tamamlandi',
    });
      baslik,
      hesaplama_tarihi: hesaplamaTarihiStr,
      dosyalar: dosyaAdlari,
      hayvanlar: tumHayvanlar,
      ozet: {
        toplam_hayvan: tumHayvanlar.length,
        toplam_bbhb: parseFloat(toplamBbhb.toFixed(4)),
        kategoriler,
      },
      durum: 'tamamlandi',
    });

    res.status(201).json({
      success: true,
      data: {
        _id: kayit._id,
        baslik: kayit.baslik,
        hesaplama_tarihi: kayit.hesaplama_tarihi,
        dosyalar: kayit.dosyalar,
        ozet: kayit.ozet,
        createdAt: kayit.createdAt,
      },
    });
  } catch (err) { next(err); }
};

const listele = async (req, res, next) => {
  try {
    const kayitlar = await BBHBYukle.find()
      .sort({ createdAt: -1 })
      .select('-hayvanlar');
    res.json({ success: true, count: kayitlar.length, data: kayitlar });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const kayit = await BBHBYukle.findById(req.params.id);
    if (!kayit) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
    res.json({ success: true, data: kayit });
  } catch (err) { next(err); }
};

const sil = async (req, res, next) => {
  try {
    const kayit = await BBHBYukle.findByIdAndDelete(req.params.id);
    if (!kayit) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
    res.json({ success: true, message: 'Kayıt silindi' });
  } catch (err) { next(err); }
};

module.exports = { dosyalariisle, listele, getById, sil };
