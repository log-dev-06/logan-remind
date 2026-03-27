/**
 * dragdrop.js — Drag-and-drop wiring
 *
 * Desktop: native HTML5 Drag & Drop API
 * Mobile:  touch events with long-press to drag + auto-scroll
 *
 * Calls back into app.js via the provided handlers.
 */

let dragState = null;

export function initDragDrop({ onCardMove, onColumnMove }) {
  const board = document.getElementById('board');

  /* ════════════════════════════════════════════════════════════
     DESKTOP — native HTML5 drag & drop
  ════════════════════════════════════════════════════════════ */

  board.addEventListener('dragstart', e => {
    const card = e.target.closest('[data-card-id]');
    const col  = e.target.closest('[data-col-drag-handle]');

    if (card) {
      const colEl = card.closest('[data-col-id]');
      dragState = {
        type: 'card',
        cardId: card.dataset.cardId,
        fromColId: colEl.dataset.colId,
        fromIndex: [...colEl.querySelectorAll('[data-card-id]')].indexOf(card),
      };
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    } else if (col) {
      const colEl = col.closest('[data-col-id]');
      dragState = {
        type: 'column',
        colId: colEl.dataset.colId,
        fromIndex: [...document.querySelectorAll('[data-col-id]')].indexOf(colEl),
      };
      colEl.classList.add('col-dragging');
      e.dataTransfer.effectAllowed = 'move';
    }
  });

  board.addEventListener('dragover', e => {
    e.preventDefault();
    if (!dragState) return;

    if (dragState.type === 'card') {
      const dropZone = e.target.closest('[data-col-id]');
      document.querySelectorAll('.cards-list').forEach(c => c.classList.remove('drag-over'));
      if (dropZone) dropZone.querySelector('.cards-list')?.classList.add('drag-over');
    }

    if (dragState.type === 'column') {
      const targetCol = e.target.closest('[data-col-id]');
      document.querySelectorAll('[data-col-id]').forEach(c => c.classList.remove('col-drag-over'));
      if (targetCol && targetCol.dataset.colId !== dragState.colId) {
        targetCol.classList.add('col-drag-over');
      }
    }
  });

  board.addEventListener('drop', e => {
    e.preventDefault();
    if (!dragState) return;

    if (dragState.type === 'card') {
      const toColEl = e.target.closest('[data-col-id]');
      if (!toColEl) return cleanup();

      const toColId    = toColEl.dataset.colId;
      const cardEls    = [...toColEl.querySelectorAll('[data-card-id]')];
      const targetCard = e.target.closest('[data-card-id]');
      const toIndex    = targetCard ? cardEls.indexOf(targetCard) : cardEls.length;

      onCardMove({
        fromColId: dragState.fromColId,
        toColId,
        fromIndex: dragState.fromIndex,
        toIndex: toIndex < 0 ? cardEls.length : toIndex,
      });
    }

    if (dragState.type === 'column') {
      const targetCol = e.target.closest('[data-col-id]');
      if (!targetCol || targetCol.dataset.colId === dragState.colId) return cleanup();

      const colEls  = [...document.querySelectorAll('[data-col-id]')];
      const toIndex = colEls.indexOf(targetCol);
      onColumnMove({ fromIndex: dragState.fromIndex, toIndex });
    }

    cleanup();
  });

  board.addEventListener('dragend', cleanup);

  /* ════════════════════════════════════════════════════════════
     MOBILE — touch events (long-press to drag)
  ════════════════════════════════════════════════════════════ */

  let touchClone   = null;
  let touchOffsetX = 0;
  let touchOffsetY = 0;
  let longPressTimer = null;
  let autoScrollId   = null;

  board.addEventListener('touchstart', e => {
    const card = e.target.closest('[data-card-id]');
    if (!card) return;

    const touch  = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;

    longPressTimer = setTimeout(() => {
      const colEl = card.closest('[data-col-id]');
      dragState = {
        type: 'card',
        cardId:    card.dataset.cardId,
        fromColId: colEl.dataset.colId,
        fromIndex: [...colEl.querySelectorAll('[data-card-id]')].indexOf(card),
        touchActive: true,
      };

      const rect = card.getBoundingClientRect();
      touchOffsetX = startX - rect.left;
      touchOffsetY = startY - rect.top;

      // Ghost clone
      touchClone = card.cloneNode(true);
      Object.assign(touchClone.style, {
        position: 'fixed',
        left:     `${rect.left}px`,
        top:      `${rect.top}px`,
        width:    `${rect.width}px`,
        margin:   '0',
        opacity:  '0.88',
        zIndex:   '999',
        pointerEvents: 'none',
        transform: 'scale(1.05) rotate(1deg)',
        boxShadow: '0 10px 40px rgba(0,0,0,.55)',
        transition: 'none',
        borderRadius: '8px',
      });
      document.body.appendChild(touchClone);
      card.classList.add('dragging');
      navigator.vibrate?.(25);
    }, 320);

    // Cancel long-press if finger moved significantly before timer fires
    const cancelIfMoved = ev => {
      const t = ev.touches[0];
      if (Math.abs(t.clientX - startX) > 6 || Math.abs(t.clientY - startY) > 6) {
        clearTimeout(longPressTimer);
      }
    };
    const cancelFull = () => clearTimeout(longPressTimer);
    card.addEventListener('touchmove',   cancelIfMoved, { once: true, passive: true });
    card.addEventListener('touchend',    cancelFull,    { once: true });
    card.addEventListener('touchcancel', cancelFull,    { once: true });
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!dragState?.touchActive) return;
    e.preventDefault();

    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    if (touchClone) {
      touchClone.style.left = `${x - touchOffsetX}px`;
      touchClone.style.top  = `${y - touchOffsetY}px`;
    }

    // Highlight target column
    document.querySelectorAll('.cards-list').forEach(cl => cl.classList.remove('drag-over'));
    const el = document.elementFromPoint(x, y);
    if (el) {
      el.closest('[data-col-id]')?.querySelector('.cards-list')?.classList.add('drag-over');
    }

    // Auto-scroll board wrapper near horizontal edges
    const wrapper = document.getElementById('board-wrapper');
    const wRect   = wrapper.getBoundingClientRect();
    const EDGE    = 56;
    clearInterval(autoScrollId);
    if (x < wRect.left + EDGE) {
      autoScrollId = setInterval(() => { wrapper.scrollLeft -= 8; }, 16);
    } else if (x > wRect.right - EDGE) {
      autoScrollId = setInterval(() => { wrapper.scrollLeft += 8; }, 16);
    }

  }, { passive: false });

  document.addEventListener('touchend', e => {
    clearTimeout(longPressTimer);
    if (!dragState?.touchActive) return;
    clearInterval(autoScrollId);

    const touch   = e.changedTouches[0];
    const el      = document.elementFromPoint(touch.clientX, touch.clientY);
    const toColEl = el?.closest('[data-col-id]');

    if (toColEl) {
      const toColId = toColEl.dataset.colId;
      const cardEls = [...toColEl.querySelectorAll('[data-card-id]:not(.dragging)')];
      let toIndex   = cardEls.length;
      for (let i = 0; i < cardEls.length; i++) {
        const r = cardEls[i].getBoundingClientRect();
        if (touch.clientY < r.top + r.height / 2) { toIndex = i; break; }
      }
      onCardMove({ fromColId: dragState.fromColId, toColId, fromIndex: dragState.fromIndex, toIndex });
    }

    cleanupTouch();
    cleanup();
  }, { passive: true });

  document.addEventListener('touchcancel', () => {
    clearTimeout(longPressTimer);
    clearInterval(autoScrollId);
    cleanupTouch();
    cleanup();
  }, { passive: true });

  /* ── Shared cleanup ────────────────────────────────────────────────────── */

  function cleanup() {
    document.querySelectorAll('.dragging, .col-dragging, .col-drag-over')
      .forEach(el => el.classList.remove('dragging', 'col-dragging', 'col-drag-over'));
    document.querySelectorAll('.drag-over')
      .forEach(el => el.classList.remove('drag-over'));
    dragState = null;
  }

  function cleanupTouch() {
    touchClone?.remove();
    touchClone = null;
  }
}
