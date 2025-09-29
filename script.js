/* ========= helpers ========= */
const $  = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

/* ========= ano no rodapé ========= */
(() => {
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
})();

/* ========= revelar seções on-scroll ========= */
(() => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); });
  }, { threshold: 0.15 });
  $$('.fade-up').forEach(el => io.observe(el));
})();

/* ========= partículas/estrelas de fundo ========= */
(() => {
  const canvas = $('#fx-stars'); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W=0,H=0, stars=[];
  const N = 80;

  function resize(){
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    stars = new Array(N).fill(0).map(()=>({
      x: Math.random()*W,
      y: Math.random()*H,
      r: Math.random()*1.8 + .4,
      s: Math.random()*0.4 + 0.15,
      o: Math.random()*0.4 + 0.4
    }));
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    for (const p of stars){
      p.y -= p.s;
      if (p.y < -10){ p.y = H + 10; p.x = Math.random()*W; }
      ctx.globalAlpha = p.o + Math.sin(p.y*0.02)*0.2;
      const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*3);
      g.addColorStop(0,'rgba(207,174,92,0.9)');
      g.addColorStop(1,'rgba(207,174,92,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*3,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }
  resize(); draw();
  window.addEventListener('resize', resize);
})();

/* ========= carrossel de depoimentos (scroll-snap + autoplay + pausa ao interagir) ========= */
(() => {
  const vp = $('.reviews-viewport'); if (!vp) return;
  const track = $('.reviews-track', vp);
  let cards = $$('.review', track);
  if (!cards.length) return;

  let idx = 0, timer = null;
  const padLeft = () => parseFloat(getComputedStyle(vp).paddingLeft) || 0;

  function goto(i, smooth=true){
    cards = $$('.review', track);
    idx = (i + cards.length) % cards.length;
    const x = Math.max(0, cards[idx].offsetLeft - padLeft());
    vp.scrollTo({ left: x, behavior: smooth ? 'smooth' : 'auto' });
  }
  const atEnd = () =>
    Math.abs(vp.scrollLeft + vp.clientWidth - vp.scrollWidth) < 2;

  function play(){
    if (timer) return;
    timer = setInterval(() => {
      if (atEnd()){ goto(0, false); return; }
      goto(idx + 1, true);
    }, 3000);
  }
  function pause(){ if (timer){ clearInterval(timer); timer = null; } }

  goto(0, false); play();

  ['mouseenter','touchstart','focusin','keydown','pointerdown'].forEach(e =>
    vp.addEventListener(e, pause, {passive:true})
  );
  ['mouseleave','touchend','focusout','pointerup'].forEach(e =>
    vp.addEventListener(e, () => setTimeout(play, 900), {passive:true})
  );

  let debounce;
  vp.addEventListener('scroll', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const center = vp.scrollLeft + vp.clientWidth/2;
      let bestI = idx, bestD = Infinity;
      cards.forEach((el, i) => {
        const mid = el.offsetLeft + el.offsetWidth/2;
        const d = Math.abs(mid - center);
        if (d < bestD){ bestD = d; bestI = i; }
      });
      idx = bestI;
    }, 120);
  }, {passive:true});

  window.addEventListener('resize', () => { pause(); goto(idx, false); play(); });
})();

