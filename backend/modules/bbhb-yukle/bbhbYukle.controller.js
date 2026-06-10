const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');
const csv = require('csv-parse/sync');
const BBHBYukle = require('./bbhbYukle.model');
const { siniflandir, yasHesapla, hesaplamaGunuStr } = require('./bbhb.siniflandirici');

// XLS → CSV dönüşümü (LibreOffice)
const xlsToCsv = (xlsPath) => {
  const outDir = '/tmp/mis_yukle';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  execSync(
    `python3 /usr/lib/libreoffice/program/../../../bin/python3 -c "
import subprocess
subprocess.run([
  'soffice', '--headless', '--convert-to', 'csv',
  '--outdir', '${outDir}', '${xlsPath}'
], check=True)
" 2>/dev/null || soffice --headless --convert-to csv --outdir ${outDir} "${xlsPath}"`,
    { timeout: 30000 }
  );
  const base = path.basename(xlsPath, path.extname(xlsPath));
  const csvPath = path.join(outDir, `${base}.csv`);
  if (!fs.existsSync(csvPath)) throw new Error(`CSV dönüşümü başarısız: ${base}`);
  return csvPath;
};

// CSV satırını parse et
const parseSatir = (satir, kolonlar, dosyaAdi) => {
  const get = (isimler) => {
    for (const isim of isimler) {
      const idx = kolonlar.findIndex(k => k && k.trim().toLowerCase() === isim.toLowerCase());
      if (idx >= 0 && satir[idx] !== undefined) return (satir[idx] || '').toString().trim();
    }
    return '';
  };

  const kupe_no      = get(['Küpe Numarası', 'kupe numarasi']);
  const tur          = get(['Tür', 'tur']);
  const irk          = get(['Irk', 'irk']);
  const cinsiyet     = get(['Cinsiyet', 'cinsiyet']);
  const dogum_tarihi = get(['Doğum Tarihi', 'dogum tarihi']);
  const durum        = get(['Durumu', 'durum']);
  const sahip        = get(['İşletme Sahibi Kişi/Firma', 'isletme sahibi']);
  const isletme      = get(['Bulunduğu İşletme', 'bulundugu isletme']);
  const suru_no      = get(['Sürü No', 'suru no']);

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

// Dosyaları işle
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
      let csvPath;

      if (ext === '.xls' || ext === '.xlsx') {
        csvPath = xlsToCsv(file.path);
      } else if (ext === '.csv') {
        csvPath = file.path;
      } else {
        continue;
      }

      const icerik = fs.readFileSync(csvPath, 'utf8');
      const satirlar = csv.parse(icerik, { relax_quotes: true, skip_empty_lines: true });

      // Başlık satırını bul (Küpe Numarası içeren)
      let headerIdx = -1;
      for (let i = 0; i < Math.min(satirlar.length, 5); i++) {
        if (satirlar[i].some(c => c && c.toString().includes('Küpe'))) {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx === -1) continue;

      const kolonlar = satirlar[headerIdx];
      const dosyaAdi = file.originalname;
      dosyaAdlari.push(dosyaAdi);

      for (let i = headerIdx + 1; i < satirlar.length; i++) {
        const h = parseSatir(satirlar[i], kolonlar, dosyaAdi);
        if (h) tumHayvanlar.push(h);
      }

      // Temp dosyaları temizle
      try { fs.unlinkSync(file.path); } catch {}
    }

    if (tumHayvanlar.length === 0) {
      return res.status(400).json({ success: false, message: 'Dosyalardan geçerli veri okunamadı.' });
    }

    // Özet hesapla
    const kategoriler = {};
    let toplamBbhb = 0;
    tumHayvanlar.forEach(h => {
      toplamBbhb += h.bbhb;
      if (!kategoriler[h.kategori]) kategoriler[h.kategori] = { adet: 0, bbhb: 0 };
      kategoriler[h.kategori].adet++;
      kategoriler[h.kategori].bbhb = parseFloat((kategoriler[h.kategori].bbhb + h.bbhb).toFixed(4));
    });

    const kayit = await BBHBYukle.create({
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
