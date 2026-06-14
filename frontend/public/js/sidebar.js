// MİS Sidebar Component
const MIS_MENU = [
  {
    baslik: 'Modüller',
    items: [
      { href: '/bbhb/', icon: 'bi-calculator', label: 'BBHB Hesaplayıcı' },
      { href: '/mera/', icon: 'bi-geo-alt', label: 'Mera' },
      { href: '/isgal/', icon: 'bi-exclamation-triangle', label: 'İşgal' },
      { href: '/mevzuat/', icon: 'bi-journal-text', label: 'Mevzuat' },
    ]
  },
  {
    baslik: 'Sistem',
    items: [
      { href: '/ayarlar/', icon: 'bi-gear', label: 'Ayarlar' },
    ]
  }
];

const MIS_VERSION = 'v1.5.1';

(function() {
  const mevcutYol = window.location.pathname;
  const aktifMi = (href) => href === '/' ? mevcutYol === '/' : mevcutYol.startsWith(href);

  const menuHtml = MIS_MENU.map(grup => `
    <li class="mis-nav-section">${grup.baslik}</li>
    ${grup.items.map(item => `
      <li class="nav-item">
        <a class="nav-link mis-nav-link ${aktifMi(item.href) ? 'active' : ''}" href="${item.href}">
          <i class="bi ${item.icon}"></i><span>${item.label}</span>
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
