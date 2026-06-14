# MİS — Mera İzleme Sistemi

Tarım ve Orman Bakanlığı İl/İlçe Müdürlükleri için geliştirilmiş mera parsel yönetim sistemi.

## Teknoloji

| Katman | Teknoloji |
|---|---|
| Backend | Node.js, Express.js, Mongoose |
| Veritabanı | MongoDB 7 |
| Frontend | Bootstrap 5, Vanilla JS, Leaflet.js |
| Dosya Depolama | Google Drive (OAuth2 / Service Account) |
| Altyapı | Docker Compose, Coolify |
| Zamanlama | node-cron |
| HTTP İstemci | axios |

## Canlı URL

`https://mis.pors.uk`

## Repo

`https://github.com/porsuktasarim/mis.git`

---

## Proje Yapısı

```
mis-app/
├── docker-compose.yml
├── .env
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   ├── config/db.js
│   ├── middleware/errorHandler.js
│   ├── data/
│   │   └── Il-ilce-Semt-Mahalle-PostaKodu.xml   # 47.649 mahalle
│   └── modules/
│       ├── bbhb/
│       ├── bbhb-yukle/
│       ├── mera/
│       ├── ayarlar/
│       ├── idari/
│       ├── isgal/
│       └── mevzuat/
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── public/
        ├── index.html
        ├── css/main.css
        ├── js/sidebar.js
        ├── bbhb/
        ├── mera/
        ├── isgal/
        ├── mevzuat/
        └── ayarlar/
```

---

## Modüller

### Mera (`/mera/`)
Mera parsellerinin kayıt ve takip modülü.

**Özellikler:**
- İl/ilçe/mahalle filtreli liste (47.649 mahalle, plaka sırasına göre)
- Parsel detayları: nitelik, vasıf, toprak sınıfı, tapu alanı, kadastral alan
- Mülkiyet bilgileri: cilt/sayfa/kayıt durumu, malik, pay/payda, şerhler
- KML/KMZ yükleme → Google Drive'a kaydedilir, haritada Leaflet+OpenStreetMap ile gösterim
- Vasıf belgesi (1 yıl) ve tahsis belgesi (5 yıl) takibi → süresi yaklaşınca uyarı
- Otlatma kapasitesi: EK-1 tabloları üzerinden BBHB hesaplama
- Renkli notlar, dosya yükleme, dosya-not ilişkilendirme
- PDF raporu (Noto Sans, çok sayfalı, her sayfada başlık)
- Ana sayfada: toplam aktif mera (adet, hektar, BBHB), uyarı sayaçları

**API:**
```
GET    /api/mera/istatistik
GET    /api/mera
POST   /api/mera
GET    /api/mera/:id
PUT    /api/mera/:id
DELETE /api/mera/:id
POST   /api/mera/:id/kml
GET    /api/mera/:id/kml          # inline KML (Google Earth Web için)
POST   /api/mera/:id/notlar
PUT    /api/mera/:id/notlar/:notId
DELETE /api/mera/:id/notlar/:notId
POST   /api/mera/:id/dosyalar
DELETE /api/mera/:id/dosyalar/:dosyaId
POST   /api/mera/:id/vasif-dosya
POST   /api/mera/:id/tahsis-dosya
GET    /api/mera/:id/rapor/pdf
```

---

### İşgal (`/isgal/`)
Mera parseline yapılan tecavüz/işgal kayıt ve takip modülü. 4342 sayılı Mera Kanunu, 3091 ve 2886 sayılı kanunlar kapsamında süreç yönetimi.

**Özellikler:**
- İşgal no: `ISG-YY-NNNN` formatı (sistem), kullanıcı no eklenebilir
- İşgal türü: Tarla İşgali / Yapılaşma / Yol-Hafriyat (açıklama zorunlu)
- İşgal alanı: m² cinsinden
- Tıklamalı süreç takibi (sıralı):
  1. Tespit Tutanağı
  2. Komisyona İntikal
  3. Komisyon Kararı
  4. 3091 — Kaymakamlık/Valilik (15 gün sayacı, progress bar)
  5. 3091 Sonucu
  6. 2886/75 — Jandarma/Kaymakamlık
  7. Men-i Müdahale ve Kal Davası
  8. Suç Duyurusu
  9. Eski Hale Getirme
  10. Tazminat Davası
  11. Sonuç/Kapatma
- Her adımda belge yükleme (opsiyonel), açıklama zorunlu
- Dosyalar sekmesi: tüm belgeler listelenir, tamamlanan adımlara ek belge yüklenebilir
- KML: işgal + mera sınırı üst üste, farklı renkler
- Harman/sıvat/eğrek niteliğinde mera → suç duyurusu otomatik uyarısı
- Dosya adı formatı: `ISGAL-[sistem_no]-[DDMMYYYY]-[adim-tipi]-[sira].uzanti`
- Raporlar:
  - Tekil işgal: HTML/PDF + Word
  - Tüm işgaller: HTML/PDF + Excel
- Liste: süreç adımına ve duruma göre filtreleme, 3091 süre uyarıları

