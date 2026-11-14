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

// 2. Linha do método: quando a secção aparece, um ponto percorre a linha do passo 1 até ao fim (--lp de 0 a 1),
// acende cada passo quando lá chega (.lit) e no fim aparece o certo de "Problema resolvido" (.done). Corre uma vez.
function initFlow() {
  const flow = document.querySelector<HTMLElement>('[data-flow]');
  const line = flow?.querySelector<HTMLElement>('.mt-line');
  if (!flow || !line || !motion) return;
  const nodes = [...flow.querySelectorAll<HTMLElement>('[data-flow-node]')];
  flow.style.setProperty('--lp', '0');
  const run = () => {
    // Onde fica cada nó ao longo da linha (horizontal no computador, vertical no telemóvel), de 0 a 1.
    const desk = window.matchMedia('(min-width: 1024px)').matches;
    const lr = line.getBoundingClientRect();
    const len = (desk ? lr.width : lr.height) || 1;
    const at = nodes.map((n) => {
      const r = n.getBoundingClientRect();
      const c = desk ? r.left + r.width / 2 - lr.left : r.top + r.height / 2 - lr.top;
      return Math.max(0, Math.min(1, c / len));
    });
    const dur = desk ? 3600 : 5000;
    const t0 = performance.now();
    flow.classList.add('is-running');
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const p = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // arranca e trava com suavidade
      flow.style.setProperty('--lp', p.toFixed(4));
      nodes.forEach((n, i) => n.classList.toggle('lit', p >= (at[i] ?? 0) - 0.005));
      if (t < 1) return void requestAnimationFrame(frame);
      flow.classList.remove('is-running');
      flow.classList.add('done');
    };
    requestAnimationFrame(frame);
  };
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting) return;
      io.disconnect();
      run();
    },
    { threshold: 0.35 },
  );
  io.observe(flow);
}

// 3. Hero: os 4 exemplos do telemóvel. Clicar num nome ou nas setas mostra esse exemplo; com movimento,
// avançam sozinhos a cada 5 s (o primeiro espera pelo ecrã de abertura), com botão de pausa (WCAG 2.2.2)
// e pausa automática quando o hero sai do ecrã (poupa bateria).
function initHero() {
  const stage = document.querySelector<HTMLElement>('.hero-stage');
  if (!stage) return;
  const scenes = [...stage.querySelectorAll<HTMLElement>('.mk-scene')];
  const steps = [...stage.querySelectorAll<HTMLButtonElement>('[data-step]')];
  const btn = stage.querySelector<HTMLButtonElement>('[data-hero-pause]');
  const label = btn?.querySelector<HTMLElement>('[data-label]');
  const STEP_MS = 5000;
  const BOOT_MS = 2900; // igual a --boot em motion.css
  let firstAt = performance.now() + BOOT_MS + STEP_MS; // primeira troca automática
  let current = 0;
  let timer = 0;
  let paused = false;
  let offscreen = false;

  const show = (i: number) => {
    current = (i + scenes.length) % scenes.length;
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
    }, Math.max(STEP_MS, firstAt - performance.now()));
  };
  const go = (i: number) => {
    firstAt = 0;
    show(i);
    schedule();
  };

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
}

