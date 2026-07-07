/**
 * Ek-4/ab Raporu
 * Tespit ve Tahdit Çalışmalarına Esas Olan
 * Çiftçi Aile, Geçim Kaynağı ve Hayvan Varlığı Bildirim Cetveli
 */
const ExcelJS = require('exceljs');

// 16 hayvan sütunu
const EK4B_KOLONLAR = [
  { key: 'Kültür İnek',             kisa: 'İnek',        grup: 'Kültür Irkı',    grupSpan: 2 },
  { key: 'Kültür Dana-Düve',        kisa: 'Dana-Düve',   grup: 'Kültür Irkı',    grupSpan: 0 },
  { key: 'Kültür Melezi İnek',      kisa: 'İnek',        grup: 'Kültür Melezi',  grupSpan: 2 },
  { key: 'Kültür Melezi Dana-Düve', kisa: 'Dana-Düve',   grup: 'Kültür Melezi',  grupSpan: 0 },
  { key: 'Yerli İnek',              kisa: 'İnek',        grup: 'Yerli Irk',      grupSpan: 2 },
  { key: 'Yerli Dana-Düve',         kisa: 'Dana-Düve',   grup: 'Yerli Irk',      grupSpan: 0 },
  { key: 'Boğa',                    kisa: 'Boğa',        grup: 'Büyükbaş Diğer', grupSpan: 2 },
  { key: 'Öküz',                    kisa: 'Öküz',        grup: 'Büyükbaş Diğer', grupSpan: 0 },
  { key: 'Manda Erkek',             kisa: 'Erkek',       grup: 'Manda',          grupSpan: 2 },
  { key: 'Manda Dişi',              kisa: 'Dişi',        grup: 'Manda',          grupSpan: 0 },
  { key: 'Koyun',                   kisa: 'Koyun',       grup: 'Küçükbaş',       grupSpan: 3 },
  { key: 'Keçi',                    kisa: 'Keçi',        grup: 'Küçükbaş',       grupSpan: 0 },
  { key: 'Kuzu/Oğlak',             kisa: 'Kuzu/Oğlak',  grup: 'Küçükbaş',       grupSpan: 0 },
  { key: 'At',                      kisa: 'At',          grup: 'Tek Tırnaklı',   grupSpan: 3 },
  { key: 'Katır',                   kisa: 'Katır',       grup: 'Tek Tırnaklı',   grupSpan: 0 },
  { key: 'Eşek',                    kisa: 'Eşek',        grup: 'Tek Tırnaklı',   grupSpan: 0 },
];

// Tur adı → kolon key eşleştirme (eski ve yeni adlar)
const KAT_KEY = {
  'Kültür İnek': 'Kültür İnek',
  'Kültür Dana-Düve': 'Kültür Dana-Düve',
  'Kültür Melezi İnek': 'Kültür Melezi İnek',
  'Kültür Melezi Dana-Düve': 'Kültür Melezi Dana-Düve',
  'Yerli İnek': 'Yerli İnek',
  'Yerli Dana-Düve': 'Yerli Dana-Düve',
  'Boğa': 'Boğa', 'Öküz': 'Öküz',
  'Manda Erkek': 'Manda Erkek', 'Manda Dişi': 'Manda Dişi',
  'Koyun': 'Koyun', 'Keçi': 'Keçi', 'Kuzu/Oğlak': 'Kuzu/Oğlak',
  'At': 'At', 'Katır': 'Katır', 'Eşek': 'Eşek',
  // Eski adlar
  'Kültür ırkı süt ineği': 'Kültür İnek',
  'Dana-düve (kültür ırkı)': 'Kültür Dana-Düve',
  'Kültür melezi': 'Kültür Melezi İnek',
  'Dana-düve (kültür melezi)': 'Kültür Melezi Dana-Düve',
  'Yerli inek': 'Yerli İnek',
  'Dana-düve (yerli)': 'Yerli Dana-Düve',
  'Manda (erkek)': 'Manda Erkek',
  'Manda (dişi)': 'Manda Dişi',
  'Kuzu-oğlak': 'Kuzu/Oğlak',
};

const N_HAY   = EK4B_KOLONLAR.length; // 16
// A=Sıra B=AdSoyad C=Yem D=Sebze E=Hububat F=Tarım G=Hayvancılık
// H..W=hayvanlar X=ToplamHayvan Y=BBHB  → 25 sütun
const N_TOTAL = 1+1+3+2+N_HAY+1+1;

const col = (n) => {
  if (n <= 26) return String.fromCharCode(64+n);
  return String.fromCharCode(64+Math.floor((n-1)/26)) + String.fromCharCode(65+(n-1)%26);
};

