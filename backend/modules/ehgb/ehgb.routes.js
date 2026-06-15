const express = require('express');
const router = express.Router();
const ctrl = require('./ehgb.controller');

// İstatistik
router.get('/istatistik',           ctrl.istatistik);

// Parametreler (yıllık birim fiyatlar - ayarlardan yönetilir)
router.get('/parametreler',          ctrl.parametreListele);
router.get('/parametreler/:yil',     ctrl.parametreGetir);
router.post('/parametreler',         ctrl.parametreKaydet);
router.delete('/parametreler/:id',   ctrl.parametreSil);

// Hesaplamalar
router.get('/',                      ctrl.hesapListele);
router.post('/',                     ctrl.hesapOlustur);
router.get('/:id',                   ctrl.hesapGetir);
router.put('/:id',                   ctrl.hesapGuncelle);
router.delete('/:id',               ctrl.hesapSil);

module.exports = router;
