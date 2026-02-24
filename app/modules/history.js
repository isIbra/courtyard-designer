// ── Undo/Redo History Stack ──

const undoStack = []; // { undo: fn, redo: fn, label: string }
const redoStack = [];
const MAX_HISTORY = 50;

export function pushAction({ undo, redo, label }) {
  undoStack.push({ undo, redo, label });
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0; // clear redo on new action
}

export function undo() {
  const action = undoStack.pop();
  if (!action) return null;
  action.undo();
  redoStack.push(action);
  return action.label;
}

export function redo() {
  const action = redoStack.pop();
  if (!action) return null;
  action.redo();
  undoStack.push(action);
  return action.label;
}

export function canUndo() { return undoStack.length > 0; }
export function canRedo() { return redoStack.length > 0; }

export function clearHistory() {
  undoStack.length = 0;
  redoStack.length = 0;
}
