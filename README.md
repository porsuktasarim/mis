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

**Canlı URL:** `https://mis.pors.uk`  
**Repo:** `https://github.com/porsuktasarim/mis.git`

---

## Proje Yapısı

```
mis-app/
├── docker-compose.yml / .env
├── backend/
│   ├── server.js
│   ├── config/db.js
│   ├── middleware/errorHandler.js
│   ├── data/Il-ilce-Semt-Mahalle-PostaKodu.xml
│   └── modules/
│       ├── bbhb/          BBHB Hesaplayıcı
│       ├── bbhb-yukle/    Toplu XLS yükleme
│       ├── mera/          Mera modülü
│       ├── isgal/         İşgal modülü
│       ├── mevzuat/       Mevzuat modülü
│       ├── ehgb/          EHGB Hesaplama modülü
│       ├── ayarlar/       Sistem ayarları
│       └── idari/         İl/ilçe/mahalle
└── frontend/public/
    ├── index.html / css/main.css / js/sidebar.js
    ├── mera/ / isgal/ / bbhb/ / mevzuat/ / ehgb/ / ayarlar/
```

---

## Sidebar Yapısı

```
Modüller:  Mera | İşgal
Araçlar:   BBHB Hesaplayıcı | EHGB Hesaplama | Mevzuat
Sistem:    Ayarlar
```

---

## Modüller

### Mera (`/mera/`)
- İl/ilçe/mahalle filtreli liste (47.649 mahalle)
- Parsel, mülkiyet, vasıf, toprak sınıfı bilgileri
- KML/KMZ yükleme → Leaflet harita
- Vasıf (1 yıl) ve tahsis belgesi (5 yıl) süresi takibi
- Otlatma kapasitesi (BBHB), renkli notlar, dosya yükleme
- PDF raporu

**API:** `/api/mera` — CRUD, `/istatistik`, `/:id/kml`, `/:id/notlar`, `/:id/dosyalar`, `/:id/rapor/pdf`

---

### İşgal (`/isgal/`)
- İşgal no: `ISG-YY-NNNN` otomatik
- 11 adımlı süreç: Tespit → Komisyon → 3091 (15 gün sayacı) → 2886/75 → Dava → Suç Duyurusu → Eski Hale → Tazminat → Sonuç
- Aktif adım yoksa → ilk tamamlanmamış adım otomatik set edilir
- Her adımda belge yükleme, açıklama
- KML: işgal + mera üst üste
- **Eski Hale Getirme** adımında EHGB Hesapla butonu
- **EHGB sekmesi:** işgale bağlı EHGB hesapları, kesinleşmişse ıslak imza uyarısı
- **Sonuç/Kapatma** tamamlandığında tüm adım dosyaları bağlı mera parseline otomatik kopyalanır
- Dosya adı formatı: `ISGAL-[no]-[YYYYMMDD]-[adim]-[sira].uzanti`
- Raporlar: HTML/PDF/Word (tekil), Excel (liste)

**API:** `/api/isgal` — CRUD, `/istatistik`, `/:id/adim`, `/:id/adim-dosya`, `/:id/kml`, `/:id/rapor`, `/rapor/excel`

---

### BBHB Hesaplayıcı (`/bbhb/`)
- 17 hayvan türü (kültür inek, kültür melezi, yerli, koyun, keçi, kuzu-oğlak, manda, boğa, öküz, at, eşek, katır)
- Çiftçi adı soyadı alanı — geçmişte ve raporlarda gösterilir
- Hesaplama geçmişi, Excel/PDF/Word raporları
- XLS dosya yükleme (Türkvet formatı)

**API:** `/api/bbhb` — `/turler`, `/kaydet`, `/gecmis`, `/:id/rapor/excel|pdf|word`

---

### EHGB Hesaplama (`/ehgb/`)
**Eski Haline Getirme Bedeli** hesaplama modülü. 4342 sayılı Mera Kanunu.

- Hesap no: `EHGB-YY-NNNN` (yıla göre otomatik, unique)
- Alan tipleri: **A** Tarla, **B** Hafriyat, **C** Asfalt/Beton + tel örgü + döküm uzaklığı
- Canlı hesaplama (alan girilince anında)
- Kalem kalem detay: işçilik, hafriyat (işçilik+nakliye+depolama sahası), tohum, gübre
- İşgal seçici (opsiyonel bağlantı)
- **Hazırlayanlar seçici:** 2–6 personel, checkbox ile seçim
- Yıllık parametreler **Ayarlar → EHGB** sekmesinden güncellenir