/* ========= players dos 7 dias (prévia de 15s a partir de /audios) ========= */
(() => {
  const players = $$('.player[data-player]');
  if (!players.length) return;

  const fmt = s => {
    const m = Math.floor(s/60), ss = Math.floor(s%60);
    return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  };
  const registry = [];

  players.forEach((wrap) => {
    const card = wrap.closest('.step-card');
    const audioName = card?.dataset.audio || '';
    const src = audioName.startsWith('audios/') ? audioName : 'audios/' + audioName;
    const audio = new Audio(src);
    audio.preload = 'metadata';

    const btn  = $('[data-player-toggle]', wrap);
    const bar  = $('.player__progress', wrap);
    const time = $('[data-player-time]', wrap);

    const PREVIEW = 15;
    let raf = null;

    function update(){
      const t = Math.min(PREVIEW, audio.currentTime);
      bar.style.width = `${Math.max(0, Math.min(100, (t/PREVIEW)*100))}%`;
      time.textContent = fmt(t);
      if (t >= PREVIEW){ pause(true); }
      else { raf = requestAnimationFrame(update); }
    }

    function play(){
      registry.forEach(r => { if (r !== api) r.pause(true); });
      audio.currentTime = 0;
      audio.play().then(()=>{
        btn.textContent = '❚❚';
        cancelAnimationFrame(raf); raf = requestAnimationFrame(update);
      }).catch(()=>{});
    }

    function pause(reset=false){
      audio.pause();
      btn.textContent = '▶';
      cancelAnimationFrame(raf); raf = null;
      if (reset){ bar.style.width = '0%'; time.textContent = '00:00'; }
    }

    audio.addEventListener('ended', () => pause(true));
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(false); });
    btn.addEventListener('click', () => (audio.paused ? play() : pause(false)));

    const api = { pause };
    registry.push(api);
  });
})();

/* ========= FAQ (abre um, fecha outro, com animação) ========= */
(() => {
  const items = $$('.faq__item');
  items.forEach((el) => {
    const summary = $('summary', el);
    const body = $('.faq__body', el);
    if (!summary || !body) return;

    summary.addEventListener('click', (e) => {
      e.preventDefault();
      const isOpen = el.hasAttribute('open');

      items.forEach(o => {
        if (o !== el && o.hasAttribute('open')){
          o.removeAttribute('open');
          const ob = $('.faq__body', o);
          if (ob){ ob.style.maxHeight = '0px'; ob.style.opacity = '0'; }
        }
      });

      if (isOpen){
        el.removeAttribute('open');
        body.style.maxHeight = '0px'; body.style.opacity = '0';
      } else {
        el.setAttribute('open','');
        body.style.maxHeight = body.scrollHeight + 'px';
        body.style.opacity = '1';
      }
    });
  });
})();

/* ========= vídeo da HERO (play por clique, fallback mudo, capa/botão somem) ========= */
(() => {
  const wrap  = document.querySelector('.hero-video__wrap');
  if (!wrap) return;

  const video = wrap.querySelector('#teaser') || wrap.querySelector('video.hero-video__el');
  const btn   = document.getElementById('teaserPlay') || wrap.querySelector('.hero-video__play');
  const cover = document.getElementById('teaserCover') || wrap.querySelector('.hero-video__cover');

  if (!video || !btn) return;

  // Sinais p/ iOS/Android não abrir em tela cheia e permitir play via gesto
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.controls = false;

  // anti-download básico / UX
  ['contextmenu','dragstart'].forEach(evt => video.addEventListener(evt, e => e.preventDefault()));
  if ('disablePictureInPicture' in video) {
    try { video.disablePictureInPicture = true; } catch {}
  }

  function hideUI() {
    btn.classList.add('is-hidden');              // garanta no CSS: .is-hidden{opacity:0;pointer-events:none;transform:scale(.95);transition:.25s}
    if (cover) cover.classList.add('is-hidden'); // você já tem essa classe no CSS
  }

  async function tryPlay(withSound=true) {
    try {
      video.muted = !withSound;
      // garante que o browser considere "gesto do usuário"
      await video.play();
      hideUI();
      return true;
    } catch (err) {
      return false;
    }
  }

  async function start() {
    btn.disabled = true;
    // 1) tenta com som
    if (await tryPlay(true)) return;

    // 2) fallback mudo (navegadores que bloqueiam áudio)
    if (await tryPlay(false)) {
      // opcional: tente habilitar som discretamente após começar
      setTimeout(() => { try { video.muted = false; } catch {} }, 400);
      return;
    }

    // 3) falhou tudo: reabilita botão
    btn.disabled = false;
  }

  // Clique no botão OU em qualquer ponto do “cartão” do vídeo
  btn.addEventListener('click', (e) => { e.preventDefault(); start(); });
  wrap.addEventListener('click', (e) => {
    // evita clique passar se já está tocando
    if (e.target === btn || !video.paused) return;
    start();
  });

  // Pausa se sair totalmente da viewport (economia)
  
})();


