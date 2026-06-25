// MİS Sidebar Component
const MIS_MENU = [
  {
    baslik: 'Modüller',
    items: [
      { href: '/mera/', icon: 'bi-geo-alt', label: 'Mera' },
      { href: '/isgal/', icon: 'bi-exclamation-triangle', label: 'İşgal' },
      { href: '/tahsis/', icon: 'bi-clipboard-check', label: 'Tespit/Tahdit/Tahsis' },
      { href: '#', icon: 'bi-arrow-left-right', label: 'Tahsis Amacı Değişikliği (TAD)', placeholder: true },
      { href: '#', icon: 'bi-clipboard-check', label: 'Tahsis', placeholder: true },
      { href: '#', icon: 'bi-file-earmark-ruled', label: 'Proje', placeholder: true },
    ]
  },
  {
    baslik: 'Araçlar',
    items: [
      { href: '/bbhb/', icon: 'bi-calculator', label: 'BBHB Hesaplama' },
      { href: '/ehgb/', icon: 'bi-cash-coin', label: 'EHGB Hesaplama' },
      { href: '/mevzuat/', icon: 'bi-journal-text', label: 'Mevzuat' },
      { href: '/cks/', icon: 'bi-file-earmark-spreadsheet', label: 'ÇKS Yükleme' },
      { href: '#', icon: 'bi-signpost-split', label: '5/b', placeholder: true },
      { href: '#', icon: 'bi-file-text', label: 'Bilgi Notu', placeholder: true },
      { href: '#', icon: 'bi-file-earmark-text', label: 'Teknik Şartname', placeholder: true },
    ]
  },
  {
    baslik: 'Defterler',
    items: [
      { href: '#', icon: 'bi-book', label: 'Komisyon Defteri', placeholder: true },
      { href: '#', icon: 'bi-book-half', label: 'Teknik Ekip Defteri', placeholder: true },
    ]
  },
  {
    baslik: 'Sistem',
    items: [
      { href: '/ayarlar/', icon: 'bi-gear', label: 'Ayarlar' },
    ]
  }
];

const MIS_VERSION = 'v1.7.0';

(function() {
  const mevcutYol = window.location.pathname;
  const aktifMi = (href) => href === '/' ? mevcutYol === '/' : mevcutYol.startsWith(href);

  const menuHtml = MIS_MENU.map(grup => `
    <li class="mis-nav-section">${grup.baslik}</li>
    ${grup.items.map(item => `
      <li class="nav-item">
        <a class="nav-link mis-nav-link ${aktifMi(item.href) ? 'active' : ''} ${item.placeholder ? 'mis-nav-placeholder' : ''}" href="${item.href}" ${item.placeholder ? 'title="Yakında" onclick="return false"' : ''}>
          <i class="bi ${item.icon}"></i><span>${item.label}</span>${item.placeholder ? ' <small class="ms-1 opacity-50" style="font-size:9px">(yakında)</small>' : ''}
        </a>
      </li>`).join('')}
  `).join('');

  const html = `
    <nav id="sidebar" class="mis-sidebar d-flex flex-column">
      <a href="/" class="mis-sidebar-brand text-decoration-none">
        <i class="bi bi-tree-fill"></i><span>MİS</span>
      </a>
      <hr class="mis-sidebar-divider"/>
      <ul class="nav flex-column mis-nav px-2">${menuHtml}</ul>
      <div class="mt-auto p-3 mis-sidebar-footer">
        <small class="text-muted">MİS ${MIS_VERSION}</small>
      </div>
    </nav>`;

  const mount = document.getElementById('mis-sidebar-mount');
  if (mount) mount.outerHTML = html;

  document.addEventListener('click', (e) => {
    if (e.target.closest('#sidebarToggle')) {
      document.getElementById('wrapper')?.classList.toggle('sidebar-collapsed');
    }
  });
})();
