const express = require('express');
const router = express.Router();
const {
  getTurler, hesapla, kaydet, listele, getById, sil,
  excelRapor, pdfRapor, wordRapor,
} = require('./bbhb.controller');

router.get('/turler',              getTurler);
router.post('/hesapla',            hesapla);
router.post('/kaydet',             kaydet);
router.get('/',                    listele);
router.get('/:id',                 getById);
router.delete('/:id',              sil);
router.get('/:id/rapor/excel',     excelRapor);
router.get('/:id/rapor/pdf',       pdfRapor);
router.get('/:id/rapor/word',      wordRapor);

module.exports = router;