/* ========= scroll suave com offset do header (para #checkout e demais âncoras) ========= */
/* ===== Scroll suave com offset do header (aciona só em links [data-scroll]) ===== */
(() => {
  const header = document.querySelector('.site-header');
  const OFFSET = header ? header.getBoundingClientRect().height : 0;

  function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
  function animateTo(to, duration=700){
    const start = window.pageYOffset;
    const dist  = to - start;
    const t0 = performance.now();
    function step(t){
      const p = Math.min(1, (t - t0) / duration);
      window.scrollTo(0, start + dist * easeOutCubic(p));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function smoothTo(el){
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.pageYOffset - (OFFSET + 12);
    animateTo(y, 700);
  }

  // 👉 só links com data-scroll
  document.querySelectorAll('a[data-scroll][href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      smoothTo(target);
    });
  });

  // ❌ removido: NADA de auto-scroll ao carregar com location.hash
})();

/* ========= Carrosséis de Provas (multi-instância) ========= */
(() => {
  const CAROUSEL_SEL = '[data-carousel]';

  document.querySelectorAll(CAROUSEL_SEL).forEach(setupCarousel);

  function setupCarousel(root){
    const vp    = root.querySelector('[data-viewport]');
    const track = root.querySelector('[data-track]');
    const slides = [...root.querySelectorAll('.slide')];
    const prev  = root.querySelector('[data-prev]');
    const next  = root.querySelector('[data-next]');
    const dotsWrap = root.querySelector('[data-dots]');

    if (!vp || !track || slides.length === 0) return;

    let index = 0;
    let timer = null;
    const INTERVAL = parseInt(root.dataset.interval || '3000', 10);
    const AUTOPLAY = (root.dataset.autoplay ?? 'true') !== 'false';

    function go(i, smooth = true){
      index = (i + slides.length) % slides.length;
      const x = slides[index].offsetLeft;
      vp.scrollTo({ left: x, behavior: smooth ? 'smooth' : 'auto' });
      updateDots();
    }

    function updateDots(){
      if (!dotsWrap) return;
      [...dotsWrap.children].forEach((b, i) => {
        b.setAttribute('aria-selected', i === index ? 'true' : 'false');
      });
    }

    function buildDots(){
      if (!dotsWrap) return;
      dotsWrap.innerHTML = '';
      slides.forEach((_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', `Ir para o slide ${i+1}`);
        b.addEventListener('click', () => { stop(); go(i); setTimeout(play, 900); });
        dotsWrap.appendChild(b);
      });
      updateDots();
    }

    function play(){
      if (!AUTOPLAY || timer) return;
      timer = setInterval(() => {
        go(index + 1);
      }, isNaN(INTERVAL) ? 3000 : INTERVAL);
    }

    function stop(){
      if (timer){ clearInterval(timer); timer = null; }
    }

    // Botões
    prev?.addEventListener('click', () => { stop(); go(index - 1); setTimeout(play, 900); });
    next?.addEventListener('click', () => { stop(); go(index + 1); setTimeout(play, 900); });

    // Atualiza índice conforme o scroll (inclusive por swipe)
    let debounce;
    vp.addEventListener('scroll', () => {
      stop();
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const center = vp.scrollLeft + vp.clientWidth / 2;
        let best = 0, min = Infinity;
        slides.forEach((s, i) => {
          const mid = s.offsetLeft + s.offsetWidth / 2;
          const d = Math.abs(mid - center);
          if (d < min){ min = d; best = i; }
        });
        index = best; updateDots(); play();
      }, 120);
    }, { passive: true });

    // Pausa ao interagir
    root.addEventListener('pointerenter', stop);
    root.addEventListener('pointerleave', () => setTimeout(play, 400));
    root.addEventListener('touchstart', stop, { passive:true });
    root.addEventListener('touchend',   () => setTimeout(play, 400), { passive:true });

    // Pausa quando sai da viewport
    if ('IntersectionObserver' in window){
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => e.isIntersecting ? play() : stop());
      }, { threshold: 0.25 });
      io.observe(root);
    }

    // start
    buildDots();
    go(0, false);
    play();
    // Recalcula posição ao redimensionar
    window.addEventListener('resize', () => go(index, false));
  }
})();
