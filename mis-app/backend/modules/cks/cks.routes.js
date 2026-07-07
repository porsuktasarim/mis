const express = require('express');
const router  = express.Router();
const ctrl    = require('./cks.controller');

router.get('/',                    ctrl.listele);
router.post('/yukle',              ...ctrl.yukle);
router.get('/:id',                 ctrl.getById);
router.post('/:id/kisiler',        ctrl.kisileriGetir);
router.delete('/:id',              ctrl.sil);

module.exports = router;
