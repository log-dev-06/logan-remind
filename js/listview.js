/**
 * listview.js — List view renderer
 *
 * Renders the board as a grouped, sortable flat list.
 * No state mutation — rendering only.
 */

const LABEL_COLORS = {
  research: '#6366f1',
  planning:  '#f59e0b',
  design:    '#8b5cf6',
  bug:       '#ef4444',
  feature:   '#10b981',
  review:    '#3b82f6',
};

let sortState = { key: null, dir: 1 }; // dir: 1 = asc, -1 = desc

export function renderList(board, { onEditCard, onDeleteCard, onAddCard, onAddColumn }) {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  boardEl.classList.add('list-mode');

  const wrap = document.createElement('div');
  wrap.className = 'lv-wrap';

  // ── Toolbar row ─────────────────────────────────────────────────────────
  const toolbar = document.createElement('div');
  toolbar.className = 'lv-toolbar';
  toolbar.innerHTML = `
    <div class="lv-sort-label">Sort by</div>
    <div class="lv-sort-btns">
      ${sortBtn('title',     'Title')}
      ${sortBtn('column',    'Column')}
      ${sortBtn('labels',    'Label')}
      ${sortBtn('createdAt', 'Created')}
    </div>
    <button class="lv-add-col-btn">+ Add column</button>
  `;
  toolbar.querySelector('.lv-add-col-btn').addEventListener('click', onAddColumn);
  toolbar.querySelectorAll('.lv-sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      if (sortState.key === key) {
        sortState.dir *= -1;
      } else {
        sortState = { key, dir: 1 };
      }
      renderList(board, { onEditCard, onDeleteCard, onAddCard, onAddColumn });
    });
  });
  wrap.appendChild(toolbar);

  // ── Summary pills ────────────────────────────────────────────────────────
  const totalCards = board.columns.reduce((n, c) => n + c.cards.length, 0);
  const summary = document.createElement('div');
  summary.className = 'lv-summary';
  board.columns.forEach(col => {
    summary.innerHTML += `
      <span class="lv-pill" style="--pill-color:${col.color}">
        <span class="lv-pill-dot"></span>
        ${escHtml(col.title)} <strong>${col.cards.length}</strong>
      </span>`;
  });
  summary.innerHTML += `<span class="lv-pill-total">${totalCards} card${totalCards !== 1 ? 's' : ''} total</span>`;
  wrap.appendChild(summary);

  // ── Group by column ───────────────────────────────────────────────────────
  if (sortState.key) {
    // Sorted flat view (all cards, no grouping)
    const allCards = board.columns.flatMap(col =>
      col.cards.map(card => ({ card, col }))
    );

    sortCards(allCards, sortState);

    const section = document.createElement('div');
    section.className = 'lv-section';
    section.innerHTML = `<div class="lv-section-head"><span>All cards</span><span class="lv-section-count">${allCards.length}</span></div>`;
    const table = buildTable(allCards, { onEditCard, onDeleteCard, showCol: true });
    section.appendChild(table);
    wrap.appendChild(section);
  } else {
    // Default: grouped by column
    board.columns.forEach(col => {
      const section = document.createElement('div');
      section.className = 'lv-section';

      const head = document.createElement('div');
      head.className = 'lv-section-head';
      head.innerHTML = `
        <span class="lv-section-color" style="background:${col.color}"></span>
        <span>${escHtml(col.title)}</span>
        <span class="lv-section-count">${col.cards.length}</span>
        <button class="lv-add-card-btn" data-col-id="${col.id}">+ Add card</button>
      `;
      head.querySelector('.lv-add-card-btn').addEventListener('click', () => onAddCard(col.id));
      section.appendChild(head);

      if (col.cards.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'lv-empty';
        empty.textContent = 'No cards in this column';
        section.appendChild(empty);
      } else {
        const rows = col.cards.map(card => ({ card, col }));
        section.appendChild(buildTable(rows, { onEditCard, onDeleteCard, showCol: false }));
      }

      wrap.appendChild(section);
    });
  }

  boardEl.appendChild(wrap);
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function sortBtn(key, label) {
  const active = sortState.key === key;
  const arrow  = active ? (sortState.dir === 1 ? ' ↑' : ' ↓') : '';
  return `<button class="lv-sort-btn${active ? ' active' : ''}" data-key="${key}">${label}${arrow}</button>`;
}

function sortCards(items, { key, dir }) {
  items.sort((a, b) => {
    let va, vb;
    if (key === 'title')     { va = a.card.title.toLowerCase(); vb = b.card.title.toLowerCase(); }
    if (key === 'column')    { va = a.col.title.toLowerCase();  vb = b.col.title.toLowerCase(); }
    if (key === 'labels')    { va = a.card.labels[0] || ''; vb = b.card.labels[0] || ''; }
    if (key === 'createdAt') { va = a.card.createdAt || 0;  vb = b.card.createdAt || 0; }
    if (va < vb) return -dir;
    if (va > vb) return  dir;
    return 0;
  });
}

function buildTable(rows, { onEditCard, onDeleteCard, showCol }) {
  const table = document.createElement('div');
  table.className = 'lv-table';

  // Header
  const hdr = document.createElement('div');
  hdr.className = 'lv-row lv-header';
  hdr.innerHTML = `
    <div class="lv-cell lv-cell-title">Title</div>
    ${showCol ? '<div class="lv-cell lv-cell-col">Column</div>' : ''}
    <div class="lv-cell lv-cell-labels">Labels</div>
    <div class="lv-cell lv-cell-desc">Description</div>
    <div class="lv-cell lv-cell-date">Created</div>
    <div class="lv-cell lv-cell-actions"></div>
  `;
  table.appendChild(hdr);

  rows.forEach(({ card, col }) => {
    const row = document.createElement('div');
    row.className = 'lv-row';
    row.dataset.cardId = card.id;

    const labels = card.labels
      .map(l => `<span class="label" style="background:${LABEL_COLORS[l] || '#64748b'}">${escHtml(l)}</span>`)
      .join('');

    row.innerHTML = `
      <div class="lv-cell lv-cell-title">
        <span class="lv-card-dot" style="background:${col.color}"></span>
        <span class="lv-card-title">${escHtml(card.title)}</span>
      </div>
      ${showCol ? `<div class="lv-cell lv-cell-col"><span class="lv-col-badge" style="--col-color:${col.color}">${escHtml(col.title)}</span></div>` : ''}
      <div class="lv-cell lv-cell-labels">${labels || '<span class="lv-none">—</span>'}</div>
      <div class="lv-cell lv-cell-desc">${card.description ? escHtml(card.description) : '<span class="lv-none">—</span>'}</div>
      <div class="lv-cell lv-cell-date">${formatDate(card.createdAt)}</div>
      <div class="lv-cell lv-cell-actions">
        <button class="lv-edit-btn"   title="Edit card">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="lv-delete-btn" title="Delete card">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    `;

    row.querySelector('.lv-edit-btn').addEventListener('click', () => onEditCard(card.id));
    row.querySelector('.lv-delete-btn').addEventListener('click', () => onDeleteCard(card.id));
    // Click row (not buttons) also opens edit
    row.addEventListener('click', e => {
      if (!e.target.closest('button')) onEditCard(card.id);
    });

    table.appendChild(row);
  });

  return table;
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}