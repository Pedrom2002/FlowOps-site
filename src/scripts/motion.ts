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

  // Separadores: cada um mostra a página com o mesmo índice (.hp-view) e fica destacado.
  const openView = (scene: HTMLElement, i: number) => {
    const views = [...scene.querySelectorAll<HTMLElement>('.hp-view')];
    const view = views[i];
    if (!view || !view.hidden) return;
    views.forEach((v, n) => {
      v.hidden = n !== i;
      v.classList.remove('is-in');
    });
    toastEl?.classList.remove('is-on');
    void view.offsetWidth; // recomeça a animação de entrada
    view.classList.add('is-in');
    scene.querySelectorAll('.hp-tabs [data-hp="tab"]').forEach((t, n) => t.classList.toggle('on', n === i));
  };

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
      // A próxima sessão no separador Início passa a ser a que acabou de marcar.
      const next = scene.querySelector('[data-hp-next]');
      const nb = next?.querySelector('b');
      const ns = next?.querySelector('small');
      if (nb) nb.textContent = `${weekdays[Number(day?.dataset.wd)]}-feira, ${day?.textContent} nov`;
      if (ns) ns.textContent = `${time}, fisioterapia, 50 min`;
      toast(`Marcado: ${weekdays[Number(day?.dataset.wd)]!.toLowerCase()}, dia ${day?.textContent}, às ${time}.`);
    },
    tab: (el, scene) => openView(scene, [...(el.parentElement?.children ?? [])].indexOf(el)),
    goto: (el, scene) => openView(scene, Number(el.dataset.to)),
    send: (el, scene) => {
      const chat = scene.querySelector('[data-hp-chat]');
      if (!chat || el.classList.contains('is-done')) return;
      el.classList.add('is-done');
      const say = (text: string, out: boolean) => {
        const m = document.createElement('p');
        m.className = `hp-msg is-new${out ? ' out' : ''}`;
        m.textContent = text;
        chat.append(m);
      };
      say('Combinado, até amanhã.', true);
      window.setTimeout(() => say('Até amanhã. Bom resto de dia.', false), 900);
    },
    filter: (el, scene) => {
      pick(el, '[data-hp="filter"]');
      const f = el.dataset.f;
      const rows = [...scene.querySelectorAll<HTMLElement>('[data-hp-cars] .hp-row')];
      rows.forEach((r) => (r.hidden = !!f && r.dataset.st !== f));
      const shown = rows.filter((r) => !r.hidden);
      rows.forEach((r) => r.classList.toggle('first', r === shown[0]));
      const count = scene.querySelector('[data-hp-count]');
      if (count) count.textContent = f ? `${shown.length} de ${rows.length} viaturas` : `${rows.length} viaturas na oficina hoje`;
    },
    read: (el) => el.classList.remove('unread'),
    fix: (el) => {
      const row = el.closest('.hp-row');
      if (!row) return;
      row.classList.remove('hp-alert');
      const b = row.querySelector('b');
      const small = row.querySelector('small');
      if (b) b.textContent = 'SMS reenviado';
      if (small) small.innerHTML = 'Número corrigido na ficha da <span class="hp-nb">09-ZH-44</span>.';
      el.removeAttribute('data-hp');
      el.className = 'ok';
      el.textContent = 'Resolvido';
      toast('SMS reenviado ao cliente.');
    },
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

// 5. O que fazemos: separadores (padrão ARIA tabs). Clicar num serviço, ou usar as setas/Home/End, abre o
// painel desse serviço. O vídeo de cada painel (initFilms) recebe os eventos sv-open e sv-close.
function initServices() {
  const root = document.querySelector<HTMLElement>('[data-sv]');
  if (!root) return;
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-sv-tab]')];
  const panels = [...root.querySelectorAll<HTMLElement>('[data-sv-panel]')];
  let current = Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'));

  const select = (i: number, focus = false) => {
    const next = (i + tabs.length) % tabs.length;
    const tab = tabs[next];
    const panel = panels[next];
    if (!tab || !panel) return;
    tabs.forEach((t, n) => {
      t.setAttribute('aria-selected', String(n === next));
      t.tabIndex = n === next ? 0 : -1;
    });
    panels.forEach((p, n) => {
      const was = !p.hidden;
      p.hidden = n !== next;
      // Avisa o conteúdo do painel (ex.: o vídeo do website) de que abriu ou fechou.
      if (n === next && (!was || next !== current)) p.dispatchEvent(new CustomEvent('sv-open'));
      if (n !== next && was) p.dispatchEvent(new CustomEvent('sv-close'));
    });
    if (focus) tab.focus();
    // Em ecrãs estreitos a barra tem scroll horizontal: mantém o separador escolhido à vista.
    const bar = tab.parentElement;
    if (bar && bar.scrollWidth > bar.clientWidth) {
      bar.scrollTo({ left: tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2, behavior: motion ? 'smooth' : 'auto' });
    }
    if (next !== current && motion) {
      panel.classList.remove('sv-enter');
      void panel.offsetWidth;
      panel.classList.add('sv-enter');
    }
    current = next;
  };

  tabs.forEach((t, n) => t.addEventListener('click', () => select(n)));
  tabs[0]?.parentElement?.addEventListener('keydown', (e) => {
    const keys: Record<string, number> = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: tabs.length - 1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    select(keys[e.key]!, true);
  });
}

