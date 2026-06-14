const express = require('express');
const router = express.Router();
const ctrl = require('./mevzuat.controller');

router.get('/istatistik',          ctrl.istatistik);
router.get('/',                    ctrl.listele);
router.post('/',                   ...ctrl.olustur);
router.get('/:id',                 ctrl.getById);
router.put('/:id',                 ctrl.guncelle);
router.delete('/:id',             ctrl.sil);
router.get('/:id/pdf',             ctrl.pdfGetir);
router.post('/:id/yenile',         ctrl.manuelYenile);
router.post('/:id/onayla',         ctrl.guncellemeyiOnayla);

module.exports = router;
