/**
 * ui.js — DOM rendering + modal
 */

const LABEL_COLORS = {
  research: '#6366f1',
  planning:  '#f59e0b',
  design:    '#8b5cf6',
  bug:       '#ef4444',
  feature:   '#10b981',
  review:    '#3b82f6',
};

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


/* ─── Board rendering ────────────────────────────────────────────────────── */

export function renderBoard(board, { onAddCard, onEditCard, onDeleteCard, onAddColumn, onDeleteColumn, onRenameColumn }) {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  board.columns.forEach(col => {
    boardEl.appendChild(renderColumn(col, { onAddCard, onEditCard, onDeleteCard, onDeleteColumn, onRenameColumn }));
  });
  const addColBtn = document.createElement('div');
  addColBtn.className = 'add-col-btn';
  addColBtn.innerHTML = `<span>+</span> Add column`;
  addColBtn.addEventListener('click', onAddColumn);
  boardEl.appendChild(addColBtn);
}

function renderColumn(col, handlers) {
  const el = document.createElement('div');
  el.className = 'column';
  el.dataset.colId = col.id;
  el.draggable = true;

  el.innerHTML = `
    <div class="col-header" style="--col-color:${col.color}">
      <div class="col-drag-handle" data-col-drag-handle title="Drag to reorder">
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
          <circle cx="4" cy="3"  r="1.5"/><circle cx="8" cy="3"  r="1.5"/>
          <circle cx="4" cy="8"  r="1.5"/><circle cx="8" cy="8"  r="1.5"/>
          <circle cx="4" cy="13" r="1.5"/><circle cx="8" cy="13" r="1.5"/>
        </svg>
      </div>
      <h2 class="col-title" title="Click to rename">${escHtml(col.title)}</h2>
      <span class="col-count">${col.cards.length}</span>
      <button class="col-menu-btn" title="Delete column">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
    <div class="cards-list" data-col-id="${col.id}">
      ${col.cards.map(card => renderCard(card)).join('')}
    </div>
    <button class="add-card-btn">+ Add a card</button>
  `;

  const title = el.querySelector('.col-title');
  title.addEventListener('dblclick', () => {
    const input = document.createElement('input');
    input.className = 'col-title-input';
    input.value = col.title;
    title.replaceWith(input);
    input.focus(); input.select();
    const commit = () => handlers.onRenameColumn(col.id, input.value.trim() || col.title);
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') handlers.onRenameColumn(col.id, col.title);
    });
  });

  el.querySelector('.col-menu-btn').addEventListener('click', () => {
    if (col.cards.length === 0 || confirm(`Delete "${col.title}" and its ${col.cards.length} card(s)?`))
      handlers.onDeleteColumn(col.id);
  });

  el.querySelector('.add-card-btn').addEventListener('click', () => handlers.onAddCard(col.id));

  el.querySelector('.cards-list').addEventListener('click', e => {
    const card = e.target.closest('[data-card-id]');
    if (!card) return;
    if (e.target.closest('.card-delete-btn')) handlers.onDeleteCard(card.dataset.cardId);
    else handlers.onEditCard(card.dataset.cardId);
  });

  return el;
}

function renderCard(card) {
  const labels = card.labels
    .map(l => `<span class="label" style="background:${LABEL_COLORS[l] || '#64748b'}">${escHtml(l)}</span>`)
    .join('');

  const desc = card.description
    ? `<p class="card-desc">${escHtml(card.description)}</p>`
    : '';

  // Checklist progress badge
  const cl = card.checklist || [];
  const done = cl.filter(i => i.checked).length;
  const allDone = cl.length > 0 && done === cl.length;
  const checklistBadge = cl.length > 0 ? `
    <div class="card-checklist-row">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <rect x="3" y="5" width="6" height="6" rx="1"/>
        <polyline points="4 8 6 10 9 6"/>
        <line x1="14" y1="8" x2="21" y2="8"/>
        <rect x="3" y="14" width="6" height="6" rx="1"/>
        <line x1="14" y1="17" x2="21" y2="17"/>
      </svg>
      <div class="card-checklist-track">
        <div class="card-checklist-fill${allDone ? ' card-checklist-fill--done' : ''}"
             style="width:${cl.length ? Math.round(done/cl.length*100) : 0}%"></div>
      </div>
      <span class="card-checklist-count${allDone ? ' card-checklist-count--done' : ''}">${done}/${cl.length}</span>
    </div>` : '';

  return `
    <div class="card" data-card-id="${card.id}" draggable="true">
      <div class="card-inner">
        ${labels ? `<div class="card-labels">${labels}</div>` : ''}
        <p class="card-title">${escHtml(card.title)}</p>
        ${desc}${checklistBadge}
      </div>
      <button class="card-delete-btn" title="Delete card">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `;
}

/* ─── Checklist editor ───────────────────────────────────────────────────── */

// Live checklist state while modal is open
let _checklist = []; // [{ text: string, checked: boolean }]

function syncChecklistUI() {
  const total  = _checklist.length;
  const done   = _checklist.filter(i => i.checked).length;
  const pct    = total ? Math.round(done / total * 100) : 0;
  const allDone = total > 0 && done === total;

  const progressEl = document.getElementById('checklist-progress');
  const barWrap    = document.getElementById('checklist-bar-wrap');
  const barFill    = document.getElementById('checklist-bar-fill');

  if (progressEl) progressEl.textContent = total ? `${done} / ${total}` : '';
  if (barWrap)    barWrap.style.display  = total ? '' : 'none';
  if (barFill) {
    barFill.style.width = `${pct}%`;
    barFill.className   = 'checklist-bar-fill' + (allDone ? ' checklist-bar-fill--done' : '');
  }
}

