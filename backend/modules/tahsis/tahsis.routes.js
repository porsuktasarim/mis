const express = require('express');
const router  = express.Router();
const ctrl    = require('./tahsis.controller');
const { ek4abExcel } = require('./ek4ab.controller');
const raporCtrl = require('./raporlar.controller');

// Ana CRUD
router.get('/',                          ctrl.listele);
router.get('/istatistik',                ctrl.istatistik);
router.get('/:id',                       ctrl.getById);
router.post('/',                         ctrl.olustur);
router.put('/:id',                       ctrl.guncelle);
router.delete('/:id',                    ctrl.sil);

// Parsel grupları (Ek-4/c)
router.put('/:id/parsel-gruplari',       ctrl.parselGruplariGuncelle);

// Parseller
router.post('/:id/parseller/yukle',      ctrl.parsellerYukle);
router.put('/:id/parseller/:parsel_id',  ctrl.parselGuncelle);
router.delete('/:id/parseller/:parsel_id', ctrl.parselSil);

// BBHB bağlantıları
router.post('/:id/bbhb',                 ctrl.bbhbEkle);
router.delete('/:id/bbhb/:bbhb_bag_id', ctrl.bbhbSil);

// Raporlar
router.post('/:id/rapor/ek4ab',          ek4abExcel);
router.post('/:id/rapor/ek4d',           raporCtrl.ek4d);
router.post('/:id/rapor/ek4e',           raporCtrl.ek4e);
router.post('/:id/rapor/ek4f',           raporCtrl.ek4f);
router.post('/:id/rapor/ek4g',           raporCtrl.ek4g);
router.post('/:id/rapor/ek4h',           raporCtrl.ek4h);
router.post('/:id/rapor/ek5',            raporCtrl.ek5);
router.post('/:id/rapor/ek6',            raporCtrl.ek6);
router.post('/:id/rapor/ek7a',           raporCtrl.ek7a);
router.post('/:id/rapor/ek7b',           raporCtrl.ek7b);
router.post('/:id/rapor/ek7c',           raporCtrl.ek7c);
router.post('/:id/rapor/ek7f',           raporCtrl.ek7f);

module.exports = router;