const ek4abExcel = async (req, res, next) => {
  try {
    const Tahsis    = require('../tahsis/tahsis.model');
    const BBHBHesap = require('../bbhb/bbhb.model');
    const CksYukle  = require('../cks/cks.model');
    const Ayarlar   = require('../ayarlar/ayarlar.model');

    const ttt = await Tahsis.findById(req.params.id);
    if (!ttt) return res.status(404).json({ success:false, message:'Kayıt bulunamadı' });

    const { bbhb_id, cks_id } = req.body;
    const [bbhb, cks, ayarlar] = await Promise.all([
      bbhb_id ? BBHBHesap.findById(bbhb_id) : null,
      cks_id  ? CksYukle.findById(cks_id)   : null,
      Ayarlar.findOne().select('teknik_ekipler'),
    ]);

    // İşletmeci listesi
    const isletmeciler = bbhb
      ? (bbhb.isletmeciler?.length
          ? bbhb.isletmeciler
          : [{ sahip: bbhb.ciftci_ad||'–',
               kategoriler: Object.fromEntries((bbhb.hayvanlar||[]).filter(h=>h.adet>0).map(h=>[h.tur_adi,{adet:h.adet}])),
               toplam_bbhb: bbhb.toplam_bbhb }])
      : [];

    // ÇKS haritası
    const cksMap = {};
    if (cks?.kisiler) cks.kisiler.forEach(k => { cksMap[k.ad_soyad.toUpperCase().trim()] = k; });
    const uretimYili = cks?.uretim_yili || new Date().getFullYear();

    // Teknik ekip
    const ilce = ttt.ilce_ad||'';
    let teknikEkip = [];
    if (ayarlar?.teknik_ekipler?.length) {
      const ekip = ayarlar.teknik_ekipler.find(e=>e.uyeler?.some(u=>(u.kurum||'').includes(ilce)))
                || ayarlar.teknik_ekipler[ayarlar.teknik_ekipler.length-1];
      teknikEkip = ekip?.uyeler||[];
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'MİS';
    const ws = wb.addWorksheet('Ek-4ab');

    const G1='FF0F6E56', G2='FF1D9E75', WH='FFFFFFFF', LG='FFE1F5EE';
    const LAST = col(N_TOTAL);

    ws.columns = [
      {width:5},{width:28},{width:9},{width:9},{width:9},{width:7},{width:8},
      ...EK4B_KOLONLAR.map(()=>({width:7})),
      {width:9},{width:9},
    ];

    const sty = (cell, bg, color, bold, align) => {
      if (bg) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:bg}};
      cell.font={bold:!!bold,color:{argb:color||'FF000000'},size:9};
      cell.alignment={horizontal:align||'center',vertical:'middle',wrapText:true};
      const b={style:'thin',color:{argb:'FFCCCCCC'}};
      cell.border={top:b,bottom:b,left:b,right:b};
    };

    const mc = (r1,c1,r2,c2) => {
      const a=`${col(c1)}${r1}`, b=`${col(c2)}${r2}`;
      if(a!==b) try{ws.mergeCells(`${a}:${b}`);}catch(e){}
      return ws.getCell(a);
    };

    const il  = ttt.il_ad||bbhb?.il||cks?.il||'';
    const koy = ttt.mahalle_ad||cks?.koy||'';

    // Satır 1-2: Başlık
    const c1 = mc(1,1,2,N_TOTAL);
    c1.value='Tespit ve Tahdit Çalışmalarına Esas Olan Çiftçi Aile, Geçim Kaynağı ve Hayvan Varlığı Bildirim Cetveli';
    sty(c1,G1,WH,true,'center'); ws.getRow(1).height=30; ws.getRow(2).height=6;

    // Satır 3: Yer bilgisi
    mc(3,1,3,7); ws.getCell('A3').value=`İli: ${il}`; sty(ws.getCell('A3'),null,null,true,'left');
    mc(3,8,3,16); ws.getCell(col(8)+'3').value=`İlçesi: ${ilce}`; sty(ws.getCell(col(8)+'3'),null,null,true,'left');
    mc(3,17,3,N_TOTAL); ws.getCell(col(17)+'3').value=`Mahallesi/Köyü: ${koy}`; sty(ws.getCell(col(17)+'3'),null,null,true,'left');
    ws.getRow(3).height=16;

    // Satır 4-5: Üst başlıklar
    mc(4,1,8,1); ws.getCell('A4').value='Sıra\nNo'; sty(ws.getCell('A4'),G1,WH,true);
    mc(4,2,8,2); ws.getCell('B4').value='Adı Soyadı\n(Çiftçi Ailesi)'; sty(ws.getCell('B4'),G1,WH,true);

    mc(4,3,5,5); ws.getCell('C4').value='(Ek-4/a)\nÇİFTÇİ AİLE BİLDİRİM CETVELİ'; sty(ws.getCell('C4'),G2,WH,true);
    mc(4,6,5,7); ws.getCell('F4').value='(Ek-4/a)\nGEÇİM KAYNAĞI'; sty(ws.getCell('F4'),G2,WH,true);

    mc(4,8,5,7+N_HAY); ws.getCell('H4').value='(Ek-4/b)\nBÜYÜKBAŞ VE KÜÇÜKBAŞ HAYVAN VARLIĞI'; sty(ws.getCell('H4'),G2,WH,true);

    mc(4,8+N_HAY,8,8+N_HAY); ws.getCell(col(8+N_HAY)+'4').value='Toplam\nHayvan\nVarlığı'; sty(ws.getCell(col(8+N_HAY)+'4'),G1,WH,true);
    mc(4,9+N_HAY,8,9+N_HAY); ws.getCell(col(9+N_HAY)+'4').value='Toplam\nBBHB'; sty(ws.getCell(col(9+N_HAY)+'4'),G1,WH,true);
    ws.getRow(4).height=22;

    // Satır 6: Alt başlıklar (ekiliş ve geçim kaynağı)
    ws.getCell('C6').value='Yem Bitkisi\n(da)'; sty(ws.getCell('C6'),G2,WH,true);
    ws.getCell('D6').value='Sebze-Bağ\n(da)'; sty(ws.getCell('D6'),G2,WH,true);
    ws.getCell('E6').value='Hububat\n(da)'; sty(ws.getCell('E6'),G2,WH,true);
    mc(6,6,7,6); ws.getCell('F6').value='Tarım\n(X)'; sty(ws.getCell('F6'),G2,WH,true);
    mc(6,7,7,7); ws.getCell('G6').value='Hayvancılık\n(X)'; sty(ws.getCell('G6'),G2,WH,true);
    ws.getRow(6).height=28;

    // Satır 7: Hayvan grup başlıkları
    let hc=8;
    EK4B_KOLONLAR.forEach(k=>{
      if(k.grupSpan>0){
        const c2=mc(7,hc,7,hc+k.grupSpan-1);
        c2.value=k.grup; sty(c2,G2,WH,true);
      }
      hc++;
    });
    ws.getRow(7).height=16;

    // Satır 8: Hayvan cinsi
    EK4B_KOLONLAR.forEach((k,i)=>{
      const c=ws.getRow(8).getCell(8+i);
      c.value=k.kisa; sty(c,G2,WH,true);
    });
    ws.getRow(8).height=16;

    // Veri satırları
    const totals={yem:0,sebze:0,hububat:0,hayvan:0,bbhb:0};
    const hayTot={};
    EK4B_KOLONLAR.forEach(k=>{ hayTot[k.key]=0; });

    isletmeciler.forEach((ist,idx)=>{
      const rn=9+idx; const row=ws.getRow(rn); row.height=17;
      const bg=idx%2?'FFF5FAF7':null;

      const ck=cksMap[ist.sahip?.toUpperCase().trim()]||null;
      const yem=ck?.yem_bitkisi||0, sebze=ck?.sebze_bag||0, hububat=ck?.hububat||0;

      row.getCell(1).value=idx+1; sty(row.getCell(1),bg,null,false,'center');
      row.getCell(2).value=ist.sahip||'–'; sty(row.getCell(2),bg,null,false,'left');
      row.getCell(3).value=yem>0?yem:null; sty(row.getCell(3),bg,null,false,'center');
      row.getCell(4).value=sebze>0?sebze:null; sty(row.getCell(4),bg,null,false,'center');
      row.getCell(5).value=hububat>0?hububat:null; sty(row.getCell(5),bg,null,false,'center');
      row.getCell(6).value=(yem+sebze+hububat)>0?'X':null; sty(row.getCell(6),bg,null,false,'center');
      row.getCell(7).value=(ist.toplam_bbhb||0)>0?'X':null; sty(row.getCell(7),bg,null,false,'center');

      const kd=ist.kategoriler||{};
      let toplamH=0;
      EK4B_KOLONLAR.forEach((kolon,ki)=>{
        // Hem yeni hem eski ad ile arama
        let adet=0;
        const v=kd[kolon.key];
        if(v!=null) adet=v?.adet??v;
        if(!adet){
          for(const [eski,yeni] of Object.entries(KAT_KEY)){
            if(yeni===kolon.key&&kd[eski]!=null){ adet=kd[eski]?.adet??kd[eski]; break; }
          }
        }
        const n=parseInt(adet)||0;
        row.getCell(8+ki).value=n>0?n:null; sty(row.getCell(8+ki),bg,null,false,'center');
        if(n){hayTot[kolon.key]+=n; toplamH+=n;}
      });

      row.getCell(8+N_HAY).value=toplamH>0?toplamH:null; sty(row.getCell(8+N_HAY),bg,null,true,'center');
      const bv=ist.toplam_bbhb||0;
      row.getCell(9+N_HAY).value=bv>0?+bv.toFixed(2):null;
      row.getCell(9+N_HAY).numFmt='#,##0.00'; sty(row.getCell(9+N_HAY),bg,null,true,'right');

      totals.yem+=yem; totals.sebze+=sebze; totals.hububat+=hububat;
      totals.hayvan+=toplamH; totals.bbhb+=bv;
    });

    // Toplam satırı
    const tr=9+isletmeciler.length; const tRow=ws.getRow(tr); tRow.height=20;
    mc(tr,1,tr,2); ws.getCell(`A${tr}`).value='T O P L A M'; sty(ws.getCell(`A${tr}`),LG,null,true,'center');
    [[3,totals.yem,3],[4,totals.sebze,3],[5,totals.hububat,3]].forEach(([c,v,d])=>{
      ws.getCell(`${col(c)}${tr}`).value=v>0?+v.toFixed(d):null; sty(ws.getCell(`${col(c)}${tr}`),LG,null,true,'center');
    });
    ws.getCell(`F${tr}`).value=null; sty(ws.getCell(`F${tr}`),LG);
    ws.getCell(`G${tr}`).value=null; sty(ws.getCell(`G${tr}`),LG);
    EK4B_KOLONLAR.forEach((k,ki)=>{
      const v=hayTot[k.key]||0;
      ws.getCell(`${col(8+ki)}${tr}`).value=v>0?v:null; sty(ws.getCell(`${col(8+ki)}${tr}`),LG,null,true,'center');
    });
    ws.getCell(`${col(8+N_HAY)}${tr}`).value=totals.hayvan||null; sty(ws.getCell(`${col(8+N_HAY)}${tr}`),LG,null,true,'center');
    ws.getCell(`${col(9+N_HAY)}${tr}`).value=+totals.bbhb.toFixed(2); ws.getCell(`${col(9+N_HAY)}${tr}`).numFmt='#,##0.00'; sty(ws.getCell(`${col(9+N_HAY)}${tr}`),LG,null,true,'right');

    // Alt not
    const nr=tr+2; mc(nr,1,nr,N_TOTAL);
    ws.getCell(`A${nr}`).value=`Not: Yukarıdaki ekiliş verileri ${uretimYili} yılı ÇKS kayıtlarından alınmıştır.`;
    ws.getCell(`A${nr}`).font={italic:true,size:9,color:{argb:'FF666666'}};
    ws.getCell(`A${nr}`).alignment={wrapText:true}; ws.getRow(nr).height=20;

    // Teknik ekip imzaları
    if(teknikEkip.length>0){
      const iR=nr+2;
      mc(iR,1,iR,N_TOTAL); ws.getCell(`A${iR}`).value='TEKNİK EKİP İMZALARI';
      ws.getCell(`A${iR}`).font={bold:true,size:10,color:{argb:'FF0F6E56'}};
      ws.getCell(`A${iR}`).alignment={horizontal:'center'}; ws.getRow(iR).height=18;

      const adet=Math.min(teknikEkip.length,8);
      const bw=Math.floor(N_TOTAL/adet);
      teknikEkip.slice(0,adet).forEach((u,i)=>{
        const c1=1+i*bw, c2=i<adet-1?c1+bw-1:N_TOTAL;
        const adC=mc(iR+1,c1,iR+1,c2); adC.value=u.ad_soyad||'';
        adC.font={bold:true,size:9}; adC.alignment={horizontal:'center',wrapText:true};
        const unC=mc(iR+2,c1,iR+2,c2); unC.value=`${u.unvan||''}\n${u.kurum||''}`;
        unC.font={size:8,color:{argb:'FF555555'}}; unC.alignment={horizontal:'center',wrapText:true};
        const imC=mc(iR+5,c1,iR+5,c2); imC.value='';
        imC.border={bottom:{style:'thin',color:{argb:'FF000000'}}};
      });
      ws.getRow(iR+1).height=16; ws.getRow(iR+2).height=24; ws.getRow(iR+5).height=30;
      const tR2=iR+6; mc(tR2,1,tR2,N_TOTAL);
      ws.getCell(`A${tR2}`).value='........./........./20.......';
      ws.getCell(`A${tR2}`).alignment={horizontal:'right'}; ws.getCell(`A${tR2}`).font={size:9};
      ws.getRow(tR2).height=16;
    }

    const dosyaAd=`Ek-4ab_${il}_${koy}_${uretimYili}.xlsx`.replace(/\s+/g,'_');
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="${encodeURIComponent(dosyaAd)}"`);
    await wb.xlsx.write(res); res.end();
  } catch(err){ next(err); }
};

module.exports = { ek4abExcel };
