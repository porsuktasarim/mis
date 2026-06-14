const express = require('express');
const router = express.Router();
const ctrl = require('./mevzuat.controller');

router.get('/istatistik',          ctrl.istatistik);
router.get('/notlar',              ctrl.tumNotlar);
router.get('/',                    ctrl.listele);
router.post('/',                   ...ctrl.olustur);
router.get('/:id',                 ctrl.getById);
router.put('/:id',                 ctrl.guncelle);
router.delete('/:id',             ctrl.sil);
router.get('/:id/pdf',             ctrl.pdfGetir);
router.get('/:id/ara',             ctrl.icindekiAra);
router.post('/:id/yenile',         ctrl.manuelYenile);
router.post('/:id/onayla',         ctrl.guncellemeyiOnayla);
router.post('/:id/notlar',         ctrl.notEkle);
router.put('/:id/notlar/:notId',   ctrl.notGuncelle);
router.delete('/:id/notlar/:notId', ctrl.notSil);

module.exports = router;
