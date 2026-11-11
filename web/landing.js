// Recorrido de la landing (ver docs/plan/DISENO-web.md).
//
// 1. Portada: el móvil entra a la derecha (animación CSS `phone-in`).
// 2. Al bajar, se desliza al centro y crece un poco. Ese movimiento sigue al
//    scroll pero suavizado (interpolación por frame), así una rueda a saltos
//    no se traduce en tirones.
// 3. Ya en el centro, el recorrido queda fijo y cada tramo de scroll cambia la
//    pantalla del móvil y el texto con un fundido corto (transiciones CSS,
//    hacia arriba al bajar y hacia abajo al subir).
// Sin dependencias; solo toca transform y opacity.
(() => {
  const journey = document.getElementById('journey');
  const phone = document.getElementById('phone');
  const tour = document.getElementById('como-funciona');
  if (!journey || !phone || !tour) return;
  // Los estados ocultos (pasos apilados, revelados) solo valen si este script corre.
  document.documentElement.classList.add('ready');

  const rigPos = phone.closest('.rig-pos');
  const header = document.querySelector('.top');
  const halos = document.querySelector('.halos');
  const screens = [...phone.querySelectorAll('.scr')];
  const steps = [...tour.querySelectorAll('.step')];
  const links = [...tour.querySelectorAll('.tour-index a')];
  const N = steps.length;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 1023px)');

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  let tourTop = 0;
  let tourSpan = 1;
  let shown = null;
  let move = 0; // 0 = a un lado, 1 = centrado (valor suavizado)
  let target = 0;
  let frame = 0;

  function measure() {
    const r = tour.getBoundingClientRect();
    tourTop = r.top + window.scrollY;
    tourSpan = Math.max(1, tour.offsetHeight - window.innerHeight);
  }

  /** Paso activo: -1 en la portada; 0…N-1 dentro del recorrido. */
  function stepAt(y) {
    if (y < tourTop - window.innerHeight * 0.35) return -1;
    return clamp(Math.floor(((y - tourTop) / tourSpan) * N), 0, N - 1);
  }

  function setStep(i) {
    if (i === shown) return;
    shown = i;
    const screen = i + 1; // la pantalla 0 es el deck de la portada
    screens.forEach((el, k) => {
      el.classList.toggle('is-active', k === screen);
      el.classList.toggle('is-past', k < screen);
    });
    steps.forEach((el, k) => {
      el.classList.toggle('is-active', k === i);
      el.classList.toggle('is-past', k < i);
    });
    links.forEach((a, k) => {
      if (k === i) a.setAttribute('aria-current', 'step');
      else a.removeAttribute('aria-current');
    });
  }

  function sideX() {
    return Math.min(window.innerWidth * 0.25, 330);
  }

  function paintPhone() {
    if (narrow.matches) {
      rigPos.style.transform = '';
      return;
    }
    if (reduce.matches) {
      // Sin desplazamiento: el móvil se queda a la derecha.
      rigPos.style.transform = `translate3d(${sideX()}px,0,0)`;
      return;
    }
    const e = easeInOut(clamp(move, 0, 1));
    const x = (1 - e) * sideX();
    const scale = 1 + e * 0.12;
    rigPos.style.transform = `translate3d(${x.toFixed(2)}px,0,0) scale(${scale.toFixed(4)})`;
  }

  function progressAt(y) {
    // Del lado al centro mientras la portada sale de la pantalla.
    return clamp(y / Math.max(1, tourTop - window.innerHeight * 0.1), 0, 1);
  }

  function tick() {
    frame = 0;
    const y = window.scrollY;
    header?.classList.toggle('scrolled', y > 8);
    target = progressAt(y);
    halos?.style.setProperty('--conv', target.toFixed(3));
    setStep(stepAt(y));

    if (reduce.matches) move = target;
    else move += (target - move) * 0.14;
    if (Math.abs(target - move) < 0.0005) move = target;
    paintPhone();
    if (move !== target) frame = requestAnimationFrame(tick);
  }

  function queue() {
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function remeasure() {
    measure();
    queue();
  }

  // El índice lleva al tramo de scroll de cada paso (el ancla sola caería al
  // principio del escenario fijo).
  links.forEach((a, k) =>
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const y = tourTop + ((k + 0.5) / N) * tourSpan;
      window.scrollTo({ top: y, behavior: reduce.matches ? 'auto' : 'smooth' });
    })
  );

  // «Descargar» (cabecera) vuelve arriba del todo, donde están las tiendas y el QR.
  document.querySelectorAll('a[href="#top"]').forEach((a) =>
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
    })
  );

  measure();
  move = target = progressAt(window.scrollY);
  tick();
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);
  document.fonts?.ready.then(remeasure);
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(journey);
  reduce.addEventListener?.('change', remeasure);
  narrow.addEventListener?.('change', remeasure);

  // Bloques de después (Premium, preguntas, cierre): entran una vez al verse.
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px' }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }
})();
