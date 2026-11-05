(() => {
  const doc = document.documentElement
  const btn = document.querySelector('.menu-btn'), panel = document.getElementById('mpanel')
  if (!btn || !panel) return
  const set = (open) => { doc.classList.toggle('menu-open', open); btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? 'Закрыть' : 'Меню' }
  btn.addEventListener('click', () => set(!doc.classList.contains('menu-open')))
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) set(false) })
  addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false) })
})()
