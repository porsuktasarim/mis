const Isgal = require('./isgal.model');
const Mera = require('../mera/mera.model');
const Ayarlar = require('../ayarlar/ayarlar.model');
const { google } = require('googleapis');
const multer = require('multer');
const path = require('path');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Drive ─────────────────────────────────────────────────
const getDriveClient = async () => {
  const ayarlar = await Ayarlar.findOne();
  const hesap = ayarlar?.drive_hesaplari?.find(h => h.aktif);
  if (!hesap) throw new Error('Aktif Drive hesabı bulunamadı.');
  if (hesap.tip === 'oauth2') {
    const { client_id, client_secret } = hesap.oauth_client_json.installed || hesap.oauth_client_json.web;
    const oauth2 = new google.auth.OAuth2(client_id, client_secret, 'urn:ietf:wg:oauth:2.0:oob');
    oauth2.setCredentials(hesap.oauth_token);
    oauth2.on('tokens', async (tokens) => {
      await Ayarlar.updateOne({ 'drive_hesaplari._id': hesap._id }, { $set: { 'drive_hesaplari.$.oauth_token': { ...hesap.oauth_token, ...tokens } } });
    });
    return google.drive({ version: 'v3', auth: oauth2 });
  }
  const auth = new google.auth.GoogleAuth({ credentials: hesap.service_account_json, scopes: ['https://www.googleapis.com/auth/drive'] });
  return google.drive({ version: 'v3', auth });
};

