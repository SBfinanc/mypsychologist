(() => {
  const doc = document.documentElement
  doc.classList.add('js')
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) doc.classList.add('rm')

  /* ---------- Кино: кадры -> canvas по прогрессу скролла ---------- */
  // single-file: кадры лежат внутри страницы (__FRAMES, base64); веб-сборка: кадры отдельными файлами (__FRAME_URLS), грузятся по мере скролла
  const FR = window.__FRAMES, URLS = window.__FRAME_URLS
  const N = FR ? FR.length : URLS.length
  const FW = 1152, FH = 647
  const cv = document.getElementById('cv')
  const stage = document.getElementById('stage')
  const ctx = cv.getContext('2d', { alpha: false })
  const phone = () => innerWidth <= 760
  const FOCAL_Y = 0.5
  const focalX = () => (phone() ? 0.86 : 0.72) // кресло и пампас справа: на телефоне держим их в кадре

  const blobs = FR && FR.map((b64) => {
    const bin = atob(b64), u = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
    return new Blob([u], { type: 'image/webp' })
  })
  const getBlob = (i) => (blobs ? Promise.resolve(blobs[i]) : fetch(URLS[i]).then((r) => r.blob()))

  // cover-fit вручную: масштаб по Math.max, сдвиг по фокусу (кресло справа)
  function layout() {
    const w = stage.clientWidth, h = stage.clientHeight
    const s = Math.max(w / FW, h / FH)
    cv.style.width = FW * s + 'px'
    cv.style.height = FH * s + 'px'
    cv.style.left = -(FW * s - w) * focalX() + 'px'
    cv.style.top = -(FH * s - h) * FOCAL_Y + 'px'
  }

  const cache = new Map()
  const pending = new Set()
  let current = 0, painted = -1
  const R = () => (phone() ? 18 : 34)

  function want(i) {
    if (i < 0 || i >= N || cache.has(i) || pending.has(i)) return
    pending.add(i)
    getBlob(i).then((b) => createImageBitmap(b)).then((bm) => {
      pending.delete(i)
      cache.set(i, bm)
      if (i === current) paint()
    }).catch(() => pending.delete(i))
  }

  function paint() {
    let idx = current
    if (!cache.has(idx)) {
      // рядом лежащий готовый кадр: белой вспышки не будет
      let found = -1
      for (let d = 1; d <= 16 && found < 0; d++) {
        if (cache.has(current - d)) found = current - d
        else if (cache.has(current + d)) found = current + d
      }
      if (found < 0) return
      idx = found
    }
    if (idx === painted) return // тот же кадр не перерисовываем
    ctx.drawImage(cache.get(idx), 0, 0)
    painted = idx
    // светлее: общий подъём яркости и дополнительный в финале, где закат уходит в тёмно-синий вечер
    const lift = 1.12 + 0.34 * Math.max(0, (idx - 100) / (N - 1 - 100))
    const f = 'brightness(' + lift.toFixed(2) + ') saturate(1.04)'
    if (cv.style.filter !== f) cv.style.filter = f
  }

  function setFrame(i) {
    current = Math.max(0, Math.min(N - 1, i))
    const r = R()
    for (let k = 0; k <= r; k++) { want(current + k); want(current - k) }
    for (const [k, bm] of cache) if (Math.abs(k - current) > r * 2) { bm.close(); cache.delete(k) }
    paint()
  }

  layout()
  // следим за самой сценой, а не за событием resize: адресная строка телефона и эмуляция меняют высоту без него
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(stage)
  else addEventListener('resize', layout)
  addEventListener('load', layout)
  addEventListener('resize', layout)
  addEventListener('orientationchange', layout)
  // кадр 0 рисуем сразу до скролла (на фоне уже лежит тот же кадр, вспышки нет)
  want(0)
  getBlob(reduced ? N - 1 : 0).then((b) => createImageBitmap(b)).then((bm) => {
    cache.set(reduced ? N - 1 : 0, bm)
    current = reduced ? N - 1 : 0
    paint()
    if (!reduced) for (let k = 1; k < (blobs ? 24 : 8); k++) want(k) // веб-сборка: сначала 8 кадров, остальные по мере прокрутки
  })

  /* ---------- Закрепление и подписи ---------- */
  if (!reduced && window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger, CustomEase)
    CustomEase.create('scr', '0.87,0,0.13,1')
    const film = document.getElementById('film')
    const slides = [...document.querySelectorAll('.slide')]
    const vh = () => innerHeight
    const PER = 0.6 // 60vh на подпись: на каждые 100vh закрепления приходится больше одного переключения
    const len = () => vh() * slides.length * PER

    const pin = ScrollTrigger.create({
      trigger: film,
      start: 'top top',
      end: () => '+=' + len(),
      pin: true,
      pinSpacing: true,
      scrub: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => setFrame(Math.round(self.progress * (N - 1))),
    })

    slides.forEach((el, i) => {
      const first = i === 0, last = i === slides.length - 1
      // каждая подпись проявляется и гаснет внутри своего окна с паузой по краям: предыдущий заголовок
      // полностью исчезает до того, как начнёт проявляться следующий, призрака поверх нового кадра нет
      const tl = gsap.timeline({ defaults: { ease: 'none' } })
      if (first) gsap.set(el, { autoAlpha: 1, y: 0 })
      else {
        gsap.set(el, { autoAlpha: 0, y: 40 })
        tl.to(el, { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power2.out' })
      }
      tl.to({}, { duration: first ? 0.45 : last ? 0.62 : 0.3 })
      if (!last) {
        tl.to(el, { autoAlpha: 0, y: -30, duration: 0.16, ease: 'power2.in' })
      }
      ScrollTrigger.create({
        trigger: film,
        start: () => pin.start + i * vh() * PER,
        end: () => pin.start + (i + 1) * vh() * PER,
        scrub: true,
        animation: tl,
        invalidateOnRefresh: true,
      })
    })
    addEventListener('load', () => ScrollTrigger.refresh())
    // страховка: при прыжке по странице подпись и кадр обновляются сразу по событию прокрутки,
    // а не по тикеру анимации (в неактивной вкладке он замирает)
    addEventListener('scroll', () => ScrollTrigger.update(), { passive: true })
  }

  const edu = document.querySelector('details.edu-box')
  if (edu && phone()) edu.removeAttribute('open')

  /* ---------- Появление блоков ---------- */
  const rv = [...document.querySelectorAll('.rv')]
  if (reduced || !('IntersectionObserver' in window)) rv.forEach((e) => e.classList.add('in'))
  else {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
    }), { rootMargin: '0px 0px 30% 0px' })
    rv.forEach((e) => io.observe(e))
    // прыжок по якорю или клавише End: показать всё, что осталось выше линии экрана
    let t
    addEventListener('scroll', () => {
      clearTimeout(t)
      t = setTimeout(() => rv.forEach((e) => { if (!e.classList.contains('in') && e.getBoundingClientRect().top < innerHeight) e.classList.add('in') }), 160)
    }, { passive: true })
  }

  /* ---------- Шапка: прячется при прокрутке вниз ---------- */
  const top = document.getElementById('top')
  let lastY = 0
  const filmEnd = () => (reduced ? innerHeight : innerHeight * slidesCount() * 0.6) - 60
  function slidesCount() { return document.querySelectorAll('.slide').length }
  addEventListener('scroll', () => {
    const y = scrollY
    top.classList.toggle('solid', y > filmEnd())
    // шапка уходит при прокрутке вниз и возвращается при прокрутке вверх (на телефоне экономит высоту)
    top.classList.toggle('hide', y > lastY && y > 120 && !doc.classList.contains('menu-open'))
    lastY = y
  }, { passive: true })

  /* ---------- Меню на телефоне ---------- */
  const mbtn = document.querySelector('.menu-btn'), mpanel = document.getElementById('mpanel')
  function menu(open) {
    doc.classList.toggle('menu-open', open)
    mbtn.setAttribute('aria-expanded', String(open))
    mbtn.textContent = open ? 'Закрыть' : 'Меню'
    top.classList.toggle('solid', open || scrollY > filmEnd())
  }
  mbtn.addEventListener('click', () => menu(!doc.classList.contains('menu-open')))
  mpanel.addEventListener('click', (e) => { if (e.target.closest('a')) menu(false) })
  addEventListener('keydown', (e) => { if (e.key === 'Escape') menu(false) })

  /* ---------- Форма: собирает сообщение и открывает WhatsApp ---------- */
  const form = document.getElementById('form')
  const status = document.getElementById('status')
  const WA = '77057679777'
  const fName = document.getElementById('f-name'), fPhone = document.getElementById('f-phone')
  form.addEventListener('input', (e) => { const f = e.target.closest('.field'); if (f) f.classList.remove('err') })
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const name = form.elements.name.value.trim()
    const phone = form.elements.phone.value.trim()
    const digits = phone.replace(/\D/g, '')
    const okName = name.length >= 2, okPhone = digits.length >= 10
    fName.classList.toggle('err', !okName)
    fPhone.classList.toggle('err', !okPhone)
    if (!okName || !okPhone) { status.textContent = 'Проверьте поля, выделенные выше.'; (okName ? form.elements.phone : form.elements.name).focus(); return }
    const text = `Здравствуйте, Наталья! Меня зовут ${name}. Хочу записаться: ${form.elements.format.value}. Мой номер: ${phone}.`
    status.textContent = 'Открываю WhatsApp с готовым сообщением. Если не открылся, нажмите кнопку ещё раз.'
    open(`https://wa.me/${WA}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  })
})()
