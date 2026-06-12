const express = require('express');
const router = express.Router();
const { getAyarlar, driveEkle, driveTesti, driveSil, guncelle, sifirla, getIller, getIlceler, getMahalleler, sifreDogrula, sifreDegistir } = require('./ayarlar.controller');

router.post('/sifre/dogrula', sifreDogrula);
router.post('/sifre/degistir', sifreDegistir);

router.get('/', getAyarlar);
router.put('/', guncelle);
router.post('/sifirla', sifirla);

router.post('/drive', driveEkle);
router.get('/drive/:id/test', driveTesti);
router.delete('/drive/:id', driveSil);

router.get('/idari/iller', getIller);
router.get('/idari/ilceler/:il_id', getIlceler);
router.get('/idari/mahalleler/:ilce_id', getMahalleler);

module.exports = router;
