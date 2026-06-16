const express = require('express');
const router = express.Router();
const ctrl = require('./ehgb.controller');

router.get('/istatistik',           ctrl.istatistik);
router.post('/hesapla',             ctrl.canliHesapla);
router.get('/parametreler',          ctrl.parametreListele);
router.get('/parametreler/:yil',     ctrl.parametreGetir);
router.post('/parametreler',         ctrl.parametreKaydet);
router.delete('/parametreler/:id',   ctrl.parametreSil);
router.get('/',                      ctrl.hesapListele);
router.post('/',                     ctrl.hesapOlustur);
router.get('/:id',                   ctrl.hesapGetir);
router.put('/:id',                   ctrl.hesapGuncelle);
router.delete('/:id',               ctrl.hesapSil);
router.get('/:id/rapor',             ctrl.rapor);
router.get('/:id/rapor/word',        ctrl.raporWord);

module.exports = router;
