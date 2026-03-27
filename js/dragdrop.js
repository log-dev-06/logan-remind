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

  /* ─── Shared drag state ──────────────────────────────────────────────── */
  let draggingCard   = null;  // { el, colId, index }
  let draggingCol    = null;  // { el, index }
  let touchGhost     = null;  // cloned element following finger
  let longPressTimer = null;
  let touchStartPos  = null;
  let isDragging     = false;

  /* ═══════════════════════════════════════════════════════════════════════
     MOUSE — HTML5 Drag API
  ═══════════════════════════════════════════════════════════════════════ */

  board.addEventListener('dragstart', e => {
    const cardEl = e.target.closest('.card');
    const colEl  = e.target.closest('[data-col-drag-handle]')?.closest('.column');

    if (cardEl) {
      draggingCard = {
        el:    cardEl,
        colId: cardEl.closest('.cards-list').dataset.colId,
        index: [...cardEl.closest('.cards-list').children].indexOf(cardEl),
      };
      cardEl.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    } else if (colEl) {
      draggingCol = {
        el:    colEl,
        index: [...board.querySelectorAll('.column')].indexOf(colEl),
      };
      colEl.classList.add('col-dragging');
      e.dataTransfer.effectAllowed = 'move';
    }
  });

  board.addEventListener('dragend', () => {
    draggingCard?.el.classList.remove('dragging');
    draggingCol?.el.classList.remove('col-dragging');
    document.querySelectorAll('.drag-over, .col-drag-over').forEach(el => {
      el.classList.remove('drag-over', 'col-drag-over');
    });
    draggingCard = null;
    draggingCol  = null;
  });

  board.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggingCard) {
      const list = e.target.closest('.cards-list');
      if (list) {
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        list.classList.add('drag-over');
      }
    } else if (draggingCol) {
      const col = e.target.closest('.column');
      if (col && col !== draggingCol.el) {
        document.querySelectorAll('.col-drag-over').forEach(el => el.classList.remove('col-drag-over'));
        col.classList.add('col-drag-over');
      }
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

    if (draggingCard) {
      const toList = e.target.closest('.cards-list');
      if (!toList) return;
      const toColId = toList.dataset.colId;
      const cards   = [...toList.querySelectorAll('.card')];
      // Find drop position by cursor Y
      const toIndex = getInsertIndex(cards, e.clientY);
      onCardMove({
        fromColId: draggingCard.colId,
        toColId,
        fromIndex: draggingCard.index,
        toIndex,
      });

    } else if (draggingCol) {
      const toCol = e.target.closest('.column');
      if (!toCol || toCol === draggingCol.el) return;
      const cols    = [...board.querySelectorAll('.column')];
      const toIndex = cols.indexOf(toCol);
      onColumnMove({ fromIndex: draggingCol.index, toIndex });
    }
  });

  board.addEventListener('dragend', cleanup);

  /* ════════════════════════════════════════════════════════════
     MOBILE — touch events (long-press to drag)
  ════════════════════════════════════════════════════════════ */

  let touchClone   = null;
  let touchOffsetX = 0;
  let touchOffsetY = 0;
  // let longPressTimer = null;
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

   /* ═══════════════════════════════════════════════════════════════════════
     TOUCH — Pointer events with long-press trigger
  ═══════════════════════════════════════════════════════════════════════ */

  const LONG_PRESS_MS  = 400;  // how long to hold before drag starts
  const MOVE_THRESHOLD = 6;    // px of movement that cancels long-press

  board.addEventListener('pointerdown', e => {
    // Only respond to touch/stylus, not mouse (mouse handled by HTML5 drag)
    if (e.pointerType === 'mouse') return;

    const cardEl   = e.target.closest('.card');
    const handleEl = e.target.closest('[data-col-drag-handle]');
    const colEl    = handleEl?.closest('.column');

    if (!cardEl && !colEl) return;

    touchStartPos = { x: e.clientX, y: e.clientY };

    longPressTimer = setTimeout(() => {
      isDragging = true;
      if (cardEl) beginCardTouch(cardEl, e);
      else if (colEl) beginColTouch(colEl, e);
    }, LONG_PRESS_MS);
  }, { passive: true });

  board.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') return;

    // Cancel long-press if finger moved too much before timer fires
    if (!isDragging && touchStartPos) {
      const dx = Math.abs(e.clientX - touchStartPos.x);
      const dy = Math.abs(e.clientY - touchStartPos.y);
      if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
        clearTimeout(longPressTimer);
        touchStartPos = null;
      }
      return;
    }

    if (!isDragging) return;
    e.preventDefault();
    moveTouchGhost(e.clientX, e.clientY);

    if (draggingCard) updateCardDropTarget(e.clientX, e.clientY);
    else if (draggingCol) updateColDropTarget(e.clientX, e.clientY);
  }, { passive: false });

  const endTouch = e => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(longPressTimer);
    touchStartPos = null;

    if (!isDragging) return;
    isDragging = false;

    removeTouchGhost();

    if (draggingCard) commitCardTouch(e.clientX, e.clientY);
    else if (draggingCol) commitColTouch(e.clientX, e.clientY);

    document.querySelectorAll('.drag-over, .col-drag-over, .dragging, .col-dragging')
      .forEach(el => el.classList.remove('drag-over', 'col-drag-over', 'dragging', 'col-dragging'));

    draggingCard = null;
    draggingCol  = null;
  };

  board.addEventListener('pointerup',     endTouch);
  board.addEventListener('pointercancel', endTouch);

  /* ─── Touch ghost (visual drag proxy) ───────────────────────────────── */

  function beginCardTouch(cardEl, e) {
    draggingCard = {
      el:    cardEl,
      colId: cardEl.closest('.cards-list').dataset.colId,
      index: [...cardEl.closest('.cards-list').children].indexOf(cardEl),
    };
    cardEl.classList.add('dragging');
    spawnGhost(cardEl, e.clientX, e.clientY);
    // Haptic feedback if available
    navigator.vibrate?.(30);
  }

  function beginColTouch(colEl, e) {
    draggingCol = {
      el:    colEl,
      index: [...board.querySelectorAll('.column')].indexOf(colEl),
    };
    colEl.classList.add('col-dragging');
    spawnGhost(colEl, e.clientX, e.clientY, 0.55);
    navigator.vibrate?.(30);
  }

  function spawnGhost(sourceEl, x, y, scale = 0.92) {
    touchGhost = sourceEl.cloneNode(true);
    const rect = sourceEl.getBoundingClientRect();
    Object.assign(touchGhost.style, {
      position:        'fixed',
      top:             `${rect.top}px`,
      left:            `${rect.left}px`,
      width:           `${rect.width}px`,
      height:          `${rect.height}px`,
      pointerEvents:   'none',
      zIndex:          '999',
      opacity:         '0.85',
      transform:       `scale(${scale})`,
      transformOrigin: 'top left',
      transition:      'transform 150ms ease',
      borderRadius:    getComputedStyle(sourceEl).borderRadius,
      boxShadow:       '0 12px 40px rgba(0,0,0,0.5)',
    });
    document.body.appendChild(touchGhost);
    // Offset so ghost spawns at finger position
    touchGhost._offsetX = x - rect.left;
    touchGhost._offsetY = y - rect.top;
  }

  function moveTouchGhost(x, y) {
    if (!touchGhost) return;
    touchGhost.style.left = `${x - touchGhost._offsetX}px`;
    touchGhost.style.top  = `${y - touchGhost._offsetY}px`;
  }

  function removeTouchGhost() {
    touchGhost?.remove();
    touchGhost = null;
  }

  /* ─── Touch drop-target tracking ────────────────────────────────────── */

  function updateCardDropTarget(x, y) {
    // Temporarily hide ghost so elementFromPoint works
    touchGhost.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    touchGhost.style.display = '';

    const list = el?.closest('.cards-list');
    document.querySelectorAll('.drag-over').forEach(e => e.classList.remove('drag-over'));
    if (list) list.classList.add('drag-over');
  }

  function updateColDropTarget(x, y) {
    touchGhost.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    touchGhost.style.display = '';

    const col = el?.closest('.column');
    document.querySelectorAll('.col-drag-over').forEach(e => e.classList.remove('col-drag-over'));
    if (col && col !== draggingCol.el) col.classList.add('col-drag-over');
  }

  function commitCardTouch(x, y) {
    touchGhost && (touchGhost.style.display = 'none');
    const el    = document.elementFromPoint(x, y);
    touchGhost && (touchGhost.style.display = '');
    const toList = el?.closest('.cards-list');
    if (!toList) return;

    const toColId = toList.dataset.colId;
    const cards   = [...toList.querySelectorAll('.card:not(.dragging)')];
    const toIndex = getInsertIndex(cards, y);

    onCardMove({
      fromColId: draggingCard.colId,
      toColId,
      fromIndex: draggingCard.index,
      toIndex,
    });
  }

  function commitColTouch(x, y) {
    touchGhost && (touchGhost.style.display = 'none');
    const el    = document.elementFromPoint(x, y);
    touchGhost && (touchGhost.style.display = '');
    const toCol = el?.closest('.column');
    if (!toCol || toCol === draggingCol.el) return;

    const cols    = [...board.querySelectorAll('.column')];
    const toIndex = cols.indexOf(toCol);
    onColumnMove({ fromIndex: draggingCol.index, toIndex });
  }

  /* ─── Utility ────────────────────────────────────────────────────────── */

  function getInsertIndex(cards, clientY) {
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return cards.length;
  }
}