// 6. "Vídeos" dos serviços ([data-film]: WebsiteFilm, AppFilm, ...): etapas com duração em data-durations e classes
// cumulativas at-1..at-N no próprio elemento. Começa quando o painel aparece no ecrã ou é aberto, toca uma vez e
// pára no resultado final. Botão de pausa/reproduzir/ver de novo e botões por etapa (FilmControls.astro). Sem
// movimento, fica no resultado final e os botões mudam de etapa sem animação.
function initFilms() {
  document.querySelectorAll<HTMLElement>('[data-film]').forEach(initFilm);
}
function initFilm(film: HTMLElement) {
  const durations = (film.dataset.durations ?? '').split(',').map(Number);
  const last = durations.length - 1;
  const chapters = [...film.querySelectorAll<HTMLButtonElement>('[data-film-ch]')];
  const fills = chapters.map((c) => c.querySelector<HTMLElement>('.film-fill'));
  const caps = [...film.querySelectorAll<HTMLElement>('[data-film-cap]')];
  const caption = film.querySelector<HTMLElement>('[data-film-caption]');
  const btn = film.querySelector<HTMLButtonElement>('[data-film-play]');
  const panel = film.closest<HTMLElement>('[data-sv-panel]');
  let step = last;
  let t = durations[last] ?? 0; // ms já passados na etapa atual
  let state: 'playing' | 'paused' | 'ended' = 'ended';
  let userPaused = false;
  let visible = false;
  let frame = 0;
  let prev = 0;

  const paintFills = () =>
    fills.forEach((f, n) => f?.style.setProperty('--p', String(n < step ? 1 : n > step ? 0 : Math.min(1, t / (durations[n] || 1)))));
  const render = () => {
    film.dataset.step = String(step);
    for (let k = 1; k <= last; k++) film.classList.toggle(`at-${k}`, step >= k);
    chapters.forEach((c, n) => (n === step ? c.setAttribute('aria-current', 'step') : c.removeAttribute('aria-current')));
    caps.forEach((c, n) => (c.hidden = n !== step));
    paintFills();
  };
  const setState = (s: typeof state) => {
    state = s;
    film.dataset.state = s;
    film.classList.toggle('is-paused', s !== 'playing');
    btn?.setAttribute('aria-label', s === 'playing' ? 'Pausar vídeo' : s === 'ended' ? 'Ver de novo' : 'Reproduzir vídeo');
  };
  const tick = (now: number) => {
    if (state !== 'playing') return;
    t += now - prev;
    prev = now;
    if (t >= (durations[step] ?? 0)) {
      if (step === last) {
        t = durations[last] ?? 0;
        paintFills();
        setState('ended');
        return;
      }
      step++;
      t = 0;
      render();
    } else paintFills();
    frame = requestAnimationFrame(tick);
  };
  const play = () => {
    if (!motion) return;
    if (state === 'ended') {
      step = 0;
      t = 0;
      render();
    }
    setState('playing');
    prev = performance.now();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  };
  const pause = () => {
    cancelAnimationFrame(frame);
    if (state === 'playing') setState('paused');
  };
  // Escolher uma etapa salta para ela e reproduz a partir daí (em pausa, as animações da etapa ficariam
  // congeladas no primeiro fotograma, ex.: as encomendas da última etapa não apareciam).
  const goTo = (i: number) => {
    step = i;
    t = 0;
    render();
    if (!motion) return;
    userPaused = false;
    if (state !== 'playing') setState('paused');
    play();
  };

  chapters.forEach((c, n) =>
    c.addEventListener('click', () => {
      if (caption) caption.setAttribute('aria-live', 'polite'); // a pessoa escolheu: anuncia a legenda
      goTo(n);
    }),
  );
  if (!motion) return;

  btn?.addEventListener('click', () => {
    if (state === 'playing') {
      userPaused = true;
      pause();
    } else {
      userPaused = false;
      play();
    }
  });
  // Começa no "antes"; arranca quando o painel está à vista, pausa quando sai do ecrã ou o painel fecha.
  step = 0;
  t = 0;
  render();
  setState('paused');
  new IntersectionObserver(
    ([entry]) => {
      visible = !!entry?.isIntersecting;
      if (!visible) pause();
      else if (state === 'paused' && !userPaused) play();
    },
    { threshold: 0.5 },
  ).observe(film);
  panel?.addEventListener('sv-open', () => {
    // Recomeça do início; o IntersectionObserver arranca-o quando o painel ficar à vista.
    userPaused = false;
    cancelAnimationFrame(frame);
    step = 0;
    t = 0;
    render();
    setState('paused');
    if (visible) play();
  });
  panel?.addEventListener('sv-close', pause);
}

initFlow();
initCommit();
initHero();
initProblems();
initServices();
initFilms();
