/**
 * storage.js — Data layer abstraction
 *
 * Swap this entire file (or its implementation) when moving to Firebase,
 * Supabase, or a REST API. The rest of the app only calls these functions.
 *
 * Interface contract:
 *   loadBoard()             → Promise<Board>
 *   saveBoard(board)        → Promise<void>
 *   generateId()            → string
 */

const STORAGE_KEY = 'kanban_board_v1';

/* ─── Default seed data ──────────────────────────────────────────────────── */
const DEFAULT_BOARD = {
  columns: [
    {
      id: 'col-1',
      title: 'Backlog',
      color: '#6366f1',
      cards: [
        { id: 'card-1', title: 'Research competitors', description: 'Analyse top 5 competitors in the market', labels: ['research'], createdAt: Date.now() },
        { id: 'card-2', title: 'Define MVP scope',     description: '',                                         labels: ['planning'], createdAt: Date.now() },
      ],
    },
    {
      id: 'col-2',
      title: 'In Progress',
      color: '#f59e0b',
      cards: [
        { id: 'card-3', title: 'Design system tokens', description: 'Colours, spacing, typography', labels: ['design'], createdAt: Date.now() },
      ],
    },
    {
      id: 'col-3',
      title: 'Review',
      color: '#8b5cf6',
      cards: [],
    },
    {
      id: 'col-4',
      title: 'Done',
      color: '#10b981',
      cards: [
        { id: 'card-4', title: 'Project kickoff meeting', description: '', labels: ['planning'], createdAt: Date.now() },
      ],
    },
  ],
};

/* ─── LocalStorage adapter ───────────────────────────────────────────────── */
// To switch to Firebase, replace loadBoard / saveBoard with Firestore calls.
// To switch to a REST API, replace with fetch() calls.

export async function loadBoard() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('[storage] Failed to parse saved board, using defaults.', e);
  }
  return structuredClone(DEFAULT_BOARD);
}

export async function saveBoard(board) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
  } catch (e) {
    console.error('[storage] Failed to save board.', e);
  }
}

export function generateId() {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ─── Future: Firebase adapter (commented out) ───────────────────────────── */
/*
import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const BOARD_DOC = 'boards/main';

export async function loadBoard() {
  const snap = await getDoc(doc(db, BOARD_DOC));
  return snap.exists() ? snap.data() : structuredClone(DEFAULT_BOARD);
}

export async function saveBoard(board) {
  await setDoc(doc(db, BOARD_DOC), board);
}
*/
