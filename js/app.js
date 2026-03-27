/**
 * app.js — Application entry point
 *
 * Wires together: storage ↔ board logic ↔ UI ↔ drag-drop ↔ list view
 *
 * Data flow:
 *   User action → update board state (board.js) → save (storage.js) → re-render (ui.js | listview.js)
 */

import { loadBoard, saveBoard } from './storage.js';
import { addCard, updateCard, deleteCard, moveCard, addColumn, deleteColumn, renameColumn, reorderColumns, filterBoard } from './board.js';
import { renderBoard, openCardModal } from './ui.js';
import { renderList } from './listview.js';
import { initDragDrop } from './dragdrop.js';

/* ─── State ──────────────────────────────────────────────────────────────── */

let board       = null;   // source-of-truth board object
let searchQuery = '';
let viewMode    = localStorage.getItem('kanban_view') || 'board'; // 'board' | 'list'

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function render() {
  const viewBoard = filterBoard(board, searchQuery);
  const wrapper   = document.getElementById('board-wrapper');
  const boardEl   = document.getElementById('board');

  // Toggle wrapper scroll behaviour per mode
  wrapper.dataset.view = viewMode;
  boardEl.classList.toggle('list-mode', viewMode === 'list');

  // Sync toggle button state
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewMode);
  });

  const handlers = {
    onAddCard:      handleAddCard,
    onEditCard:     handleEditCard,
    onDeleteCard:   handleDeleteCard,
    onAddColumn:    handleAddColumn,
    onDeleteColumn: handleDeleteColumn,
    onRenameColumn: handleRenameColumn,
  };

  if (viewMode === 'list') {
    renderList(viewBoard, handlers);
  } else {
    renderBoard(viewBoard, handlers);
  }
}

async function commit(newBoard) {
  board = newBoard;
  await saveBoard(board);
  render();
}

/* ─── Card handlers ──────────────────────────────────────────────────────── */

function handleAddCard(colId) {
  const col = board.columns.find(c => c.id === colId);
  openCardModal({
    card: {},
    columnId: colId,
    columnTitle: col.title,
    columns: board.columns,
    onSave: patch => {
      const targetColId = patch.columnId || colId;
      commit(addCard(board, targetColId, patch));
    },
    onDelete: () => {},
  });
}

function handleEditCard(cardId) {
  let card, col;
  for (const c of board.columns) {
    const found = c.cards.find(ca => ca.id === cardId);
    if (found) { card = found; col = c; break; }
  }
  if (!card) return;

  openCardModal({
    card,
    columnId: col.id,
    columnTitle: col.title,
    columns: board.columns,
    onSave: patch => {
      let updated = updateCard(board, cardId, patch);
      if (patch.columnId && patch.columnId !== col.id) {
        const fromColCards = updated.columns.find(c => c.id === col.id)?.cards || [];
        const fromIndex = fromColCards.findIndex(ca => ca.id === cardId);
        const toCol = updated.columns.find(c => c.id === patch.columnId);
        const toIndex = toCol ? toCol.cards.length : 0;
        updated = moveCard(updated, { fromColId: col.id, toColId: patch.columnId, fromIndex, toIndex });
      }
      commit(updated);
    },
    onDelete: () => commit(deleteCard(board, cardId)),
  });
}

function handleDeleteCard(cardId) {
  commit(deleteCard(board, cardId));
}

/* ─── Column handlers ────────────────────────────────────────────────────── */

function handleAddColumn() {
  if (viewMode === 'list') {
    // In list view: append input inside the toolbar's add-column button area
    const addColBtn = document.querySelector('.lv-add-col-btn');
    if (!addColBtn || document.querySelector('.lv-new-col-input')) return;

    // Hide the button, insert an inline input next to it
    addColBtn.style.display = 'none';

    const wrap = document.createElement('div');
    wrap.className = 'lv-new-col-input';
    wrap.innerHTML = `
      <input type="text" placeholder="Column name…" maxlength="50" />
      <button class="btn btn-primary lv-new-col-confirm">Add</button>
      <button class="btn btn-ghost lv-new-col-cancel">✕</button>
    `;
    addColBtn.parentElement.appendChild(wrap);

    const input = wrap.querySelector('input');
    input.focus();

    const cleanup = () => {
      wrap.remove();
      addColBtn.style.display = '';
    };

    const confirm_ = () => {
      const title = input.value.trim();
      if (title) commit(addColumn(board, title));
      else cleanup();
    };

    wrap.querySelector('.lv-new-col-confirm').addEventListener('click', confirm_);
    wrap.querySelector('.lv-new-col-cancel').addEventListener('click', cleanup);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  confirm_();
      if (e.key === 'Escape') cleanup();
    });
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!wrap.contains(e.target) && e.target !== addColBtn) {
          cleanup();
          document.removeEventListener('click', handler);
        }
      });
    }, 0);

  } else {
    // Board view: inline column at end of board
    const boardEl   = document.getElementById('board');
    const addColBtn = boardEl.querySelector('.add-col-btn');
    if (boardEl.querySelector('.new-col-input-wrap')) return;

    const wrap = document.createElement('div');
    wrap.className = 'new-col-input-wrap';
    wrap.innerHTML = `
      <input class="new-col-input" type="text" placeholder="Column name…" maxlength="50" />
      <div class="new-col-actions">
        <button class="btn btn-primary new-col-confirm">Add column</button>
        <button class="new-col-cancel btn btn-ghost">✕</button>
      </div>
    `;
    boardEl.insertBefore(wrap, addColBtn);

    const input = wrap.querySelector('.new-col-input');
    input.focus();

    const cleanup = () => wrap.remove();
    const confirm_ = () => {
      const title = input.value.trim();
      if (title) commit(addColumn(board, title));
      else cleanup();
    };

    wrap.querySelector('.new-col-confirm').addEventListener('click', confirm_);
    wrap.querySelector('.new-col-cancel').addEventListener('click', cleanup);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  confirm_();
      if (e.key === 'Escape') cleanup();
    });
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!wrap.contains(e.target)) {
          cleanup();
          document.removeEventListener('click', handler);
        }
      });
    }, 0);
  }
}

function handleDeleteColumn(colId) {
  commit(deleteColumn(board, colId));
}

function handleRenameColumn(colId, newTitle) {
  commit(renameColumn(board, colId, newTitle));
}

/* ─── View toggle ────────────────────────────────────────────────────────── */

document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    viewMode = btn.dataset.view;
    localStorage.setItem('kanban_view', viewMode);
    render();
  });
});

/* ─── Search ─────────────────────────────────────────────────────────────── */

document.getElementById('search').addEventListener('input', e => {
  searchQuery = e.target.value;
  render();
});

/* ─── Boot ───────────────────────────────────────────────────────────────── */

(async () => {
  board = await loadBoard();

  initDragDrop({
    onCardMove:   move                    => commit(moveCard(board, move)),
    onColumnMove: ({ fromIndex, toIndex }) => commit(reorderColumns(board, fromIndex, toIndex)),
  });

  render();
})();