// 4. Problemas, "antes → depois". Com movimento, os problemas passam sozinhos quando a secção está no ecrã:
// cada um mostra a confusão, arruma-se e fica arrumado até ao seguinte (uma linha no problema aberto mostra o
// tempo que falta). Há botão de pausa (WCAG 2.2.2) e pausa automática fora do ecrã. Clicar num problema mostra-o
// e continua a passagem a partir dele; os botões Antes/Depois pausam, para comparar com calma.
// Sem movimento, fica sempre o "depois" e tudo muda só com cliques.
function initProblems() {
  const root = document.querySelector<HTMLElement>('[data-pb]');
  const stage = root?.querySelector<HTMLElement>('[data-pb-stage]');
  if (!root || !stage) return;
  const items = [...root.querySelectorAll<HTMLButtonElement>('[data-pb-item]')];
  const scenes = [...root.querySelectorAll<HTMLElement>('[data-pb-scene]')];
  const caps = [...root.querySelectorAll<HTMLElement>('[data-pb-cap]')];
  const metrics = [...root.querySelectorAll<HTMLElement>('[data-pb-metric]')];
  const modes = [...root.querySelectorAll<HTMLButtonElement>('[data-pb-mode]')];
  const pauseBtn = root.querySelector<HTMLButtonElement>('[data-pb-pause]');
  const pauseLabel = pauseBtn?.querySelector<HTMLElement>('[data-label]');
  const pieces = scenes.map((s) => [...s.querySelectorAll<HTMLElement>('.pb-piece')]);
  const N = scenes.length;
  const MESS_MS = 1500; // tempo a mostrar a confusão antes de arrumar (as peças caem e chega a mensagem nova)
  const STEP_MS = 6000; // tempo de cada problema (igual a --step no CSS)
  root.style.setProperty('--step', `${STEP_MS}ms`);
  let current = 0;
  let tidyTimer = 0;
  let stepTimer = 0;
  let stepLeft = STEP_MS; // o que falta do problema atual (para retomar depois de uma pausa)
  let stepStart = 0;
  let paused = false;
  let offscreen = true;
  let started = false;

  // Troca de cena com movimento: a anterior desvanece por cima (arrumada) e as peças da nova caem uma a uma.
  let leaveTimer = 0;
  let enterTimer = 0;
  const endLeave = () => {
    window.clearTimeout(leaveTimer);
    scenes.forEach((s, n) => {
      if (!s.classList.contains('is-leaving')) return;
      s.classList.remove('is-leaving');
      s.hidden = n !== current;
    });
  };
  const show = (i: number, drop = false) => {
    const prev = current;
    current = (i + N) % N;
    items.forEach((b, n) => {
      b.classList.toggle('is-active', n === current);
      b.classList.remove('is-run');
      b.setAttribute('aria-pressed', String(n === current));
    });
    endLeave();
    // Com movimento, a cena nova começa desarrumada: o número de "depois" não pode aparecer nem por um instante.
    if (motion) stage.classList.add('is-pending');
    scenes.forEach((s, n) => {
      s.classList.remove('is-drop', 'is-enter');
      s.hidden = n !== current;
    });
    caps.forEach((c, n) => (c.hidden = n !== current));
    metrics.forEach((m, n) => (m.hidden = n !== current));
    if (!motion) return;
    const next = scenes[current];
    const old = scenes[prev];
    if (old && prev !== current) {
      old.hidden = false;
      old.classList.add('is-leaving');
      leaveTimer = window.setTimeout(endLeave, 400);
    }
    if (next && (drop || prev !== current)) {
      void next.offsetWidth; // recomeça a queda das peças
      next.classList.add('is-drop', 'is-enter');
      window.clearTimeout(enterTimer);
      enterTimer = window.setTimeout(() => next.classList.remove('is-enter'), 650);
    }
  };
  // Tempos da arrumação (iguais ao CSS: viagem de .9s com 110 ms entre peças e 150 ms de arranque).
  const MOVE_MS = 900;
  const GAP_MS = 110;
  const LEAD_MS = 150;
  let landTimers: number[] = [];
  let countRaf = 0;
  const clearLand = () => {
    landTimers.forEach((t) => window.clearTimeout(t));
    landTimers = [];
    cancelAnimationFrame(countRaf);
    root.querySelectorAll<HTMLElement>('.pb-piece.is-land').forEach((p) => {
      p.classList.remove('is-land');
      p.style.removeProperty('height');
    });
  };
  // O número grande conta do valor de antes até ao de depois (só quando faz sentido: "4 h" → "0 h", "6 dias" → "0").
  const countUp = () => {
    const el = metrics[current]?.querySelector<HTMLElement>('[data-pb-count]');
    if (!el) return;
    const toText = el.dataset.to ?? '';
    const from = /^(\d+)\s*(.*)$/.exec(el.dataset.from ?? '');
    const to = /^(\d+)\s*(.*)$/.exec(toText);
    const a = Number(from?.[1]);
    const b = Number(to?.[1]);
    const unit = from?.[2] ?? '';
    if (!from || !to || a > 100 || b >= a || (to[2] !== unit && to[2] !== '')) {
      el.textContent = toText;
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 700);
      const n = Math.round(a + (b - a) * (1 - (1 - t) ** 3));
      el.textContent = t >= 1 ? toText : `${n}${unit ? ` ${unit}` : ''}`;
      if (t < 1) countRaf = requestAnimationFrame(step);
    };
    el.textContent = `${a}${unit ? ` ${unit}` : ''}`;
    countRaf = requestAnimationFrame(step);
  };
  const setBefore = (before: boolean) => {
    clearLand();
    modes.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.pbMode === 'before') === before)));
    if (before) {
      stage.classList.add('is-before', 'is-pending');
      stage.classList.remove('is-working');
      // Só a cena atual: a que está a sair fica arrumada enquanto desvanece.
      (pieces[current] ?? []).forEach((p) => {
        p.classList.remove('is-land');
        p.style.removeProperty('height');
        p.classList.add('is-b');
      });
      return;
    }
    stage.classList.remove('is-before'); // as peças começam a viajar (CSS, uma de cada vez)
    const ps = pieces[current] ?? [];
    pieces.forEach((list, n) => n !== current && list.forEach((p) => p.classList.remove('is-b')));
    if (!motion) {
      ps.forEach((p) => p.classList.remove('is-b'));
      stage.classList.remove('is-pending', 'is-working');
      return;
    }
    // Cada peça troca de aspeto e de texto quando chega ao lugar; a altura passa da antiga à nova com
    // transição (FLIP: mede antes e depois, fixa a antiga e deixa o CSS animar até à nova).
    const land = (p: HTMLElement) => {
      const h0 = p.offsetHeight;
      p.classList.remove('is-b');
      const h1 = p.offsetHeight;
      if (Math.abs(h1 - h0) < 2) return;
      p.classList.add('is-land');
      p.style.height = `${h0}px`;
      void p.offsetHeight;
      p.style.height = `${h1}px`;
      landTimers.push(
        window.setTimeout(() => {
          p.classList.remove('is-land');
          p.style.removeProperty('height');
        }, 340),
      );
    };
    let last = 0;
    ps.forEach((p) => {
      const d = Number(p.style.getPropertyValue('--d')) || 0;
      const at = LEAD_MS + d * GAP_MS + MOVE_MS * 0.8;
      last = Math.max(last, at);
      landTimers.push(window.setTimeout(() => land(p), at));
    });
    const work = last + 200;
    stage.style.setProperty('--work', `${work}ms`);
    stage.classList.add('is-working');
    landTimers.push(
      window.setTimeout(() => {
        stage.classList.remove('is-working', 'is-pending');
        countUp();
      }, work),
    );
  };
  // A cena nova aparece já desarrumada (estava escondida, por isso não anima) e arruma-se pouco depois.
  const play = () => {
    window.clearTimeout(tidyTimer);
    if (!motion) return setBefore(false);
    setBefore(true);
    tidyTimer = window.setTimeout(() => setBefore(false), MESS_MS);
  };

  const halted = () => paused || offscreen;
  const tick = () => {
    window.clearTimeout(stepTimer);
    root.classList.toggle('is-paused', halted());
    if (!motion || halted()) return;
    stepStart = performance.now();
    stepTimer = window.setTimeout(() => go(current + 1), stepLeft);
  };
  const go = (i: number, drop = false) => {
    started = true;
    stage.classList.remove('is-wait');
    show(i, drop);
    play();
    stepLeft = STEP_MS;
    const item = items[current];
    if (item) {
      void item.offsetWidth; // recomeça a linha do tempo
      item.classList.add('is-run');
    }
    tick();
  };
  const hold = () => {
    if (stepTimer) stepLeft = Math.max(0, stepLeft - (performance.now() - stepStart));
    window.clearTimeout(stepTimer);
    stepTimer = 0;
    root.classList.add('is-paused');
  };
  const setPaused = (p: boolean) => {
    paused = p;
    root.classList.toggle('is-stopped', p);
    pauseBtn?.setAttribute('aria-pressed', String(p));
    if (pauseLabel) pauseLabel.textContent = p ? 'Retomar a passagem automática' : 'Pausar a passagem automática';
    if (p) return hold();
    stepLeft = STEP_MS; // ao retomar, o problema atual tem o tempo todo
    const item = items[current];
    item?.classList.remove('is-run');
    if (item) void item.offsetWidth;
    item?.classList.add('is-run');
    tick();
  };

  items.forEach((b, n) => b.addEventListener('click', () => (motion && !paused ? go(n) : (show(n), play()))));
  modes.forEach((b) =>
    b.addEventListener('click', () => {
      window.clearTimeout(tidyTimer);
      if (motion) setPaused(true);
      setBefore(b.dataset.pbMode === 'before');
    }),
  );
  pauseBtn?.addEventListener('click', () => setPaused(!paused));
  if (!motion) return;

  // Começa vazio (as peças caem quando a secção aparece); a passagem arranca aí e pára quando sai do ecrã.
  setBefore(true);
  stage.classList.add('is-wait');
  new IntersectionObserver(
    ([entry]) => {
      const visible = !!entry?.isIntersecting;
      if (visible === !offscreen) return;
      offscreen = !visible;
      if (!visible) return hold();
      if (!started) {
        started = true;
        return go(current, true);
      }
      tick();
    },
    { threshold: 0.4 },
  ).observe(stage);
}

initReveal();
// 5. Compromissos: quando a folha aparece, as cláusulas recebem o visto uma a uma (tempos no CSS). Corre uma vez.
function initCommit() {
  const doc = document.querySelector<HTMLElement>('[data-cm]');
  if (!doc || !motion) return;
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting) return;
      io.disconnect();
      doc.classList.add('is-on');
    },
    { threshold: 0.25 },
  );
  io.observe(doc);
}

initFlow();
initCommit();
initHero();
initProblems();
