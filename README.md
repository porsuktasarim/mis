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
| Raporlama | ExcelJS, docx |

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

## Modüller

### Mera (`/mera/`)
Mera parsellerinin kayıt ve takip modülü.

**Özellikler:**
- İl/ilçe/mahalle filtreli liste (47.649 mahalle, plaka sırasına göre)
- Parsel detayları: nitelik, vasıf, toprak sınıfı, tapu alanı, kadastral alan
- Mülkiyet bilgileri: cilt/sayfa/kayıt durumu, malik, pay/payda, şerhler
- KML/KMZ yükleme → Google Drive'a kaydedilir, Leaflet+OpenStreetMap ile harita
- Vasıf belgesi (1 yıl) ve tahsis belgesi (5 yıl) takibi → süresi yaklaşınca uyarı
- Otlatma kapasitesi: EK-1 tabloları üzerinden BBHB hesaplama
- Renkli notlar, dosya yükleme, dosya-not ilişkilendirme
- PDF raporu (çok sayfalı, her sayfada başlık)
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
GET    /api/mera/:id/kml
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
Mera parseline yapılan tecavüz/işgal kayıt ve takip modülü. 4342, 3091 ve 2886 sayılı kanunlar kapsamında süreç yönetimi.

**Özellikler:**
- İşgal no: `ISG-YY-NNNN` formatı (sistem), kullanıcı no eklenebilir
- İşgal türü: Tarla İşgali / Yapılaşma / Yol-Hafriyat (açıklama zorunlu)
- Tıklamalı süreç takibi:
  1. Tespit Tutanağı
  2. Komisyona İntikal
  3. Komisyon Kararı
  4. 3091 — Kaymakamlık/Valilik (15 gün sayacı)
  5. 3091 Sonucu
  6. 2886/75 — Jandarma/Kaymakamlık
  7. Men-i Müdahale ve Kal Davası
  8. Suç Duyurusu
  9. Eski Hale Getirme
  10. Tazminat Davası
  11. Sonuç/Kapatma
- Her adımda belge yükleme (opsiyonel), açıklama zorunlu
- `aktif_adim` yoksa → ilk tamamlanmamış adım otomatik aktif
- Dosyalar sekmesi: tamamlanan adımlara ek belge yüklenebilir
- KML: işgal + mera sınırı üst üste, farklı renkler
- Harman/sıvat/eğrek → suç duyurusu otomatik uyarısı
- Dosya adı: `ISGAL-[sistem_no]-[DDMMYYYY]-[adim-tipi]-[sira].uzanti`
- Raporlar: tekil HTML/PDF + Word, tüm liste HTML/PDF + Excel
- Süreç adımı ve duruma göre filtreleme, 3091 süre uyarıları

**API:**
```
GET    /api/isgal/istatistik
GET    /api/isgal/rapor
GET    /api/isgal/rapor/excel
GET    /api/isgal
POST   /api/isgal
GET    /api/isgal/:id
PUT    /api/isgal/:id
DELETE /api/isgal/:id
GET    /api/isgal/:id/rapor
GET    /api/isgal/:id/rapor/word
POST   /api/isgal/:id/adim
POST   /api/isgal/:id/adim-dosya
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
- Türe göre sekmeli liste: Kanun / Yönetmelik / Tebliğ / Genelge / Yönerge / Karar / Diğer / 📝 Notlar
- 4 ekleme yöntemi:
  1. PDF yükle → Drive'a kaydedilir, sayfa içinde iframe ile görüntülenir
  2. Metin yapıştır
  3. Harici bağlantı
  4. mevzuat.gov.tr URL → `bedesten.adalet.gov.tr` API ile içerik otomatik çekilir
- İçinde kelime/kelime grubu arama (metin ve notlarda)
- Not ekleme: renkli, madde referanslı notlar; tüm notlar "Notlar" sekmesinde
- Günlük 04:00 cron: mevzuat.gov.tr bağlantılı mevzuatlar kontrol, değişiklik arşivlenir
- Sürüm geçmişi, manuel yenile, güncelleme onaylama
- Ana sayfada güncelleme uyarısı

**mevzuat.gov.tr URL formatı:**
```
https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=4342&MevzuatTur=1&MevzuatTertip=5
```
Parametreler: `MevzuatNo`=kanun no, `MevzuatTur`=1(Kanun) 4(Yönetmelik) 7(Tebliğ)

**API:**
```
GET    /api/mevzuat/istatistik
GET    /api/mevzuat/notlar
GET    /api/mevzuat
POST   /api/mevzuat
GET    /api/mevzuat/:id
PUT    /api/mevzuat/:id
DELETE /api/mevzuat/:id
GET    /api/mevzuat/:id/pdf
GET    /api/mevzuat/:id/ara?kelime=...
POST   /api/mevzuat/:id/yenile
POST   /api/mevzuat/:id/onayla
POST   /api/mevzuat/:id/notlar
PUT    /api/mevzuat/:id/notlar/:notId
DELETE /api/mevzuat/:id/notlar/:notId
```

---

### Ayarlar (`/ayarlar/`)
Şifre korumalı sistem ayarları (varsayılan: 123456).

**Sekmeler:**
- **Google Drive:** OAuth2 veya Service Account bağlantısı
- **Dosya Kategorileri:** özelleştirilebilir kategori ve ikon listesi
- **Not Renkleri:** not renk tanımları
- **Toprak Sınıfları:** I-VIII, tanımlarıyla
- **Yağış Kuşakları:** 81 il, EK-2
- **Otlatma Verim Tabloları:** EK-1, 3 tablo
- **İdari Yönetim:** il/ilçe/mahalle ara, düzenle, sil, ekle, öncelik sıralaması

---

## Google Drive Kurulumu (OAuth2)

1. [Google Cloud Console](https://console.cloud.google.com/) → Yeni proje oluştur
2. **APIs & Services → OAuth consent screen** → External → App adı gir → Kaydet
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Desktop app**
   - İndir: `client_secret_xxx.json`
4. **APIs & Services → Library → Google Drive API → Enable**
5. MİS Ayarlar → Drive → **JSON Yükle** → indirilen dosyayı seç
6. **Yetkilendir** butonuna tıkla → Google sayfası açılır
7. Hesabı seç → İzin ver → Gösterilen kodu kopyala
8. MİS'e yapıştır → **Kaydet**

> **Not:** Service Account ile normal Drive'da "storage quota" hatası alınır. Shared Drive gerektirir. OAuth2 önerilir.

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

### Frontend Yeniden Başlatma
```bash
# Coolify terminal (frontend container)
nginx -s reload
```

### İdari Veri
İlk başlangıçta `data/Il-ilce-Semt-Mahalle-PostaKodu.xml` otomatik yüklenir (~30-60 sn, 47.649 mahalle).

---

## Cron Jobs

| Zamanlama | İşlem |
|---|---|
| Her gün 04:00 (İstanbul) | mevzuat.gov.tr bağlantılı mevzuatları kontrol et |

---

## Versiyon Geçmişi

| Versiyon | Değişiklik |
|---|---|
| v1.7.1 | Mevzuat: not ekleme, içinde arama, notlar sekmesi |
| v1.7.0 | Mevzuat modülü, sidebar yeniden yapılandırma |
| v1.6.2 | İşgal: süreç düzeltme, belge yükleme, Excel/Word rapor |
| v1.6.0 | İşgal modülü |
| v1.5.3 | Mülkiyet bilgileri, istatistik, PDF rapor |
| v1.0.0 | İlk yayın: Mera, BBHB, Ayarlar |

**Güncel: v1.7.1**
