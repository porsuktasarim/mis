const express = require('express');
const router  = express.Router();
const ctrl    = require('./ayarlar.controller');

// Genel ayarlar
router.get('/',                         ctrl.getAyarlar);
router.put('/',                         ctrl.guncelle);
router.post('/sifirla',                 ctrl.sifirla);
router.post('/sifre-dogrula',           ctrl.sifreDogrula);
router.post('/sifre/dogrula',           ctrl.sifreDogrula);  // eski path uyumluluğu
router.post('/sifre-degistir',          ctrl.sifreDegistir);
router.post('/sifre/degistir',          ctrl.sifreDegistir); // eski path uyumluluğu

// Drive hesapları
router.post('/drive',                   ctrl.driveEkle);
router.delete('/drive/:id',             ctrl.driveSil);
router.post('/drive/:id/test',          ctrl.driveTesti);
router.get('/drive/:id/boyut',          ctrl.driveBoyut);
router.post('/drive/:id/token-kontrol', ctrl.driveTokenKontrol);
router.get('/drive/:id/oauth-url',      ctrl.driveOAuthUrl);
router.post('/drive/:id/oauth-token',   ctrl.driveOAuthToken);

// Dosya taşıma
router.post('/dosya-tasi/sunucu',       ctrl.dosyaTasiSunucu);
router.post('/dosya-tasi/drive',        ctrl.dosyaTasiDrive);

// İdari bölünme
router.get('/idari/iller',              ctrl.getIller);
router.get('/idari/ilceler/:il_id',     ctrl.getIlceler);
router.get('/idari/mahalleler/:ilce_id',ctrl.getMahalleler);
router.post('/idari',                   ctrl.idariEkle);
router.put('/idari/:id',                ctrl.idariGuncelle);
router.delete('/idari/:id',             ctrl.idariSil);
router.post('/idari/oncelik',           ctrl.idariOncelikKaydet);
router.get('/idari/ara',                ctrl.idariAra);

module.exports = router;