**API:**
```
GET    /api/isgal/istatistik
GET    /api/isgal/rapor             # HTML/PDF tüm liste
GET    /api/isgal/rapor/excel       # Excel tüm liste
GET    /api/isgal
POST   /api/isgal
GET    /api/isgal/:id
PUT    /api/isgal/:id
DELETE /api/isgal/:id
GET    /api/isgal/:id/rapor         # HTML/PDF tekil
GET    /api/isgal/:id/rapor/word    # Word tekil
POST   /api/isgal/:id/adim          # Süreç adımı tamamla (belge opsiyonel)
POST   /api/isgal/:id/adim-dosya    # Tamamlanan adıma ek dosya
POST   /api/isgal/:id/kml
GET    /api/isgal/:id/kml/:kmlId
```

---

### BBHB Hesaplayıcı (`/bbhb/`)
Büyükbaş Hayvan Birimi hesaplama aracı.

**Özellikler:**
- 16 hayvan türü, katsayılarıyla BBHB hesaplama
- Manuel giriş veya XLS dosya yükleme (Türkvet formatı)
- Hesaplama geçmişi, raporlar (Excel, PDF, Word)
- Sekmeli yapı: Hesapla | Yükle | Geçmiş | Raporlar

---

### Mevzuat (`/mevzuat/`)
Kanun, yönetmelik, tebliğ ve diğer mevzuatların kayıt ve takip modülü.

**Özellikler:**
- Türe göre sekmeli liste: Kanun / Yönetmelik / Tebliğ / Genelge / Yönerge / Karar / Diğer
- 4 ekleme yöntemi:
  1. **PDF yükle** → Drive'a kaydedilir, sayfa içinde iframe ile görüntülenir
  2. **Metin yapıştır** → doğrudan metin girişi
  3. **Harici bağlantı** → URL kaydedilir
  4. **mevzuat.gov.tr** → URL girilir, içerik otomatik çekilir
- Günlük 04:00 cron job: mevzuat.gov.tr bağlantılı mevzuatlar kontrol edilir, değişiklik varsa arşivlenir
- Sürüm geçmişi: her değişiklik arşivlenir, eski sürümler görüntülenebilir
- Manuel yenile: anlık güncelleme kontrolü
- Ana sayfada güncelleme uyarısı

**API:**
```
GET    /api/mevzuat/istatistik
GET    /api/mevzuat
POST   /api/mevzuat
GET    /api/mevzuat/:id
PUT    /api/mevzuat/:id
DELETE /api/mevzuat/:id
GET    /api/mevzuat/:id/pdf         # PDF proxy (Drive'dan)
POST   /api/mevzuat/:id/yenile      # Manuel güncelleme kontrolü
POST   /api/mevzuat/:id/onayla      # Güncelleme bildirimini onayla
```

---

### Ayarlar (`/ayarlar/`)
Şifre korumalı sistem ayarları (varsayılan: 123456).

**Sekmeler:**
- **Google Drive:** OAuth2 veya Service Account bağlantısı
- **Dosya Kategorileri:** özelleştirilebilir kategori listesi
- **Not Renkleri:** not renk tanımları
- **Toprak Sınıfları:** I-VIII, tanımlarıyla
- **Yağış Kuşakları:** 81 il, EK-2
- **Otlatma Verim Tabloları:** EK-1, 3 tablo
- **İdari Yönetim:** il/ilçe/mahalle ara, düzenle, sil, ekle, öncelik sıralaması

---

## Sidebar Yapısı

```
Modüller
  └─ Mera
  └─ İşgal

Araçlar
  └─ BBHB Hesaplayıcı
  └─ Mevzuat

Sistem
  └─ Ayarlar
```

---

## Deployment

### Ortam Değişkenleri (Coolify)
```
MONGO_USER=misadmin
MONGO_PASS=...
MONGO_DB=misdb
JWT_SECRET=...
AYARLAR_SIFRE=123456
NODE_ENV=production
```

### Docker Compose Servisleri
| Servis | Port | Açıklama |
|---|---|---|
| mongo | 27017 (internal) | MongoDB 7 |
| backend | 5000 (internal) | Node.js API |
| frontend | 80 | Nginx static + /api/ proxy |

### Nginx Proxy
`/api/` → `backend:5000` olarak yönlendirilir.

### İdari Veri
İlk başlangıçta `data/Il-ilce-Semt-Mahalle-PostaKodu.xml` otomatik yüklenir (~30-60 sn, 47.649 mahalle).

### Frontend Yeniden Başlatma
```bash
# Coolify terminal (frontend container)
nginx -s reload
```

---

## Google Drive Kurulumu

**OAuth2 (önerilen):**
1. Google Cloud Console → OAuth 2.0 Desktop App JSON indir
2. Ayarlar → Drive → JSON Yükle → Yetkilendir
3. Google sayfasında onay ver → kodu kopyala → yapıştır

**Service Account:**
- Shared Drive gerektirir (normal Drive'da kota hatası)

---

## Cron Jobs

| Zamanlama | İşlem |
|---|---|
| Her gün 04:00 (İstanbul) | mevzuat.gov.tr bağlantılı mevzuatları kontrol et |

---

## Versiyon

**v1.7.0** — Mevzuat modülü, sidebar yeniden yapılandırma, işgal rapor (Excel/Word), mülkiyet bilgileri