const getMisDriveFolder = async (drive, altKlasor) => {
  const misRes = await drive.files.list({ q: `name='MİS' and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: 'files(id)' });
  if (!misRes.data.files.length) throw new Error("Drive'da 'MİS' klasörü bulunamadı.");
  let parentId = misRes.data.files[0].id;
  for (const klasor of altKlasor) {
    const res = await drive.files.list({ q: `name='${klasor}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: 'files(id)' });
    if (res.data.files.length) parentId = res.data.files[0].id;
    else { const y = await drive.files.create({ requestBody: { name: klasor, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }, fields: 'id' }); parentId = y.data.id; }
  }
  return parentId;
};

const driveYukle = async (drive, folderId, dosyaAdi, mimeType, buffer) => {
  const { Readable } = require('stream');
  const s = new Readable(); s.push(buffer); s.push(null);
  const res = await drive.files.create({ requestBody: { name: dosyaAdi, parents: [folderId] }, media: { mimeType, body: s }, fields: 'id,webViewLink' });
  await drive.permissions.create({ fileId: res.data.id, requestBody: { role: 'reader', type: 'anyone' } });
  return res.data;
};

// ── İşgal No Üret ────────────────────────────────────────
const isgalNoUret = async () => {
  const count = await Isgal.countDocuments();
  const yil = new Date().getFullYear().toString().slice(2);
  const sira = String(count + 1).padStart(4, '0');
  return `ISG-${yil}-${sira}`;
};

// ── Adım TİP Etiketleri ───────────────────────────────────
const TIP_ETIKET = {
  tespit_tutanak: 'Tespit Tutanağı',
  komisyon_intikal: 'Komisyona İntikal',
  komisyon_karar: 'Komisyon Kararı',
  ucuncu_yol_3091: '3091 - Kaymakamlık/Valilik',
  uc_bin_doksan_bir_sonuc: '3091 Sonucu',
  iki_bin_sekiz_yuz_seksen_alti: '2886/75 - Jandarma/Kaymakamlık',
  dava_men_mudahale: 'Men-i Müdahale ve Kal Davası',
  suc_duyurusu: 'Suç Duyurusu',
  eski_hale_getirme: 'Eski Hale Getirme',
  tazminat_davasi: 'Tazminat Davası',
  sonuc: 'Sonuç/Kapatma',
  diger: 'Diğer',
};

// ── CRUD ──────────────────────────────────────────────────
const listele = async (req, res, next) => {
  try {
    const { mera_id, durum, aktif_adim, ara, sayfa = 1, limit = 20 } = req.query;
    const filtre = {};
    if (mera_id) filtre.mera_id = mera_id;
    if (durum) filtre.durum = durum;
    if (aktif_adim) filtre.aktif_adim = aktif_adim;
    if (ara) filtre.$or = [
      { isgal_no: new RegExp(ara, 'i') },
      { kullanici_no: new RegExp(ara, 'i') },
      { isgalci_ad_soyad: new RegExp(ara, 'i') },
      { mera_parsel: new RegExp(ara, 'i') },
      { mera_mahalle_ad: new RegExp(ara, 'i') },
    ];

    const toplam = await Isgal.countDocuments(filtre);
    const isgaller = await Isgal.find(filtre)
      .sort({ createdAt: -1 })
      .skip((sayfa - 1) * limit)
      .limit(parseInt(limit))
      .select('-adimlar.dosyalar -kml_katmanlar');

    // 3091 süre uyarıları
    const bugun = new Date();
    const uyarilar = [];
    const aktifler = await Isgal.find({ durum: 'aktif' }).select('isgal_no kullanici_no mera_parsel mera_il_ad mera_mahalle_ad adimlar');
    aktifler.forEach(ig => {
      ig.adimlar.forEach(a => {
        if (a.tip === 'ucuncu_yol_3091' && a.sure_bitis) {
          const kalan = Math.ceil((new Date(a.sure_bitis) - bugun) / 86400000);
          if (kalan <= 3) uyarilar.push({ isgal_id: ig._id, isgal_no: ig.kullanici_no || ig.isgal_no, mera: `${ig.mera_il_ad}/${ig.mera_mahalle_ad} P:${ig.mera_parsel}`, kalan_gun: kalan });
        }
      });
    });

    res.json({ success: true, toplam, sayfa: parseInt(sayfa), data: isgaller, uyarilar });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const isgal = await Isgal.findById(req.params.id);
    if (!isgal) return res.status(404).json({ success: false, message: 'İşgal bulunamadı' });
    res.json({ success: true, data: isgal });
  } catch (err) { next(err); }
};

const olustur = async (req, res, next) => {
  try {
    const { mera_id, tespit_sekli, tespit_tarihi, tespit_eden, isgal_tarihi,
      isgal_turu, isgal_turu_aciklama, isgal_alani_m2,
      isgalci_ad_soyad, isgalci_tc, isgalci_adres, aciklama } = req.body;
    const mera = await Mera.findById(mera_id).select('il_ad ilce_ad mahalle_ad ada parsel nitelik');
    if (!mera) return res.status(404).json({ success: false, message: 'Mera bulunamadı' });
    const isgal_no = await isgalNoUret();
    const isgal = await Isgal.create({
      mera_id, isgal_no,
      mera_il_ad: mera.il_ad, mera_ilce_ad: mera.ilce_ad,
      mera_mahalle_ad: mera.mahalle_ad, mera_ada: mera.ada, mera_parsel: mera.parsel,
      mera_nitelik: mera.nitelik,
      tespit_sekli, tespit_tarihi, tespit_eden, isgal_tarihi,
      isgal_turu, isgal_turu_aciklama, isgal_alani_m2,
      isgalci_ad_soyad, isgalci_tc, isgalci_adres, aciklama,
      aktif_adim: 'tespit_tutanak',
    });
    res.status(201).json({ success: true, data: isgal });
  } catch (err) { next(err); }
};

const guncelle = async (req, res, next) => {
  try {
    const isgal = await Isgal.findById(req.params.id);
    if (!isgal) return res.status(404).json({ success: false, message: 'İşgal bulunamadı' });
    const alanlar = ['tespit_sekli','tespit_tarihi','tespit_eden','isgal_tarihi','isgal_turu',
      'isgal_turu_aciklama','isgal_alani_m2','isgalci_ad_soyad','isgalci_tc','isgalci_adres',
      'durum','komisyon_karar_tipi','aciklama','kullanici_no'];
    alanlar.forEach(alan => { if (req.body[alan] !== undefined) isgal[alan] = req.body[alan]; });
    await isgal.save();
    res.json({ success: true, data: isgal });
  } catch (err) { next(err); }
};

const sil = async (req, res, next) => {
  try {
    await Isgal.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ── Adım Ekle ─────────────────────────────────────────────
const ADIM_SIRASI = [
  'tespit_tutanak','komisyon_intikal','komisyon_karar',
  'ucuncu_yol_3091','uc_bin_doksan_bir_sonuc',
  'iki_bin_sekiz_yuz_seksen_alti','dava_men_mudahale',
  'suc_duyurusu','eski_hale_getirme','tazminat_davasi','sonuc','diger'
];

const adimEkle = async (req, res, next) => {
  try {
    const isgal = await Isgal.findById(req.params.id);
    if (!isgal) return res.status(404).json({ success: false, message: 'İşgal bulunamadı' });

    const { tip, aciklama, sorumlu, sure_gun } = req.body;
    if (!aciklama?.trim()) return res.status(400).json({ success: false, message: 'Açıklama zorunludur' });

    const evrakTarihi = new Date().toISOString().slice(0,10).split('-').reverse().join('');
    const adimSira = isgal.adimlar.filter(a => a.tip === tip).length + 1;

    const adimVerisi = {
      sira: isgal.adimlar.length + 1,
      tip, aciklama, sorumlu, tamamlandi: true,
      dosyalar: [],
    };

    // Dosya varsa Drive'a yükle
    if (req.file) {
      const drive = await getDriveClient();
      const tipKisa = tip.replace(/_/g,'-').slice(0,20);
      const dosyaAdi = `ISGAL-${isgal.isgal_no}-${evrakTarihi}-${tipKisa}-${adimSira}${path.extname(req.file.originalname)}`;
      const folderId = await getMisDriveFolder(drive, [
        isgal.mera_il_ad, isgal.mera_ilce_ad, isgal.mera_mahalle_ad,
        `${isgal.mera_ada||'0'}-${isgal.mera_parsel}`, 'Isgal', isgal.isgal_no
      ]);
      const driveData = await driveYukle(drive, folderId, dosyaAdi, req.file.mimetype, req.file.buffer);
      adimVerisi.dosyalar.push({
        ad: dosyaAdi,
        adim_tip: tip,
        drive_file_id: driveData.id,
        drive_web_link: driveData.webViewLink,
        drive_download_link: `https://drive.google.com/uc?export=download&id=${driveData.id}`,
        mime_type: req.file.mimetype,
        boyut: req.file.size,
      });
    }

    if (tip === 'ucuncu_yol_3091') {
      const sure = parseInt(sure_gun) || 15;
      const bitis = new Date(); bitis.setDate(bitis.getDate() + sure);
      adimVerisi.sure_bitis = bitis;
    }

    isgal.adimlar.push(adimVerisi);

    const siradakiIdx = ADIM_SIRASI.indexOf(tip) + 1;
    if (siradakiIdx < ADIM_SIRASI.length) isgal.aktif_adim = ADIM_SIRASI[siradakiIdx];
    if (tip === 'sonuc') isgal.durum = 'cozuldu';
    if (tip === 'dava_men_mudahale') isgal.durum = 'mahkemede';

    await isgal.save();
    res.json({ success: true, data: isgal });
  } catch (err) { next(err); }
};
// ── KML ───────────────────────────────────────────────────
const kmlYukle = async (req, res, next) => {
  try {
    const isgal = await Isgal.findById(req.params.id);
    if (!isgal) return res.status(404).json({ success: false, message: 'İşgal bulunamadı' });
    if (!req.file) return res.status(400).json({ success: false, message: 'KML seçin' });

    let buffer = req.file.buffer;
    if (req.file.originalname.toLowerCase().endsWith('.kmz')) {
      const JSZip = require('jszip');
      const zip = await JSZip.loadAsync(buffer);
      const kf = Object.keys(zip.files).find(f => f.endsWith('.kml'));
      if (!kf) return res.status(400).json({ success: false, message: 'KMZ içinde KML yok' });
      buffer = Buffer.from(await zip.files[kf].async('arraybuffer'));
    }

    const { renk } = req.body;
    const drive = await getDriveClient();
    const tarihStr = new Date().toISOString().slice(0,10).split('-').reverse().join('');
    const surum = Math.random().toString(36).slice(2,5).toUpperCase();
    const dosyaAdi = `ISGAL-${isgal.isgal_no}-${tarihStr}-KML-${surum}.kml`;
    const folderId = await getMisDriveFolder(drive, [
      isgal.mera_il_ad, isgal.mera_ilce_ad, isgal.mera_mahalle_ad,
      `${isgal.mera_ada||'0'}-${isgal.mera_parsel}`, 'Isgal', isgal.isgal_no, 'KML'
    ]);
    const driveData = await driveYukle(drive, folderId, dosyaAdi, 'application/vnd.google-earth.kml+xml', buffer);

    isgal.kml_katmanlar.push({
      drive_file_id: driveData.id,
      drive_web_link: driveData.webViewLink,
      drive_download_link: `https://drive.google.com/uc?export=download&id=${driveData.id}`,
      dosya_adi: dosyaAdi,
      renk: renk || '#FF0000',
    });
    await isgal.save();
    res.json({ success: true, data: isgal.kml_katmanlar[isgal.kml_katmanlar.length - 1] });
  } catch (err) { next(err); }
};

const kmlGetir = async (req, res, next) => {
  try {
    const isgal = await Isgal.findById(req.params.id);
    const katman = isgal?.kml_katmanlar?.id(req.params.kmlId);
    if (!katman) return res.status(404).json({ success: false, message: 'KML bulunamadı' });
    const drive = await getDriveClient();
    const response = await drive.files.get({ fileId: katman.drive_file_id, alt: 'media' }, { responseType: 'arraybuffer' });
    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
    res.setHeader('Content-Disposition', 'inline; filename="isgal.kml"');
    res.send(Buffer.from(response.data));
  } catch (err) { next(err); }
};

// ── Rapor ─────────────────────────────────────────────────
const raporHtml = (isgal) => {
  const gorunurNo = isgal.kullanici_no ? `${isgal.kullanici_no} (${isgal.isgal_no})` : isgal.isgal_no;
  const TUR_ETIKET = { tarla_isgali:'Tarla/Yapılaşmasız', yapilasma:'Yapılaşma', yol_hafriyat:'Yol/Hafriyat' };
  const TESPIT_ETIKET = { teknik_ekip:'Teknik Ekip', sikayet:'Şikayet', ihbar:'İhbar' };
  const DURUM_ETIKET = { aktif:'Aktif', mahkemede:'Mahkemede', cozuldu:'Çözüldü', arsiv:'Arşiv' };

  const baslik = `İŞGAL KAYIT RAPORU — ${gorunurNo}`;
  const altBaslik = `${isgal.mera_il_ad} / ${isgal.mera_mahalle_ad} — Ada:${isgal.mera_ada||'-'} Parsel:${isgal.mera_parsel}`;

  const header = `<div class="sayfa-baslik"><strong>${baslik}</strong><span class="kucuk">${altBaslik}</span></div>`;

  const adimlarHtml = isgal.adimlar.map(a => `
    <tr>
      <td style="font-size:8.5pt;white-space:nowrap">${new Date(a.createdAt).toLocaleDateString('tr-TR')}</td>
      <td style="font-size:8.5pt"><strong>${TIP_ETIKET[a.tip]||a.tip}</strong>${a.sorumlu?'<br><span style="color:#666">'+a.sorumlu+'</span>':''}</td>
      <td style="font-size:8.5pt">${a.aciklama}</td>
      <td style="font-size:8pt;color:#0F6E56">${a.dosyalar?.map(d=>d.ad).join('<br>')||'-'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <title>${baslik}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Noto Sans',Arial,sans-serif;font-size:10pt;color:#222;padding:12mm 15mm;}
    .sayfa-baslik{border-bottom:2px solid #0F6E56;padding-bottom:3mm;margin-bottom:4mm;display:flex;justify-content:space-between;align-items:flex-end;}
    .sayfa-baslik strong{font-size:12pt;color:#0F6E56;}
    .sayfa-baslik .kucuk{font-size:8.5pt;color:#666;}
    h2{font-size:10.5pt;color:#0F6E56;margin:4mm 0 2mm;border-bottom:1px solid #9FE1CB;padding-bottom:1mm;}
    table{width:100%;border-collapse:collapse;margin-bottom:3mm;font-size:9.5pt;}
    th{background:#0F6E56;color:#fff;padding:3pt 6pt;text-align:left;font-size:8.5pt;}
    td{padding:3pt 6pt;border-bottom:1px solid #eee;vertical-align:top;}
    .label{color:#555;width:30%;}
    .footer{margin-top:6mm;font-size:8pt;color:#aaa;text-align:center;border-top:1px solid #ddd;padding-top:2mm;}
    .print-btn{text-align:center;margin-bottom:5mm;}
    @media print{.print-btn{display:none;}.sayfa-kirici{page-break-before:always;}.sayfa-baslik{display:flex!important;}}
  </style>
</head>
<body>
  <div class="print-btn"><button onclick="window.print()" style="background:#0F6E56;color:#fff;border:none;padding:6px 20px;border-radius:6px;cursor:pointer;">PDF / Yazdır</button></div>
  ${header}
  <h2>İşgal Bilgileri</h2>
  <table><tbody>
    <tr><td class="label">İşgal No</td><td><strong>${gorunurNo}</strong></td><td class="label">Durum</td><td>${DURUM_ETIKET[isgal.durum]||'-'}</td></tr>
    <tr><td class="label">Mera</td><td>${isgal.mera_il_ad} / ${isgal.mera_ilce_ad} / ${isgal.mera_mahalle_ad}</td><td class="label">Ada / Parsel</td><td>${isgal.mera_ada||'-'} / ${isgal.mera_parsel}</td></tr>
    <tr><td class="label">İşgal Türü</td><td>${TUR_ETIKET[isgal.isgal_turu]||'-'}</td><td class="label">Alan</td><td>${isgal.isgal_alani_m2?Number(isgal.isgal_alani_m2).toLocaleString('tr-TR')+' m²':'-'}</td></tr>
    <tr><td class="label">Açıklama</td><td colspan="3">${isgal.isgal_turu_aciklama||'-'}</td></tr>
    <tr><td class="label">Tespit Şekli</td><td>${TESPIT_ETIKET[isgal.tespit_sekli]||'-'}</td><td class="label">Tespit Tarihi</td><td>${isgal.tespit_tarihi?new Date(isgal.tespit_tarihi).toLocaleDateString('tr-TR'):'-'}</td></tr>
    <tr><td class="label">Tespit Eden</td><td>${isgal.tespit_eden||'-'}</td><td class="label">İşgal Başlangıcı</td><td>${isgal.isgal_tarihi?new Date(isgal.isgal_tarihi).toLocaleDateString('tr-TR'):'-'}</td></tr>
  </tbody></table>
  <h2>İşgalci Bilgileri</h2>
  <table><tbody>
    <tr><td class="label">Ad Soyad</td><td>${isgal.isgalci_ad_soyad||'-'}</td><td class="label">TC</td><td>${isgal.isgalci_tc||'-'}</td></tr>
    <tr><td class="label">Adres</td><td colspan="3">${isgal.isgalci_adres||'-'}</td></tr>
  </tbody></table>
  ${isgal.adimlar?.length ? `
  <div class="sayfa-kirici"></div>
  ${header}
  <h2>Süreç Adımları</h2>
  <table>
    <thead><tr><th style="width:12%">Tarih</th><th style="width:25%">Adım</th><th>Açıklama</th><th style="width:20%">Belge</th></tr></thead>
    <tbody>${adimlarHtml}</tbody>
  </table>` : ''}
  <div class="footer">MİS — İşgal Kayıt Raporu — ${gorunurNo} — ${new Date().toLocaleString('tr-TR')}</div>
</body></html>`;
};

const tekRapor = async (req, res, next) => {
  try {
    const isgal = await Isgal.findById(req.params.id);
    if (!isgal) return res.status(404).json({ success: false, message: 'İşgal bulunamadı' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(raporHtml(isgal));
  } catch (err) { next(err); }
};

const tumRapor = async (req, res, next) => {
  try {
    const { durum } = req.query;
    const filtre = durum ? { durum } : {};
    const isgaller = await Isgal.find(filtre).sort({ createdAt: -1 });
    if (!isgaller.length) return res.status(404).json({ success: false, message: 'Kayıt yok' });

    const TUR_ETIKET = { tarla_isgali:'Tarla/Yapılaşmasız', yapilasma:'Yapılaşma', yol_hafriyat:'Yol/Hafriyat' };
    const DURUM_ETIKET = { aktif:'Aktif', mahkemede:'Mahkemede', cozuldu:'Çözüldü', arsiv:'Arşiv' };

    const satirlar = isgaller.map(ig => {
      const no = ig.kullanici_no ? `${ig.kullanici_no} (${ig.isgal_no})` : ig.isgal_no;
      return `<tr>
        <td style="font-size:8.5pt"><strong>${no}</strong></td>
        <td style="font-size:8.5pt">${ig.mera_il_ad}/${ig.mera_mahalle_ad}<br><small>${ig.mera_ada||'-'}/${ig.mera_parsel}</small></td>
        <td style="font-size:8.5pt">${TUR_ETIKET[ig.isgal_turu]||'-'}</td>
        <td style="font-size:8.5pt">${ig.isgalci_ad_soyad||'-'}</td>
        <td style="font-size:8.5pt;text-align:right">${ig.isgal_alani_m2?Number(ig.isgal_alani_m2).toLocaleString('tr-TR'):'-'}</td>
        <td style="font-size:8.5pt">${ig.tespit_tarihi?new Date(ig.tespit_tarihi).toLocaleDateString('tr-TR'):'-'}</td>
        <td style="font-size:8.5pt">${DURUM_ETIKET[ig.durum]||'-'}</td>
        <td style="font-size:8pt;color:#0F6E56">${ig.aktif_adim?.replace(/_/g,' ')||'-'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8"/><title>Tüm İşgaller Raporu</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Noto Sans',Arial,sans-serif;font-size:9pt;padding:10mm 12mm;}
  h1{font-size:13pt;color:#0F6E56;margin-bottom:3mm;border-bottom:2px solid #0F6E56;padding-bottom:2mm;}
  table{width:100%;border-collapse:collapse;font-size:8.5pt;}
  th{background:#0F6E56;color:#fff;padding:3pt 5pt;text-align:left;font-size:8pt;}
  td{padding:3pt 5pt;border-bottom:1px solid #eee;vertical-align:top;}
  .footer{margin-top:5mm;font-size:8pt;color:#aaa;text-align:center;}
  .print-btn{text-align:center;margin-bottom:4mm;}
  @media print{.print-btn{display:none;}}
</style></head>
<body>
  <div class="print-btn"><button onclick="window.print()" style="background:#0F6E56;color:#fff;border:none;padding:6px 20px;border-radius:6px;cursor:pointer;">PDF / Yazdır</button></div>
  <h1>TÜM İŞGAL KAYITLARI — ${new Date().toLocaleDateString('tr-TR')} — ${isgaller.length} kayıt</h1>
  <table>
    <thead><tr><th>İşgal No</th><th>Mera</th><th>Tür</th><th>İşgalci</th><th>Alan (m²)</th><th>Tespit</th><th>Durum</th><th>Aktif Adım</th></tr></thead>
    <tbody>${satirlar}</tbody>
  </table>
  <div class="footer">MİS — İşgal Raporu — ${new Date().toLocaleString('tr-TR')}</div>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { next(err); }
};

// ── İstatistik ────────────────────────────────────────────
const istatistik = async (req, res, next) => {
  try {
    const bugun = new Date();
    const [toplam, aktif, mahkemede, cozuldu] = await Promise.all([
      Isgal.countDocuments(),
      Isgal.countDocuments({ durum: 'aktif' }),
      Isgal.countDocuments({ durum: 'mahkemede' }),
      Isgal.countDocuments({ durum: 'cozuldu' }),
    ]);
    const sure_uyarilari = [];
    const aktifler = await Isgal.find({ durum: 'aktif' }).select('isgal_no kullanici_no mera_parsel mera_il_ad mera_mahalle_ad adimlar');
    aktifler.forEach(ig => {
      ig.adimlar.forEach(a => {
        if (a.tip === 'ucuncu_yol_3091' && a.sure_bitis) {
          const kalan = Math.ceil((new Date(a.sure_bitis) - bugun) / 86400000);
          if (kalan <= 3) sure_uyarilari.push({ isgal_id: ig._id, isgal_no: ig.kullanici_no||ig.isgal_no, mera: `${ig.mera_il_ad}/${ig.mera_mahalle_ad} P:${ig.mera_parsel}`, kalan_gun: kalan });
        }
      });
    });
    res.json({ success: true, data: { toplam, aktif, mahkemede, cozuldu, sure_uyarilari } });
  } catch (err) { next(err); }
};

// ── Adıma Dosya Ekle ─────────────────────────────────────
const adimDosyaEkle = async (req, res, next) => {
  try {
    const isgal = await Isgal.findById(req.params.id);
    if (!isgal) return res.status(404).json({ success: false, message: 'İşgal bulunamadı' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Dosya seçin' });

    const { adim_id } = req.body;
    const adim = isgal.adimlar.id(adim_id);
    if (!adim) return res.status(404).json({ success: false, message: 'Adım bulunamadı' });
    if (!adim.tamamlandi) return res.status(400).json({ success: false, message: 'Adım henüz işaretlenmemiş. Önce adımı tamamlayın.' });

    const drive = await getDriveClient();
    const evrakTarihi = new Date().toISOString().slice(0,10).split('-').reverse().join('');
    const adimSira = adim.dosyalar.length + 1;
    const tipKisa = adim.tip.replace(/_/g,'-').slice(0,20);
    const dosyaAdi = `ISGAL-${isgal.isgal_no}-${evrakTarihi}-${tipKisa}-${adimSira}${path.extname(req.file.originalname)}`;
    const folderId = await getMisDriveFolder(drive, [
      isgal.mera_il_ad, isgal.mera_ilce_ad, isgal.mera_mahalle_ad,
      `${isgal.mera_ada||'0'}-${isgal.mera_parsel}`, 'Isgal', isgal.isgal_no
    ]);
    const driveData = await driveYukle(drive, folderId, dosyaAdi, req.file.mimetype, req.file.buffer);

    adim.dosyalar.push({
      ad: dosyaAdi, adim_tip: adim.tip,
      drive_file_id: driveData.id, drive_web_link: driveData.webViewLink,
      drive_download_link: `https://drive.google.com/uc?export=download&id=${driveData.id}`,
      mime_type: req.file.mimetype, boyut: req.file.size,
    });
    await isgal.save();
    res.json({ success: true, data: adim.dosyalar[adim.dosyalar.length - 1] });
  } catch (err) { next(err); }
};

// ── Excel Raporu (Tüm İşgaller) ──────────────────────────
const excelRapor = async (req, res, next) => {
  try {
    const { durum } = req.query;
    const filtre = durum ? { durum } : {};
    const isgaller = await Isgal.find(filtre).sort({ createdAt: -1 });

    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('İşgal Kayıtları');

    const TUR_ETIKET = { tarla_isgali:'Tarla/Yapılaşmasız', yapilasma:'Yapılaşma', yol_hafriyat:'Yol/Hafriyat' };
    const DURUM_ETIKET = { aktif:'Aktif', mahkemede:'Mahkemede', cozuldu:'Çözüldü', arsiv:'Arşiv' };
    const TESPIT_ETIKET = { teknik_ekip:'Teknik Ekip', sikayet:'Şikayet', ihbar:'İhbar' };
    const ADIM_ET = { tespit_tutanak:'Tespit', komisyon_intikal:'Komisyon İntikal', komisyon_karar:'Komisyon Karar', ucuncu_yol_3091:'3091', uc_bin_doksan_bir_sonuc:'3091 Sonuç', iki_bin_sekiz_yuz_seksen_alti:'2886/75', dava_men_mudahale:'Dava', suc_duyurusu:'Suç Duyurusu', eski_hale_getirme:'Eski Hale', tazminat_davasi:'Tazminat', sonuc:'Sonuç', diger:'Diğer' };

    ws.columns = [
      { header: 'İşgal No', key: 'no', width: 18 },
      { header: 'Sistem No', key: 'sistem_no', width: 15 },
      { header: 'İl', key: 'il', width: 12 },
      { header: 'İlçe', key: 'ilce', width: 14 },
      { header: 'Mahalle/Köy', key: 'mahalle', width: 16 },
      { header: 'Ada', key: 'ada', width: 8 },
      { header: 'Parsel', key: 'parsel', width: 10 },
      { header: 'İşgal Türü', key: 'tur', width: 20 },
      { header: 'Alan (m²)', key: 'alan', width: 12 },
      { header: 'İşgalci', key: 'isgalci', width: 20 },
      { header: 'TC', key: 'tc', width: 14 },
      { header: 'Tespit Şekli', key: 'tespit_sekli', width: 15 },
      { header: 'Tespit Tarihi', key: 'tespit_tarihi', width: 14 },
      { header: 'Aktif Adım', key: 'aktif_adim', width: 18 },
      { header: 'Durum', key: 'durum', width: 12 },
      { header: 'Açıklama', key: 'aciklama', width: 30 },
    ];

    // Başlık stili
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F6E56' } };

    isgaller.forEach(ig => {
      ws.addRow({
        no: ig.kullanici_no || ig.isgal_no,
        sistem_no: ig.kullanici_no ? ig.isgal_no : '',
        il: ig.mera_il_ad, ilce: ig.mera_ilce_ad, mahalle: ig.mera_mahalle_ad,
        ada: ig.mera_ada||'', parsel: ig.mera_parsel,
        tur: TUR_ETIKET[ig.isgal_turu]||ig.isgal_turu,
        alan: ig.isgal_alani_m2||'',
        isgalci: ig.isgalci_ad_soyad||'', tc: ig.isgalci_tc||'',
        tespit_sekli: TESPIT_ETIKET[ig.tespit_sekli]||'',
        tespit_tarihi: ig.tespit_tarihi ? new Date(ig.tespit_tarihi).toLocaleDateString('tr-TR') : '',
        aktif_adim: ADIM_ET[ig.aktif_adim]||ig.aktif_adim||'',
        durum: DURUM_ETIKET[ig.durum]||ig.durum,
        aciklama: ig.isgal_turu_aciklama||'',
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="isgal-raporu-${new Date().toISOString().slice(0,10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
};

// ── Word Raporu (Tekil İşgal) ─────────────────────────────
const wordRapor = async (req, res, next) => {
  try {
    const isgal = await Isgal.findById(req.params.id);
    if (!isgal) return res.status(404).json({ success: false, message: 'İşgal bulunamadı' });

    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel, AlignmentType } = require('docx');
    const TUR_ETIKET = { tarla_isgali:'Tarla/Yapılaşmasız', yapilasma:'Yapılaşma', yol_hafriyat:'Yol/Hafriyat' };
    const DURUM_ETIKET = { aktif:'Aktif', mahkemede:'Mahkemede', cozuldu:'Çözüldü', arsiv:'Arşiv' };
    const TESPIT_ETIKET = { teknik_ekip:'Teknik Ekip', sikayet:'Şikayet', ihbar:'İhbar' };
    const TIP_ETIKET = { tespit_tutanak:'Tespit Tutanağı', komisyon_intikal:'Komisyona İntikal', komisyon_karar:'Komisyon Kararı', ucuncu_yol_3091:'3091 - Kaymakamlık/Valilik', uc_bin_doksan_bir_sonuc:'3091 Sonucu', iki_bin_sekiz_yuz_seksen_alti:'2886/75 - Jandarma/Kaymakamlık', dava_men_mudahale:'Men-i Müdahale ve Kal Davası', suc_duyurusu:'Suç Duyurusu', eski_hale_getirme:'Eski Hale Getirme', tazminat_davasi:'Tazminat Davası', sonuc:'Sonuç/Kapatma', diger:'Diğer' };

    const gorunurNo = isgal.kullanici_no ? `${isgal.kullanici_no} (${isgal.isgal_no})` : isgal.isgal_no;

    const bilgiSatiri = (etiket, deger) => new Paragraph({
      children: [
        new TextRun({ text: `${etiket}: `, bold: true }),
        new TextRun({ text: deger || '-' }),
      ],
      spacing: { after: 60 },
    });

    const baslik = new Paragraph({
      text: `İŞGAL KAYIT RAPORU — ${gorunurNo}`,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    });

    const altBaslik = new Paragraph({
      children: [new TextRun({ text: `${isgal.mera_il_ad} / ${isgal.mera_mahalle_ad} — Ada: ${isgal.mera_ada||'-'} Parsel: ${isgal.mera_parsel}`, color: '666666' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    });

    const bolumBasligi = (metin) => new Paragraph({
      text: metin,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 150 },
    });

    const adimParagraflar = isgal.adimlar.flatMap(a => [
      new Paragraph({
        children: [
          new TextRun({ text: `${TIP_ETIKET[a.tip]||a.tip}`, bold: true }),
          new TextRun({ text: ` — ${new Date(a.createdAt).toLocaleDateString('tr-TR')}`, color: '888888' }),
          a.sorumlu ? new TextRun({ text: ` (${a.sorumlu})`, color: '666666' }) : new TextRun(''),
        ],
        spacing: { before: 120, after: 60 },
      }),
      new Paragraph({ text: a.aciklama, spacing: { after: 60 } }),
      ...(a.dosyalar||[]).map(d => new Paragraph({
        children: [new TextRun({ text: `📎 ${d.ad}`, color: '0F6E56' })],
        spacing: { after: 40 },
      })),
    ]);

    const doc = new Document({
      sections: [{
        children: [
          baslik, altBaslik,
          bolumBasligi('İşgal Bilgileri'),
          bilgiSatiri('İşgal No', gorunurNo),
          bilgiSatiri('Mera', `${isgal.mera_il_ad} / ${isgal.mera_ilce_ad} / ${isgal.mera_mahalle_ad}`),
          bilgiSatiri('Ada / Parsel', `${isgal.mera_ada||'-'} / ${isgal.mera_parsel}`),
          bilgiSatiri('İşgal Türü', TUR_ETIKET[isgal.isgal_turu]||'-'),
          bilgiSatiri('Alan', isgal.isgal_alani_m2 ? `${Number(isgal.isgal_alani_m2).toLocaleString('tr-TR')} m²` : '-'),
          bilgiSatiri('Açıklama', isgal.isgal_turu_aciklama),
          bilgiSatiri('Tespit Şekli', TESPIT_ETIKET[isgal.tespit_sekli]||'-'),
          bilgiSatiri('Tespit Tarihi', isgal.tespit_tarihi ? new Date(isgal.tespit_tarihi).toLocaleDateString('tr-TR') : '-'),
          bilgiSatiri('Tespit Eden', isgal.tespit_eden),
          bilgiSatiri('Durum', DURUM_ETIKET[isgal.durum]||'-'),
          bolumBasligi('İşgalci Bilgileri'),
          bilgiSatiri('Ad Soyad', isgal.isgalci_ad_soyad),
          bilgiSatiri('TC', isgal.isgalci_tc),
          bilgiSatiri('Adres', isgal.isgalci_adres),
          ...(isgal.adimlar?.length ? [bolumBasligi('Süreç Adımları'), ...adimParagraflar] : []),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="isgal-${isgal.isgal_no}.docx"`);
    res.send(buffer);
  } catch (err) { next(err); }
};

module.exports = {
  listele, getById, olustur, guncelle, sil,
  adimEkle: [upload.single('belge'), adimEkle],
  adimDosyaEkle: [upload.single('belge'), adimDosyaEkle],
  kmlYukle: [upload.single('kml'), kmlYukle],
  kmlGetir, tekRapor, tumRapor, excelRapor, wordRapor, istatistik,
};
