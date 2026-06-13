const express = require('express');
const router = express.Router();
const { getAyarlar, driveEkle, driveTesti, driveSil, driveOAuthUrl, driveOAuthToken,
  guncelle, sifirla,
  getIller, getIlceler, getMahalleler, idariEkle, idariGuncelle, idariSil, idariOncelikKaydet, idariAra,
  sifreDogrula, sifreDegistir } = require('./ayarlar.controller');

router.post('/sifre/dogrula', sifreDogrula);
router.post('/sifre/degistir', sifreDegistir);

router.get('/idari/iller', getIller);
router.get('/idari/ilceler/:il_id', getIlceler);
router.get('/idari/mahalleler/:ilce_id', getMahalleler);
router.get('/idari/ara', idariAra);
router.post('/idari', idariEkle);
router.put('/idari/:id', idariGuncelle);
router.delete('/idari/:id', idariSil);
router.post('/idari/oncelik', idariOncelikKaydet);

router.get('/', getAyarlar);
router.put('/', guncelle);
router.post('/sifirla', sifirla);

router.post('/drive', driveEkle);
router.get('/drive/:id/test', driveTesti);
router.get('/drive/:id/oauth-url', driveOAuthUrl);
router.post('/drive/:id/oauth-token', driveOAuthToken);
router.delete('/drive/:id', driveSil);

module.exports = router;
