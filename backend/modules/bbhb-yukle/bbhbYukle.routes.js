const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { dosyalariisle, listele, getById, sil } = require('./bbhbYukle.controller');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, '/tmp/mis_uploads'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const izinli = ['.xls', '.xlsx', '.csv'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (izinli.includes(ext)) cb(null, true);
  else cb(new Error('Sadece XLS, XLSX veya CSV dosyaları kabul edilir.'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post('/yukle', upload.array('dosyalar', 10), dosyalariisle);
router.get('/', listele);
router.get('/:id', getById);
router.delete('/:id', sil);

module.exports = router;
