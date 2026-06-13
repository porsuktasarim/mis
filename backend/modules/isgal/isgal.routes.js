const express = require('express');
const router = express.Router();
const ctrl = require('./isgal.controller');

router.get('/istatistik',       ctrl.istatistik);
router.get('/rapor',            ctrl.tumRapor);
router.get('/',                 ctrl.listele);
router.post('/',                ctrl.olustur);
router.get('/:id',              ctrl.getById);
router.put('/:id',              ctrl.guncelle);
router.delete('/:id',          ctrl.sil);
router.get('/:id/rapor',        ctrl.tekRapor);
router.post('/:id/adim',        ...ctrl.adimEkle);
router.post('/:id/kml',         ...ctrl.kmlYukle);
router.get('/:id/kml/:kmlId',   ctrl.kmlGetir);

module.exports = router;