**Hesaplama Formülleri:**
- İşçilik: 7 işlem × TL/da × toplam alan (A+B+C)
- Hafriyat: yükleme işçiliği + nakliye (km×2yön) + depolama sahası girişi
  - Yükleme: `(araç_kg − 1200) / 60 × 11` TL/sefer + baz 162 TL
  - Nakliye: `sefer × nakliye_km × araç_kap × 2 × uzaklık`
  - Depolama: `sefer × 5771 TL/araç`
- Tohum: 7 tür karışımı × 12 kg/da × alan
- Gübre: amonyum+kompoze 2 yıl, hayvan gübresi 1 yıl × alan

**Rapor (2 sayfa):**
- 1. Sayfa: hesaplamalar + personel imzaları (titır: Dr., Doç. Dr., Prof. Dr. adın önüne gelir)
- 2. Sayfa: yasal dayanak, alan tipleri, formüller, birim fiyat tablosu (2 sütun)
- Tarih alanı elle doldurulacak şekilde boş

**API:** `/api/ehgb` — CRUD, `/:id/rapor`, `POST /hesapla` (canlı), `/parametreler`

---

### Mevzuat (`/mevzuat/`)
- 4 ekleme yöntemi: PDF, metin, link, mevzuat.gov.tr URL
- mevzuat.gov.tr: `bedesten.adalet.gov.tr` API ile içerik otomatik çekilir
- Türe göre sekmeler + "Notlar" sekmesi
- Metin ve notlarda kelime/kelime grubu arama
- Renkli notlar, madde referansı
- Günlük 04:00 cron: değişiklik takibi

**API:** `/api/mevzuat` — CRUD, `/notlar`, `/:id/ara`, `/:id/yenile`, `/:id/notlar`

---

### Ayarlar (`/ayarlar/`)
Şifre korumalı (varsayılan: `123456`).

| Sekme | İçerik |
|---|---|
| Google Drive | OAuth2 bağlantısı |
| Dosya Kategorileri | Bootstrap Icons seçicili kategoriler |
| Not Renkleri | Renk tanımları |
| Toprak Sınıfları | I-VIII |
| Yağış Kuşakları | 81 il |
| Verim Tabloları | EK-1 |
| İdari Yönetim | İl/ilçe/mahalle |
| Personel | Teknik ekipler (ad+yıl+üyeler), Komisyonlar (yıl+üyeler), Kullanıcılar/Teknik Personel |
| EHGB | Yıllık birim fiyat parametreleri |
| Güvenlik | Admin şifre değiştirme |

**Personel → Ünvan seçici:** Ziraat Teknikeri / Mühendisi / Yüksek Mühendisi / Doktor / Doçent Doktor / Profesör Doktor. Dr., Doç. Dr., Prof. Dr. titırları adın önüne otomatik eklenir.

**Personel → Kullanıcılar:** EHGB raporlarında "Hazırlayanlar" imzası olarak kullanılır.

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

**Tarih formatı:** Tüm dosya adlarında `YYYYMMDD`

---

## Cron Jobs

| Zamanlama | İşlem |
|---|---|
| Her gün 04:00 (UTC) | mevzuat.gov.tr değişiklik kontrolü |

---

## Versiyon Geçmişi

| Versiyon | Değişiklik |
|---|---|
| v1.8.8 | Ayarlar personel kaydetme düzeltmesi (controller izinli alan güncellemesi) |
| v1.8.7 | Personel ünvan dropdown, işgal EHGB sekmesi, sonuç→mera dosya kopyalama, EHGB parametreler sekmesi kaldırıldı |
| v1.8.6 | EHGB hesap no (EHGB-YY-NNNN), personel seçici, tıklanabilir liste, rapor düzeltme |
| v1.8.5 | EHGB rapor 2 sayfa düzeltme, ayarlar kullanıcı bölümü |
| v1.8.4 | EHGB rapor 2 sayfa (hesaplar+imzalar / açıklamalar+formüller) |
| v1.8.3 | EHGB: ayarlar EHGB parametreler sekmesi, işgal seçici, rapor butonu |
| v1.8.2 | EHGB hesaplama motoru ve detay formu (canlı hesaplama) |
| v1.8.1 | BBHB çiftçi adı alanı, rapor güncelleme |
| v1.8.0 | EHGB modülü iskelet |
| v1.7.3 | Ayarlar personel sekmesi (teknik ekip, komisyon, yıl) |
| v1.7.2 | README, Drive OAuth2 rehberi, kategori ikon seçici |
| v1.7.1 | Mevzuat: not ekleme, içinde arama, notlar sekmesi |
| v1.7.0 | Mevzuat modülü |
| v1.6.x | İşgal: süreç, belge yükleme, raporlar |
| v1.0.0 | İlk yayın: Mera, BBHB, Ayarlar |

**Güncel: v1.8.8**
