# MİS — Mera İzleme Sistemi

Tarım ve Orman Bakanlığı İl/İlçe Müdürlükleri için geliştirilmiş mera parsel yönetim sistemi.

## Teknoloji

| Katman | Teknoloji |
|---|---|
| Backend | Node.js, Express.js, Mongoose |
| Veritabanı | MongoDB 7 |
| Frontend | Bootstrap 5, Vanilla JS, Leaflet.js |
| Dosya Depolama | Google Drive (OAuth2) |
| Altyapı | Docker Compose, Coolify |
| Zamanlama | node-cron |
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
│   ├── server.js
│   ├── config/db.js
│   ├── middleware/errorHandler.js
│   ├── data/Il-ilce-Semt-Mahalle-PostaKodu.xml
│   └── modules/
│       ├── bbhb/
│       ├── bbhb-yukle/
│       ├── mera/
│       ├── ayarlar/
│       ├── idari/
│       ├── isgal/
│       ├── mevzuat/
│       └── ehgb/
└── frontend/
    ├── nginx.conf
    └── public/
        ├── index.html
        ├── css/main.css
        ├── js/sidebar.js
        ├── bbhb/
        ├── mera/
        ├── isgal/
        ├── mevzuat/
        ├── ehgb/
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
  └─ EHGB Hesaplama
  └─ Mevzuat

Sistem
  └─ Ayarlar
