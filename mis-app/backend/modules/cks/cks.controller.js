const CksYukle = require('./cks.model');
const XLSX     = require('xlsx');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

// ── Ürün gruplandırma ────────────────────────────────────
const URUN_GRUPLARI = {
  yem_bitkisi: new Set([
    'YULAF(YEŞİL OT)', 'İTALYAN ÇİMİ(MUHTELİF)', 'İTALYAN ÇİMİ(YEŞİL OT)',
    'ARPA(YEMLİK)', 'ÇAYIR OTU(MUHTELİF)', 'ARPA YEMLİK',
    'FİĞ(MUHTELİF)', 'YEM BİTKİLERİ(MUHTELİF)', 'KORUNGA(MUHTELİF)',
    'YONCA(MUHTELİF)', 'TRİTİKALE(YEŞİL OT)',
  ]),
  hububat: new Set([
    'ARPA(muhtelif)', 'ARPA(EKMEKLİK)', 'BUĞDAY(EKMEKLİK)', 'BUĞDAY(SERT)',
    'AYÇİÇEĞİ(YAĞLIK)', 'AYÇİÇEĞİ(YAĞLIK - TOHUMLUK)', 'AYÇİÇEĞİ(TOHUMLUK)',
    'MISIR(TANETANE)', 'MISIR(SİLAJLIK)', 'ÇELTİK(MUHTELİF)',
    'ÇAVDAR(MUHTELİF)', 'TRİTİKALE(MUHTELİF)',
  ]),
};

const urunGrubu = (urunAdi) => {
  if (!urunAdi) return 'diger';
  const u = urunAdi.toUpperCase().trim();
  for (const [grup, set] of Object.entries(URUN_GRUPLARI)) {
    if (set.has(u)) return grup;
  }
  // Anahtar kelime eşleştirme (uzun liste için)
  if (/YEM|ÇİM|YULAF|KORUNGA|YONCA|FİĞ/.test(u)) return 'yem_bitkisi';
  if (/ARPA|BUĞDAY|MISIR|AYÇİÇEĞİ|ÇELTİK/.test(u)) return 'hububat';
  return 'sebze_bag'; // Varsayılan: sebze/bağ
};

// ── Multer (geçici upload) ────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '../../uploads/cks');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `cks_${Date.now()}.xlsx`),
  }),
  fileFilter: (req, file, cb) => {
    const ok = /xlsx|xls/.test(path.extname(file.originalname).toLowerCase());
    cb(null, ok);
  },
});

// ── XLS Parse ────────────────────────────────────────────
const parseXls = (dosyaYolu) => {
  const wb = XLSX.readFile(dosyaYolu);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Üretim yılı (satır 8, sütun D = index 3)
  let uretim_yili = null;
  for (let i = 0; i < Math.min(12, rows.length); i++) {
    const r = rows[i];
    if (r && String(r[0]||'').includes('Üretim Yılı')) {
      uretim_yili = r[3] ? parseInt(r[3]) : null;
    }
  }

  // Başlık satırı 11 (index 10): İşletme Adı, TC, İl, _, İlçe, Köy, Ada, Parsel, KullAlan, TarımNo, ParselAlan, Ürün, TarımŞekli, ...EkimTarihi...EkilAlan
  // Veri satırları 12'den itibaren (index 11)
  const KOLON = {
    kisi:    0,   // İşletme Adı
    tc:      5,   // TC/VKN
    il:      6,   // İl
    ilce:    8,   // İlçe
    koy:     9,   // Köy
    urun:    15,  // Ürün
    ekil:    20,  // Ekili Alan (da)
  };

  const kisiler = {};
  let il_genel = '', ilce_genel = '', koy_genel = '';

  for (let i = 11; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[KOLON.kisi]) continue;

    const ad = String(r[KOLON.kisi]).trim();
    if (!ad) continue;

    const tc     = r[KOLON.tc]   ? String(r[KOLON.tc]).trim()   : '';
    const il     = r[KOLON.il]   ? String(r[KOLON.il]).trim()   : '';
    const ilce   = r[KOLON.ilce] ? String(r[KOLON.ilce]).trim() : '';
    const koy    = r[KOLON.koy]  ? String(r[KOLON.koy]).trim()  : '';
    const urun   = r[KOLON.urun] ? String(r[KOLON.urun]).trim() : '';
    const alan   = parseFloat(r[KOLON.ekil] || 0) || 0;

    if (il) il_genel   = il;
    if (ilce) ilce_genel = ilce;
    if (koy) koy_genel  = koy;

    if (!kisiler[ad]) {
      kisiler[ad] = {
        ad_soyad: ad, tc_vkn: tc, il, ilce, koy,
        yem_bitkisi: 0, sebze_bag: 0, hububat: 0, toplam_alan: 0,
        urunler: [],
      };
    }

    const grup = urunGrubu(urun);
    if (alan > 0) {
      kisiler[ad][grup]       = +(kisiler[ad][grup] + alan).toFixed(3);
      kisiler[ad].toplam_alan = +(kisiler[ad].toplam_alan + alan).toFixed(3);
      kisiler[ad].urunler.push({ urun_adi: urun, alan_da: alan, grup });
    }
  }

  return {
    uretim_yili,
    il: il_genel, ilce: ilce_genel, koy: koy_genel,
    kisiler: Object.values(kisiler).map((k, i) => ({ ...k, sira_no: i + 1 })),
  };
};

