/**
 * 3T Raporlar Controller
 * Ek-4/d, e, f, g, h, 5, 6, 7a, 7b, 7c, 7f
 * Yakında implement edilecek
 */

const placeholder = (ad) => async (req, res) => {
  res.status(501).json({ success: false, message: `${ad} raporu henüz hazırlanmadı` });
};

module.exports = {
  ek4d:  placeholder('Ek-4/d'),
  ek4e:  placeholder('Ek-4/e'),
  ek4f:  placeholder('Ek-4/f'),
  ek4g:  placeholder('Ek-4/g'),
  ek4h:  placeholder('Ek-4/h'),
  ek5:   placeholder('Ek-5'),
  ek6:   placeholder('Ek-6'),
  ek7a:  placeholder('Ek-7/a'),
  ek7b:  placeholder('Ek-7/b'),
  ek7c:  placeholder('Ek-7/c'),
  ek7f:  placeholder('Ek-7/f'),
};
