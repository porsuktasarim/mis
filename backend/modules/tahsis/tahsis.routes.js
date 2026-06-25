const express = require('express');
const router  = express.Router();
const ctrl    = require('./tahsis.controller');

// Ana CRUD
router.get('/',                          ctrl.listele);
router.get('/istatistik',                ctrl.istatistik);
router.get('/:id',                       ctrl.getById);
router.post('/',                         ctrl.olustur);
router.put('/:id',                       ctrl.guncelle);
router.delete('/:id',                    ctrl.sil);

// Parseller
router.post('/:id/parseller/yukle',      ctrl.parsellerYukle);
router.put('/:id/parseller/:parsel_id',  ctrl.parselGuncelle);
router.delete('/:id/parseller/:parsel_id', ctrl.parselSil);

// BBHB bağlantıları
router.post('/:id/bbhb',                 ctrl.bbhbEkle);
router.delete('/:id/bbhb/:bbhb_bag_id', ctrl.bbhbSil);

module.exports = router;
