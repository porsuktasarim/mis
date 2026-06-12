const express = require('express');
const router = express.Router();
const ctrl = require('./mera.controller');

router.get('/',           ctrl.listele);
router.post('/',          ctrl.olustur);
router.get('/:id',        ctrl.getById);
router.put('/:id',        ctrl.guncelle);
router.delete('/:id',     ctrl.sil);

// KML
router.post('/:id/kml',   ...ctrl.kmlYukle);
router.get('/:id/kml',    ctrl.kmlGetir);

// Notlar
router.post('/:id/notlar',               ctrl.notEkle);
router.put('/:id/notlar/:notId',         ctrl.notGuncelle);
router.delete('/:id/notlar/:notId',      ctrl.notSil);

// Dosyalar
router.post('/:id/dosyalar',             ...ctrl.dosyaYukle);
router.delete('/:id/dosyalar/:dosyaId',  ctrl.dosyaSil);

// Rapor
router.get('/:id/rapor/pdf', ctrl.pdfRapor);

module.exports = router;