```

---

## Modüller

### Mera (`/mera/`)
Mera parsellerinin kayıt ve takip modülü.

**Özellikler:**
- İl/ilçe/mahalle filtreli liste (47.649 mahalle)
- Parsel detayları: nitelik, vasıf, toprak sınıfı, tapu/kadastral alan
- Mülkiyet bilgileri: cilt/sayfa/kayıt, malik, pay/payda, şerhler
- KML/KMZ yükleme → Drive'a kaydedilir, Leaflet haritada gösterilir
- Vasıf belgesi (1 yıl) ve tahsis belgesi (5 yıl) takibi → uyarı
- Otlatma kapasitesi (BBHB), renkli notlar, dosya yükleme
- PDF raporu (çok sayfalı)

**API:** `GET|POST /api/mera`, `GET|PUT|DELETE /api/mera/:id`, `/api/mera/istatistik`, `/:id/kml`, `/:id/notlar`, `/:id/dosyalar`, `/:id/rapor/pdf`

---

### İşgal (`/isgal/`)
Mera parseline yapılan işgal kayıt ve süreç takip modülü.

**Özellikler:**
- İşgal no: `ISG-YY-NNNN` (otomatik)
- İşgal türü: Tarla / Yapılaşma / Yol-Hafriyat
- 11 adımlı tıklamalı süreç takibi: Tespit → Komisyon → 3091 (15 gün sayacı) → 2886/75 → Dava → Suç Duyurusu → Eski Hale → Tazminat → Sonuç
- Her adımda belge yükleme, açıklama
- `aktif_adim` yoksa → ilk tamamlanmamış adım otomatik aktif
- KML: işgal + mera üst üste, farklı renkler
- "Eski Hale Getirme" adımında **EHGB Hesapla** bağlantısı
- Dosya adı formatı: `ISGAL-[no]-[YYYYMMDD]-[adim]-[sira].uzanti`
- Raporlar: tekil HTML/PDF/Word, tüm liste HTML/PDF/Excel

**API:** `GET|POST /api/isgal`, `GET|PUT|DELETE /api/isgal/:id`, `/istatistik`, `/:id/adim`, `/:id/adim-dosya`, `/:id/kml`, `/:id/rapor`, `/:id/rapor/word`, `/rapor/excel`

---

### BBHB Hesaplayıcı (`/bbhb/`)
Büyükbaş Hayvan Birimi hesaplama aracı.

**Özellikler:**
- 17 hayvan türü (kültür inek, kültür melezi, yerli, koyun, keçi, manda, at, eşek, katır vb.)
- Çiftçi adı soyadı alanı
- Hesaplama geçmişi, raporlar (Excel, PDF, Word)
- XLS dosya yükleme (Türkvet formatı)
- Geçmiş listesinde çiftçi adı sütunu

**API:** `GET /api/bbhb/turler`, `GET|DELETE /api/bbhb/gecmis`, `POST /api/bbhb/kaydet`, `GET /api/bbhb/:id/rapor/excel|pdf|word`

---

### EHGB Hesaplama (`/ehgb/`)
Eski Haline Getirme Bedeli hesaplama modülü. 4342 sayılı Mera Kanunu kapsamında.

**Özellikler:**
- Alan tipleri: A (tarla), B (inşaat/hafriyat), C (asfalt/beton), tel örgü, döküm uzaklığı
- Canlı hesaplama (400ms debounce) — alan girilince anında sonuç
- Kalem kalem detaylı breakdown: işçilik, hafriyat (işçilik+nakliye+depolama), tohum, gübre
- İşgalden yönlendirme: parsel ve işgalci bilgileri otomatik aktarılır
- İşgal seçici (opsiyonel bağlantı)
- Yıllık parametreler Ayarlar'dan güncellenir
- **2 sayfalı rapor:**
  - 1. Sayfa: hesaplamalar + teknik personel imzaları
  - 2. Sayfa: yasal dayanak, alan tipi açıklamaları, formüller, birim fiyat tablosu

**Hesaplama Formülleri:**
- İşçilik: 7 işlem × TL/da × toplam alan (A+B+C)
- Hafriyat: yükleme işçiliği + nakliye (km×2yön) + depolama sahası girişi
- Tohum: 7 tür karışımı × 12 kg/da × alan
- Gübre: amonyum+kompoze 2 yıl, hayvan gübresi 1 yıl × alan

**API:** `GET|POST /api/ehgb`, `GET|PUT|DELETE /api/ehgb/:id`, `/:id/rapor`, `POST /api/ehgb/hesapla` (canlı), `/parametreler` (CRUD)

---

### Mevzuat (`/mevzuat/`)
Kanun, yönetmelik ve diğer mevzuatların kayıt ve takip modülü.

**Özellikler:**
- 4 ekleme yöntemi: PDF, metin, harici link, mevzuat.gov.tr URL
- mevzuat.gov.tr: `bedesten.adalet.gov.tr` API ile içerik otomatik çekilir
- Türe göre sekmeler: Kanun / Yönetmelik / Tebliğ / Genelge / Yönerge / Karar / Diğer / Notlar
- Metin içinde kelime/kelime grubu arama (notlar dahil)
- Renkli notlar, madde referansı; tüm notlar "Notlar" sekmesinde listelenir
- Günlük 04:00 cron: değişiklik takibi, sürüm arşivi
- Ana sayfada güncelleme uyarısı

**API:** `GET|POST /api/mevzuat`, `GET|PUT|DELETE /api/mevzuat/:id`, `/istatistik`, `/notlar`, `/:id/ara`, `/:id/yenile`, `/:id/onayla`, `/:id/notlar`

---

### Ayarlar (`/ayarlar/`)
Şifre korumalı sistem ayarları (varsayılan: `123456`).

**Sekmeler:**

| Sekme | İçerik |
|---|---|
| Google Drive | OAuth2 bağlantısı (hesap ekle, yetkilendir) |
| Dosya Kategorileri | Bootstrap Icons seçicili, özelleştirilebilir kategoriler |
| Not Renkleri | Not renk tanımları |
| Toprak Sınıfları | I-VIII sınıf tanımları |
| Yağış Kuşakları | 81 il, EK-2 |
| Verim Tabloları | EK-1, 3 tablo |
| İdari Yönetim | İl/ilçe/mahalle ara, düzenle, ekle, sil |
| Personel | Teknik ekipler (ad+yıl+üyeler), İl Mera Komisyonları (yıl+üyeler), Kullanıcılar (yakında) |
| EHGB | Yıllık birim fiyat parametreleri (işçilik, hafriyat, tohum, gübre) |
| Güvenlik | Admin şifre değiştirme |

**Personel → Teknik Ekip:** EHGB raporunda otomatik imza olarak kullanılır.

---

## Google Drive Kurulumu (OAuth2)

1. [console.cloud.google.com](https://console.cloud.google.com) → Yeni proje
2. APIs & Services → Library → **Google Drive API** → Enable
3. APIs & Services → OAuth consent screen → External → Kaydet
4. Credentials → **+ Create Credentials → OAuth client ID** → Desktop app → JSON indir
5. MİS Ayarlar → Drive → **Hesap Ekle** → JSON içeriğini yapıştır → Kaydet
6. **Yetkilendir** → Google sayfasında izin ver → Kodu kopyala → MİS'e yapıştır

> Service Account normal Drive'da "storage quota" hatası verir. OAuth2 kullanın.

---

## Deployment

### Ortam Değişkenleri
```
MONGO_USER=misadmin
MONGO_PASS=...
MONGO_DB=misdb
JWT_SECRET=...
AYARLAR_SIFRE=123456
NODE_ENV=production
```

### Docker Compose Servisleri
| Servis | Açıklama |
|---|---|
| mongo | MongoDB 7 (internal) |
| backend | Node.js 5000 (internal) |
| frontend | Nginx 80 — static + `/api/` proxy |

### Tarih Formatı
Tüm dosya adlarında tarih **YYYYMMDD** formatında (ör: `20260615`).

---

## Cron Jobs

| Zamanlama | İşlem |
|---|---|
| Her gün 04:00 (UTC) | mevzuat.gov.tr bağlantılı mevzuatları kontrol et |

---

## Versiyon Geçmişi

| Versiyon | Değişiklik |
|---|---|
| v1.8.4 | EHGB rapor 2 sayfa (hesaplar+imzalar / açıklamalar+formüller) |
| v1.8.3 | EHGB: ayarlar EHGB parametreler sekmesi, işgal seçici, rapor butonu |
| v1.8.2 | EHGB hesaplama motoru ve detay formu (canlı hesaplama) |
| v1.8.1 | BBHB çiftçi adı alanı, rapor güncelleme |
| v1.8.0 | EHGB modülü iskelet |
| v1.7.3 | Ayarlar personel sekmesi (teknik ekip, komisyon, yıl) |
| v1.7.2 | README güncelle, Drive OAuth2 rehberi, kategori ikon seçici |
| v1.7.1 | Mevzuat: not ekleme, içinde arama, notlar sekmesi |
| v1.7.0 | Mevzuat modülü, sidebar yeniden yapılandırma |
| v1.6.2 | İşgal: süreç düzeltme, belge yükleme, Excel/Word rapor |
| v1.6.0 | İşgal modülü |
| v1.5.x | Mülkiyet bilgileri, istatistik, PDF rapor |
| v1.0.0 | İlk yayın: Mera, BBHB, Ayarlar |

**Güncel: v1.8.4**