function renderChecklistItems() {
  const list = document.getElementById('checklist-items');
  if (!list) return;
  list.innerHTML = '';

  _checklist.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'cl-item' + (item.checked ? ' cl-item--done' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'cl-cb';
    cb.checked = item.checked;
    cb.addEventListener('change', () => {
      _checklist[idx].checked = cb.checked;
      li.classList.toggle('cl-item--done', cb.checked);
      inp.classList.toggle('cl-inp--done', cb.checked);
      syncChecklistUI();
    });

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'cl-inp' + (item.checked ? ' cl-inp--done' : '');
    inp.value = item.text;
    inp.placeholder = 'Item…';
    inp.addEventListener('input', () => { _checklist[idx].text = inp.value; });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        _checklist.splice(idx + 1, 0, { text: '', checked: false });
        renderChecklistItems();
        syncChecklistUI();
        // Focus new row
        const rows = document.querySelectorAll('.cl-inp');
        rows[idx + 1]?.focus();
      }
      if (e.key === 'Backspace' && inp.value === '') {
        e.preventDefault();
        _checklist.splice(idx, 1);
        renderChecklistItems();
        syncChecklistUI();
        const rows = document.querySelectorAll('.cl-inp');
        rows[Math.max(0, idx - 1)]?.focus();
      }
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'cl-del';
    delBtn.title = 'Remove item';
    delBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>`;
    delBtn.addEventListener('click', () => {
      _checklist.splice(idx, 1);
      renderChecklistItems();
      syncChecklistUI();
    });

    li.appendChild(cb);
    li.appendChild(inp);
    li.appendChild(delBtn);
    list.appendChild(li);
  });

  syncChecklistUI();
}

/* ─── Modal ──────────────────────────────────────────────────────────────── */

// In openCardModal, update signature:
export function openCardModal({ card, columnId, columnTitle, columns = [], onSave, onDelete }) {
  // Initialise checklist state
  _checklist = (card.checklist || []).map(i => ({ ...i }));

  // Populate fields
  document.getElementById('modal-title').value       = card.title       || '';
  document.getElementById('modal-desc').value        = card.description || '';
  document.getElementById('modal-labels').value      = (card.labels     || []).join(', ');
  document.getElementById('modal-col-name').textContent = columnTitle;
  document.getElementById('modal-heading').textContent  = card.id ? 'Edit card' : 'New card';

  // Show/hide delete button
  const deleteBtn = document.getElementById('modal-delete');
  deleteBtn.style.display = card.id ? '' : 'none';

  // Populate column selector
  const colSelect = document.getElementById('modal-column');
  colSelect.innerHTML = columns.map(c =>
    `<option value="${c.id}" ${c.id === columnId ? 'selected' : ''}
      style="--col-color:${c.color}">${escHtml(c.title)}</option>`
  ).join('');

  // Update the "in <column>" context label live
  colSelect.addEventListener('change', () => {
    const chosen = columns.find(c => c.id === colSelect.value);
    document.getElementById('modal-col-name').textContent = chosen?.title ?? columnTitle;
  });

  // Render checklist
  renderChecklistItems();

  // Add-item button
  const addItemBtn = document.getElementById('checklist-add-btn');
  const onAddItem = () => {
    _checklist.push({ text: '', checked: false });
    renderChecklistItems();
    const rows = document.querySelectorAll('.cl-inp');
    rows[rows.length - 1]?.focus();
  };
  addItemBtn.addEventListener('click', onAddItem);

  // Open modal
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal').classList.add('open');
  document.getElementById('modal-title').focus();

  // Cleanup helper
  function cleanup() {
    document.getElementById('modal-overlay').classList.remove('open');
    document.getElementById('modal').classList.remove('open');
    saveBtn.removeEventListener('click', onSave_);
    deleteBtn.removeEventListener('click', onDelete_);
    document.getElementById('modal-close').removeEventListener('click', cleanup);
    document.getElementById('modal-overlay').removeEventListener('click', cleanup);
    addItemBtn.removeEventListener('click', onAddItem);
    document.removeEventListener('keydown', onKeyDown);
  }

  function onSave_() {
    const title = document.getElementById('modal-title').value.trim();
    if (!title) { document.getElementById('modal-title').focus(); return; }
    onSave({
      title,
      description: document.getElementById('modal-desc').value.trim(),
      labels: document.getElementById('modal-labels').value
        .split(',').map(s => s.trim()).filter(Boolean),
      checklist: _checklist.filter(i => i.text.trim()),
      columnId: document.getElementById('modal-column').value,
    });
    cleanup();
  }

  function onDelete_() {
    onDelete();
    cleanup();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') cleanup();
  }

  const saveBtn = document.getElementById('modal-save');
  saveBtn.addEventListener('click', onSave_);
  deleteBtn.addEventListener('click', onDelete_);
  document.getElementById('modal-close').addEventListener('click', cleanup);
  document.getElementById('modal-overlay').addEventListener('click', cleanup);
  document.addEventListener('keydown', onKeyDown);
}