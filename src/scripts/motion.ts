// Fase 3: movimento discreto. Sem bibliotecas; só corre se <html> tiver a classe .motion
// (posta no <head> quando o utilizador não pediu movimento reduzido).
const root = document.documentElement;
const motion = root.classList.contains('motion');

// 1. Aparecimento ao fazer scroll, com um pequeno escalonamento entre cartões vizinhos.
function initReveal() {
  const items = [...document.querySelectorAll<HTMLElement>('.reveal')];
  if (!motion) {
    items.forEach((el) => el.classList.add('in'));
    return;
  }
  const vh = window.innerHeight;
  // O que já está no ecrã ao carregar aparece logo.
  items.forEach((el) => {
    if (el.getBoundingClientRect().top < vh * 0.92) el.classList.add('in');
  });
  const io = new IntersectionObserver(
    (entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .forEach((e, i) => {
          io.unobserve(e.target);
          window.setTimeout(() => e.target.classList.add('in'), Math.min(i, 3) * 90);
        });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  items.filter((el) => !el.classList.contains('in')).forEach((el) => io.observe(el));
}

// 2. Linha do método: progresso de 0 a 1 ligado ao scroll, só enquanto a secção está visível.
function initFlow() {
  const flow = document.querySelector<HTMLElement>('[data-flow]');
  if (!flow || !motion) return;
  const nodes = [...flow.querySelectorAll<HTMLElement>('[data-flow-node]')];
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = flow.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (window.innerHeight * 0.8 - r.top) / (r.height * 0.85 + 1)));
    flow.style.setProperty('--p', p.toFixed(3));
    nodes.forEach((n, i) => n.classList.toggle('lit', p >= i / nodes.length + 0.01));
    flow.classList.toggle('done', p >= 0.98);
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  update();
  new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      update();
    } else {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      update();
    }
  }).observe(flow);
}

// 3. Hero: os 4 exemplos do telemóvel. Clicar num nome ou nas setas mostra esse exemplo; com movimento,
// avançam sozinhos a cada 5 s (o primeiro espera pelo ecrã de abertura), com botão de pausa (WCAG 2.2.2)
// e pausa automática quando o hero sai do ecrã (poupa bateria). Mexer no telemóvel adia a troca seguinte
// (HOLD_MS depois do último toque), para a pessoa poder experimentar sem o ecrã mudar a meio.
function initHero() {
  const stage = document.querySelector<HTMLElement>('.hero-stage');
  if (!stage) return;
  const scenes = [...stage.querySelectorAll<HTMLElement>('.mk-scene')];
  const steps = [...stage.querySelectorAll<HTMLButtonElement>('[data-step]')];
  const btn = stage.querySelector<HTMLButtonElement>('[data-hero-pause]');
  const label = btn?.querySelector<HTMLElement>('[data-label]');
  const STEP_MS = 5000;
  const BOOT_MS = 2900; // igual a --boot em motion.css
  const HOLD_MS = 12000;
  let heldUntil = 0;
  let firstAt = performance.now() + BOOT_MS + STEP_MS; // primeira troca automática
  let current = 0;
  let timer = 0;
  let paused = false;
  let offscreen = false;

  const phone = initPhone(stage, scenes);
  const show = (i: number) => {
    const prev = current;
    current = (i + scenes.length) % scenes.length;
    if (prev !== current) phone.leave(prev);
    scenes.forEach((s, n) => s.classList.toggle('is-active', n === current));
    steps.forEach((b, n) => {
      b.classList.toggle('is-active', n === current);
      b.setAttribute('aria-current', String(n === current));
    });
  };
  const schedule = () => {
    window.clearTimeout(timer);
    if (!motion || paused || offscreen) return;
    timer = window.setTimeout(() => {
      show(current + 1);
      schedule();
    }, Math.max(STEP_MS, firstAt - performance.now(), heldUntil - performance.now()));
  };
  const go = (i: number) => {
    firstAt = 0;
    show(i);
    schedule();
  };

  phone.onTouch(() => {
    heldUntil = performance.now() + HOLD_MS;
    schedule();
  });
  phone.onSwipe((dir) => {
    heldUntil = performance.now() + HOLD_MS;
    go(current + dir);
  });
  steps.forEach((b, n) => b.addEventListener('click', () => go(n)));
  stage.querySelector('[data-prev]')?.addEventListener('click', () => go(current - 1));
  stage.querySelector('[data-next]')?.addEventListener('click', () => go(current + 1));
  if (!motion) return;

  btn?.addEventListener('click', () => {
    paused = !paused;
    stage.classList.toggle('is-paused', paused);
    btn.setAttribute('aria-pressed', String(paused));
    if (label) label.textContent = paused ? 'Retomar animação' : 'Pausar animação';
    schedule();
  });
  new IntersectionObserver(([entry]) => {
    offscreen = !entry?.isIntersecting;
    stage.classList.toggle('is-offscreen', offscreen);
    schedule();
  }).observe(stage);
  schedule();
  initTilt(stage);
}

