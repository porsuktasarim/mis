const express = require('express');
const router = express.Router();
const ctrl = require('./isgal.controller');

router.get('/istatistik',        ctrl.istatistik);
router.get('/',                  ctrl.listele);
router.post('/',                 ctrl.olustur);
router.get('/:id',               ctrl.getById);
router.put('/:id',               ctrl.guncelle);
router.delete('/:id',            ctrl.sil);

// Süreç adımları
router.post('/:id/adim',         ...ctrl.adimEkle);

// KML
router.post('/:id/kml',          ...ctrl.kmlYukle);
router.get('/:id/kml/:kmlId',    ctrl.kmlGetir);

module.exports = router;
