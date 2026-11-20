// Theme switch (remembered), the pages menu on small screens, and the "On this page" highlight.
(() => {
  const root = document.documentElement;
  const isDark = () => root.classList.contains('dark') || (!root.classList.contains('light') && matchMedia('(prefers-color-scheme: dark)').matches);
  document.getElementById('theme')?.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.classList.remove('light', 'dark'); root.classList.add(next);
    try { localStorage.setItem('rl-theme', next); } catch (e) { /* private mode */ }
  });
  const side = document.getElementById('side'); const mb = document.getElementById('mbtn');
  mb?.addEventListener('click', () => { const o = side.classList.toggle('open'); mb.setAttribute('aria-expanded', String(o)); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && side?.classList.contains('open')) { side.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); } });
  const links = [...document.querySelectorAll('.toc a')];
  const heads = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
  if (heads.length) {
    const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) links.forEach((a) => a.classList.toggle('on', a.hash === `#${e.target.id}`)); }, { rootMargin: '-70px 0px -70% 0px' });
    heads.forEach((h) => io.observe(h));
  }
})();
