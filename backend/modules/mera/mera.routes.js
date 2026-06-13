const express = require('express');
const router = express.Router();
const ctrl = require('./mera.controller');

router.get('/istatistik',     ctrl.istatistik);
router.get('/',               ctrl.listele);
router.post('/',              ctrl.olustur);
router.get('/:id',            ctrl.getById);
router.put('/:id',            ctrl.guncelle);
router.delete('/:id',         ctrl.sil);

// KML
router.post('/:id/kml',       ...ctrl.kmlYukle);
router.get('/:id/kml',        ctrl.kmlGetir);

// Notlar
router.post('/:id/notlar',              upload.single('dosya'), ctrl.notEkle);
router.put('/:id/notlar/:notId',        ctrl.notGuncelle);
router.delete('/:id/notlar/:notId',     ctrl.notSil);

// Dosyalar
router.post('/:id/dosyalar',            ...ctrl.dosyaYukle);
router.delete('/:id/dosyalar/:dosyaId', ctrl.dosyaSil);

// Vasıf ve tahsis belgeleri
router.post('/:id/vasif-dosya',         ...ctrl.vasifDosyaYukle);
router.post('/:id/tahsis-dosya',        ...ctrl.tahsisDosyaYukle);

// Rapor
router.get('/:id/rapor/pdf',  ctrl.pdfRapor);

module.exports = router;
