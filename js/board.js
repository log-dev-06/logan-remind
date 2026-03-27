/**
 * board.js — Board state & business logic
 *
 * Pure functions that operate on a plain board object.
 * No DOM, no storage calls — easy to unit-test.
 */

import { generateId } from './storage.js';

/* ─── Column operations ──────────────────────────────────────────────────── */

export function addColumn(board, title) {
  const colors = ['#6366f1', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#3b82f6'];
  return {
    ...board,
    columns: [
      ...board.columns,
      {
        id: generateId(),
        title,
        color: colors[board.columns.length % colors.length],
        cards: [],
      },
    ],
  };
}

export function deleteColumn(board, columnId) {
  return { ...board, columns: board.columns.filter(c => c.id !== columnId) };
}

export function renameColumn(board, columnId, newTitle) {
  return {
    ...board,
    columns: board.columns.map(c =>
      c.id === columnId ? { ...c, title: newTitle } : c
    ),
  };
}

export function reorderColumns(board, fromIndex, toIndex) {
  const cols = [...board.columns];
  const [moved] = cols.splice(fromIndex, 1);
  cols.splice(toIndex, 0, moved);
  return { ...board, columns: cols };
}

/* ─── Card operations ────────────────────────────────────────────────────── */

export function addCard(board, columnId, { title, description = '', labels = [], checklist = [] }) {
  return {
    ...board,
    columns: board.columns.map(c =>
      c.id !== columnId ? c : {
        ...c,
        cards: [
          ...c.cards,
          { id: generateId(), title, description, labels, checklist, createdAt: Date.now() },
        ],
      }
    ),
  };
}

export function updateCard(board, cardId, patch) {
  return {
    ...board,
    columns: board.columns.map(c => ({
      ...c,
      cards: c.cards.map(card =>
        card.id !== cardId ? card : { ...card, ...patch }
      ),
    })),
  };
}

export function deleteCard(board, cardId) {
  return {
    ...board,
    columns: board.columns.map(c => ({
      ...c,
      cards: c.cards.filter(card => card.id !== cardId),
    })),
  };
}

/**
 * Move a card from one position to another.
 * Works within the same column or across columns.
 */
export function moveCard(board, { fromColId, toColId, fromIndex, toIndex }) {
  const columns = board.columns.map(c => ({ ...c, cards: [...c.cards] }));
  const fromCol = columns.find(c => c.id === fromColId);
  const toCol   = columns.find(c => c.id === toColId);
  if (!fromCol || !toCol) return board;

  const [card] = fromCol.cards.splice(fromIndex, 1);
  toCol.cards.splice(toIndex, 0, card);
  return { ...board, columns };
}

/* ─── Search / filter ────────────────────────────────────────────────────── */

export function filterBoard(board, query) {
  const q = query.trim().toLowerCase();
  if (!q) return board;
  return {
    ...board,
    columns: board.columns.map(c => ({
      ...c,
      cards: c.cards.filter(card => {
        const clText = (card.checklist || []).map(i => i.text).join(' ');
        return (
          card.title.toLowerCase().includes(q) ||
          (card.description || '').toLowerCase().includes(q) ||
          clText.toLowerCase().includes(q) ||
          card.labels.some(l => l.toLowerCase().includes(q))
        );
      }),
    })),
  };
}