// 3a. Telemóvel do hero: toques e gestos dentro do ecrã (só rato e toque; o ecrã é aria-hidden e o teclado
// usa os controlos por baixo). Tudo é fictício e cada ecrã volta ao estado inicial quando se muda de exemplo.
function initPhone(stage: HTMLElement, scenes: HTMLElement[]) {
  const screen = stage.querySelector<HTMLElement>('.mk-screen');
  const toastEl = stage.querySelector<HTMLElement>('[data-hp-toast]');
  const original = scenes.map((s) => s.innerHTML);
  const resets: number[] = [];
  let touchCb = () => {};
  let swipeCb = (_dir: number) => {};
  let toastTimer = 0;

  const toast = (text: string) => {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('is-on');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  };
  const pick = (el: Element, sel: string) => {
    el.parentElement?.querySelectorAll(sel).forEach((x) => x.classList.remove('on'));
    el.classList.add('on');
  };
  const weekdays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const statuses = [
    { key: 'run', label: 'Em curso', cls: '' },
    { key: 'ok', label: 'Pronta', cls: 'ok' },
    { key: 'wait', label: 'Peças', cls: 'wait' },
  ];
  const euros = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`; // 3 180 €

  // Marcações: o botão e a etiqueta acompanham o dia e a hora escolhidos.
  const updateBooking = (scene: HTMLElement) => {
    const day = scene.querySelector<HTMLElement>('[data-hp="day"].on');
    const times = [...scene.querySelectorAll<HTMLElement>('[data-hp="time"]')];
    if (!day) return;
    const wd = Number(day.dataset.wd);
    // Hoje (dia 11) já passou das 9:00 no relógio do telemóvel (9:41).
    const early = times[0];
    early?.classList.toggle('off', day.textContent === '11');
    if (early?.classList.contains('off') && early.classList.contains('on')) pick(times[1]!, '[data-hp="time"]');
    const time = scene.querySelector('[data-hp="time"].on')?.textContent ?? '';
    const label = scene.querySelector('[data-hp-daylabel]');
    if (label) label.textContent = `${weekdays[wd]}-feira, ${day.textContent}`;
    const btn = scene.querySelector<HTMLElement>('[data-hp="book"]');
    if (btn) {
      btn.classList.remove('is-done');
      btn.textContent = `Confirmar ${weekdays[wd]!.toLowerCase()} às ${time}`;
    }
  };

  const actions: Record<string, (el: HTMLElement, scene: HTMLElement, e: MouseEvent) => void> = {
    cycle: (el) => {
      const opts = (el.dataset.options ?? '').split('|');
      const em = el.querySelector('em');
      if (!em) return;
      em.textContent = opts[(opts.indexOf(em.textContent ?? '') + 1) % opts.length] ?? '';
    },
    quote: (el) => {
      el.classList.add('is-done');
      el.textContent = 'Pedido enviado';
      toast('Pedido recebido. Respondemos no mesmo dia útil.');
    },
    day: (el, scene) => {
      pick(el, '[data-hp="day"]');
      updateBooking(scene);
    },
    time: (el, scene) => {
      if (el.classList.contains('off')) return;
      pick(el, '[data-hp="time"]');
      updateBooking(scene);
    },
    book: (el, scene) => {
      if (el.classList.contains('is-done')) return;
      const day = scene.querySelector<HTMLElement>('[data-hp="day"].on');
      const time = scene.querySelector('[data-hp="time"].on')?.textContent;
      el.classList.add('is-done');
      el.textContent = 'Sessão marcada';
      toast(`Marcado: ${weekdays[Number(day?.dataset.wd)]!.toLowerCase()}, dia ${day?.textContent}, às ${time}.`);
    },
    tab: (el) => pick(el, 'span'),
    bars: (el, scene, e) => {
      const bars = [...el.querySelectorAll<HTMLElement>('i')];
      const values = (el.dataset.values ?? '').split(',').map(Number);
      const r = el.getBoundingClientRect();
      const i = Math.min(bars.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * bars.length)));
      const head = scene.querySelector<HTMLElement>('[data-hp-week]');
      const [title, total, note] = head ? [...head.children] : [];
      if (!title || !total || !note) return;
      const was = bars[i]!.classList.contains('sel');
      bars.forEach((b) => b.classList.remove('sel'));
      if (was || !values[i]) {
        // Segundo toque (ou dia ainda sem faturação): volta ao total da semana.
        title.textContent = 'Faturação desta semana';
        total.textContent = euros(values.reduce((a, b) => a + b, 0));
        note.textContent = values[i] || was ? '12% acima da semana passada' : `${weekdays[i]}: ainda sem faturação`;
        return;
      }
      bars[i]!.classList.add('sel');
      title.textContent = `${weekdays[i]}, ${9 + i} nov${i === 2 ? ' (hoje)' : ''}`;
      total.textContent = euros(values[i]!);
      note.textContent = 'Toque de novo para ver a semana';
    },
    car: (el, scene) => {
      const em = el.querySelector('em');
      if (!em) return;
      const now = statuses.findIndex((s) => s.label === em.textContent);
      const next = statuses[(now + 1) % statuses.length]!;
      em.textContent = next.label;
      em.className = next.cls;
      const bump = (key: string, d: number) => {
        const b = scene.querySelector(`[data-stat="${key}"]`);
        if (b) b.textContent = String(Number(b.textContent) + d);
      };
      bump(statuses[now]!.key, -1);
      bump(next.key, 1);
      if (next.key === 'ok') toast(`SMS enviado: ${el.querySelector('b')?.textContent} pronto.`);
    },
    switch: (el, scene) => {
      const sw = el.querySelector('.hp-switch');
      if (!sw) return;
      sw.classList.add('is-touched');
      const on = sw.classList.toggle('on');
      const log = scene.querySelector('[data-hp-log]');
      if (log) {
        const row = document.createElement('div');
        row.className = 'hp-row log is-new';
        row.innerHTML = '<time>09:41</time><span></span>';
        row.querySelector('span')!.textContent = `${on ? 'Ligada' : 'Desligada'}: ${el.dataset.name}`;
        log.prepend(row);
        while (log.children.length > 3) log.lastElementChild?.remove();
      }
      toast(`${el.dataset.name}: ${on ? 'ligado' : 'desligado'}.`);
    },
  };

  // Deslizar na horizontal muda de exemplo; o clique que vem a seguir ao gesto é ignorado.
  let start: { x: number; y: number; id: number } | null = null;
  let swiped = false;
  screen?.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    swiped = false;
  });
  screen?.addEventListener('pointerup', (e) => {
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped = true;
      swipeCb(dx < 0 ? 1 : -1);
    }
  });
  screen?.addEventListener('pointercancel', () => (start = null));
  screen?.addEventListener('click', (e) => {
    if (swiped) {
      swiped = false;
      return;
    }
    const el = (e.target as Element).closest<HTMLElement>('[data-hp]');
    const scene = el?.closest<HTMLElement>('.mk-scene.is-active');
    if (!el || !scene) return;
    actions[el.dataset.hp ?? '']?.(el, scene, e);
    touchCb();
  });

  return {
    onTouch: (cb: () => void) => (touchCb = cb),
    onSwipe: (cb: (dir: number) => void) => (swipeCb = cb),
    // Repõe o ecrã que saiu depois de acabar o fade (ver .mk-scene em motion.css).
    leave: (i: number) => {
      toastEl?.classList.remove('is-on');
      window.clearTimeout(resets[i]);
      resets[i] = window.setTimeout(() => {
        const s = scenes[i];
        if (s && !s.classList.contains('is-active')) s.innerHTML = original[i]!;
      }, 400);
    },
  };
}

// 3b. Inclinação do telemóvel a seguir o rato (só com rato e com movimento; é decoração).
function initTilt(stage: HTMLElement) {
  const phone = stage.querySelector<HTMLElement>('.hero-phone');
  if (!phone || !motion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  // A animação de entrada fixa o transform; só depois dela a inclinação pode atuar.
  const ready = () => phone.classList.add('is-ready');
  phone.addEventListener('animationend', (e) => e.target === phone && ready());
  window.setTimeout(ready, 2000);
  const MAX = 7; // graus
  let frame = 0;
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const r = phone.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / r.width));
      const y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / r.height));
      phone.style.setProperty('--rx', `${(x * MAX).toFixed(2)}deg`);
      phone.style.setProperty('--ry', `${(-y * MAX).toFixed(2)}deg`);
    });
  });
  stage.addEventListener('pointerleave', () => {
    cancelAnimationFrame(frame);
    phone.style.setProperty('--rx', '0deg');
    phone.style.setProperty('--ry', '0deg');
  });
}

// 4. Problemas, "antes → depois": escolher um problema mostra a cena desarrumada e, logo a seguir,
// as peças arrumam-se. Os botões Antes/Depois deixam comparar à mão. Sem movimento, fica sempre o "depois"
// (e os botões trocam sem animação).
function initProblems() {
  const root = document.querySelector<HTMLElement>('[data-pb]');
  const stage = root?.querySelector<HTMLElement>('[data-pb-stage]');
  if (!root || !stage) return;
  const items = [...root.querySelectorAll<HTMLButtonElement>('[data-pb-item]')];
  const scenes = [...root.querySelectorAll<HTMLElement>('[data-pb-scene]')];
  const caps = [...root.querySelectorAll<HTMLElement>('[data-pb-cap]')];
  const modes = [...root.querySelectorAll<HTMLButtonElement>('[data-pb-mode]')];
  const TIDY_MS = 900;
  let timer = 0;

  const setBefore = (before: boolean) => {
    stage.classList.toggle('is-before', before);
    modes.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.pbMode === 'before') === before)));
  };
  const play = (delay = TIDY_MS) => {
    window.clearTimeout(timer);
    if (!motion) return setBefore(false);
    setBefore(true);
    timer = window.setTimeout(() => setBefore(false), delay);
  };
  const select = (i: number) => {
    items.forEach((b, n) => {
      b.classList.toggle('is-active', n === i);
      b.setAttribute('aria-pressed', String(n === i));
    });
    // A cena nova aparece já no "antes" (estava escondida, por isso não anima) e só depois se arruma.
    scenes.forEach((s, n) => (s.hidden = n !== i));
    caps.forEach((c, n) => (c.hidden = n !== i));
    play();
  };

  items.forEach((b, n) => b.addEventListener('click', () => select(n)));
  modes.forEach((b) =>
    b.addEventListener('click', () => {
      window.clearTimeout(timer);
      setBefore(b.dataset.pbMode === 'before');
    }),
  );
  if (!motion) return;

  // Começa desarrumado e arruma-se na primeira vez que a secção aparece no ecrã.
  setBefore(true);
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting) return;
      io.disconnect();
      play(TIDY_MS + 300);
    },
    { threshold: 0.45 },
  );
  io.observe(stage);
}

initReveal();
initFlow();
initHero();
initProblems();