// ── Upload & Kaydet ───────────────────────────────────────
const yukle = [upload.single('dosya'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Dosya yüklenmedi' });

    const parsed = parseXls(req.file.path);
    fs.unlinkSync(req.file.path); // Geçici dosyayı sil

    const kayit = await CksYukle.create({
      dosya_adi:   req.file.originalname,
      uretim_yili: parsed.uretim_yili,
      il:          parsed.il,
      ilce:        parsed.ilce,
      koy:         parsed.koy,
      kisi_sayisi: parsed.kisiler.length,
      kisiler:     parsed.kisiler,
      aciklama:    req.body.aciklama || '',
    });

    res.status(201).json({
      success: true,
      data: {
        _id:          kayit._id,
        dosya_adi:    kayit.dosya_adi,
        uretim_yili:  kayit.uretim_yili,
        il:           kayit.il,
        ilce:         kayit.ilce,
        koy:          kayit.koy,
        kisi_sayisi:  kayit.kisi_sayisi,
        ozet: {
          yem_var:    parsed.kisiler.filter(k=>k.yem_bitkisi>0).length,
          hububat_var:parsed.kisiler.filter(k=>k.hububat>0).length,
          sebze_var:  parsed.kisiler.filter(k=>k.sebze_bag>0).length,
        },
      },
    });
  } catch (err) { next(err); }
}];

// ── Liste ─────────────────────────────────────────────────
const listele = async (req, res, next) => {
  try {
    const { il, ilce, koy, yil } = req.query;
    const filtre = {};
    if (il)  filtre.il   = { $regex: il,   $options: 'i' };
    if (ilce) filtre.ilce = { $regex: ilce, $options: 'i' };
    if (koy)  filtre.koy  = { $regex: koy,  $options: 'i' };
    if (yil)  filtre.uretim_yili = parseInt(yil);
    const data = await CksYukle.find(filtre).sort({ createdAt: -1 }).select('-kisiler');
    res.json({ success: true, count: data.length, data });
  } catch (err) { next(err); }
};

// ── Tekil getir ───────────────────────────────────────────
const getById = async (req, res, next) => {
  try {
    const kayit = await CksYukle.findById(req.params.id);
    if (!kayit) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
    res.json({ success: true, data: kayit });
  } catch (err) { next(err); }
};

// ── Kişi ara (3T/rapor için) ──────────────────────────────
// Belirli isimleri ÇKS kaydından getir (BBHB ile eşleştirme için)
const kisileriGetir = async (req, res, next) => {
  try {
    const kayit = await CksYukle.findById(req.params.id).select('kisiler uretim_yili il ilce koy');
    if (!kayit) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });

    const { isimler } = req.body; // Array: ['AHMET ORUÇ', 'ZAHIT ORTA', ...]
    if (isimler && isimler.length > 0) {
      const eslesen = kayit.kisiler.filter(k =>
        isimler.some(i => i.toUpperCase().trim() === k.ad_soyad.toUpperCase().trim())
      );
      return res.json({ success: true, data: eslesen, meta: { uretim_yili: kayit.uretim_yili, il: kayit.il, ilce: kayit.ilce, koy: kayit.koy } });
    }
    res.json({ success: true, data: kayit.kisiler, meta: { uretim_yili: kayit.uretim_yili, il: kayit.il, ilce: kayit.ilce, koy: kayit.koy } });
  } catch (err) { next(err); }
};

// ── Sil ───────────────────────────────────────────────────
const sil = async (req, res, next) => {
  try {
    const kayit = await CksYukle.findByIdAndDelete(req.params.id);
    if (!kayit) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
    res.json({ success: true, message: 'Silindi' });
  } catch (err) { next(err); }
};

module.exports = { yukle, listele, getById, kisileriGetir, sil };
