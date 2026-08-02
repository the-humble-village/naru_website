import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { questionSetsApi } from '../../api/question-sets';
import { adminApi, type LookupTableName } from '../../api/admin';
import { type QuestionSetRead, type QuestionSetItemRead, type LookupRead } from '@naru/shared';
import { RoleGate } from '../../components/RoleGate';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

type VisitType = 'child' | 'parent' | 'family';

const CONFIG: Record<VisitType, { pageTitle: string; questionTable: LookupTableName; fetchFn: () => Promise<LookupRead[]> }> = {
  child: {
    pageTitle: 'Child Visit Questions & Sets',
    questionTable: 'child-visit-questions',
    fetchFn: adminApi.fetchChildVisitQuestions,
  },
  parent: {
    pageTitle: 'Parent Visit Questions & Sets',
    questionTable: 'parent-visit-questions',
    fetchFn: adminApi.fetchParentVisitQuestions,
  },
  family: {
    pageTitle: 'Family Visit Questions & Sets',
    questionTable: 'family-visit-questions',
    fetchFn: adminApi.fetchFamilyVisitQuestions,
  },
};

function isValidType(t: string | undefined): t is VisitType {
  return t === 'child' || t === 'parent' || t === 'family';
}

// ─── Questions Panel ──────────────────────────────────────────────────────────

interface QuestionsPanelProps {
  visitType: VisitType;
  config: typeof CONFIG[VisitType];
}

const QuestionsPanel: React.FC<QuestionsPanelProps> = ({ visitType, config }) => {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LookupRead | null>(null);
  const [title, setTitle] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<LookupRead | null>(null);

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['admin', config.questionTable],
    queryFn: config.fetchFn,
  });

  // Already loaded by the sets panel; reused here purely to count references.
  const { data: sets = [] } = useQuery({
    queryKey: ['question-sets', visitType],
    queryFn: () => questionSetsApi.list(visitType),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', config.questionTable] });

  const createMut = useMutation({
    mutationFn: (t: string) => adminApi.createLookupEntry(config.questionTable, { title: t }),
    onSuccess: () => { invalidate(); resetForm(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, t }: { id: number; t: string }) =>
      adminApi.updateLookupEntry(config.questionTable, id, { title: t }),
    onSuccess: () => { invalidate(); resetForm(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi.deleteLookupEntry(config.questionTable, id),
    onSuccess: () => {
      invalidate();
      // A deleted question disappears from the sets that include it.
      qc.invalidateQueries({ queryKey: ['question-sets', visitType] });
      setDeleteTarget(null);
    },
  });

  const setsUsingTarget = deleteTarget
    ? sets.filter((s) => s.items.some((i) => i.questionId === deleteTarget.id))
    : [];

  const askDelete = (q: LookupRead) => { deleteMut.reset(); setDeleteTarget(q); };
  const cancelDelete = () => { setDeleteTarget(null); deleteMut.reset(); };
  const confirmDelete = () => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); };

  const resetForm = () => { setTitle(''); setShowForm(false); setEditing(null); };
  const startEdit = (q: LookupRead) => { setEditing(q); setTitle(q.title); setShowForm(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (editing) updateMut.mutate({ id: editing.id, t: title.trim() });
    else createMut.mutate(title.trim());
  };

  return (
    <div className="bg-white rounded-xl border border-hv-border mb-6">
      <div className="flex justify-between items-center px-6 py-4 border-b border-hv-border">
        <h2 className="text-lg font-semibold text-hv-charcoal">Questions ({questions.length})</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-hv-terracotta text-white px-3 py-1.5 text-sm rounded hover:bg-hv-terracotta-hover transition-colors"
        >
          + Add Question
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="px-6 py-4 bg-hv-page border-b border-hv-border flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-hv-charcoal mb-1">
              {editing ? 'Edit question' : 'New question'} *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="Enter question text..."
              className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
            />
          </div>
          <button
            type="submit"
            disabled={!title.trim() || createMut.isPending || updateMut.isPending}
            className="bg-hv-terracotta text-white px-4 py-2 rounded hover:bg-hv-terracotta-hover disabled:opacity-50 transition-colors"
          >
            {createMut.isPending || updateMut.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
          </button>
          <button type="button" onClick={resetForm} className="px-4 py-2 border border-hv-border rounded text-hv-gray hover:bg-hv-page transition-colors">
            Cancel
          </button>
        </form>
      )}

      {isLoading ? (
        <p className="p-6 text-hv-gray">Loading...</p>
      ) : questions.length === 0 ? (
        <p className="p-6 text-center text-hv-gray">No questions yet. Add one above.</p>
      ) : (
        <table className="w-full">
          <tbody className="divide-y divide-hv-border">
            {questions.map((q) => (
              <tr key={q.id} className="hover:bg-hv-page">
                <td className="px-4 py-3 text-sm text-hv-charcoal">{q.title}</td>
                <td className="px-4 py-3 text-right text-sm space-x-3 whitespace-nowrap">
                  <button onClick={() => startEdit(q)} className="text-hv-accent hover:text-hv-green transition-colors">Edit</button>
                  <button
                    onClick={() => askDelete(q)}
                    disabled={deleteMut.isPending}
                    className="text-hv-crisis hover:text-red-700 disabled:opacity-50 transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Question"
        message={
          <>
            <p>
              Delete <span className="font-medium text-hv-charcoal">&ldquo;{deleteTarget?.title}&rdquo;</span>? It will
              no longer be available when recording a visit.
            </p>
            {deleteMut.error && (
              <p className="mt-2 text-hv-crisis">Failed to delete question: {deleteMut.error.message}</p>
            )}
          </>
        }
        warning={
          setsUsingTarget.length > 0
            ? `${setsUsingTarget.length} question ${
                setsUsingTarget.length === 1 ? 'set references' : 'sets reference'
              } this question (${setsUsingTarget
                .map((s) => s.name)
                .join(', ')}). Answers already recorded on visits keep their text.`
            : 'Answers already recorded on visits keep their text — they are not changed or removed.'
        }
        busy={deleteMut.isPending}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

// ─── Sets Panel ───────────────────────────────────────────────────────────────

interface SetFormProps {
  visitType: VisitType;
  availableQuestions: LookupRead[];
  initial?: QuestionSetRead;
  onSave: () => void;
  onCancel: () => void;
}

const SetForm: React.FC<SetFormProps> = ({ visitType, availableQuestions, initial, onSave, onCancel }) => {
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? '');
  // Order of this array is the sortOrder sent to the backend
  const [selectedIds, setSelectedIds] = useState<number[]>(
    initial ? [...initial.items].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.questionId) : []
  );
  const [error, setError] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const save = useMutation({
    mutationFn: () =>
      initial
        ? questionSetsApi.update(visitType, initial.id, { name, questionIds: selectedIds })
        : questionSetsApi.create(visitType, { name, questionIds: selectedIds }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['question-sets', visitType] }); onSave(); },
    onError: () => setError('Failed to save. Please try again.'),
  });

  const toggle = (id: number) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    setSelectedIds((prev) => {
      const next = [...prev];
      const current = next[index];
      const other = next[index - 1];
      if (current === undefined || other === undefined) return prev;
      next[index - 1] = current;
      next[index] = other;
      return next;
    });
  };

  const moveDown = (index: number) => {
    setSelectedIds((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      const current = next[index];
      const other = next[index + 1];
      if (current === undefined || other === undefined) return prev;
      next[index + 1] = current;
      next[index] = other;
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setSelectedIds((prev) => {
      const next = [...prev];
      const [removed] = next.splice(dragIndex, 1);
      if (removed === undefined) return prev;
      next.splice(index, 0, removed);
      return next;
    });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => { setDragIndex(null); setDragOverIndex(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setError('');
    save.mutate();
  };

  const questionMap = Object.fromEntries(availableQuestions.map((q) => [q.id, q.title]));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-hv-charcoal mb-1">Set Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. First Visit, Follow-up Visit"
          className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-hv-charcoal mb-2">Questions in this set</label>
        {availableQuestions.length === 0 ? (
          <p className="text-sm text-hv-gray">Add questions in the section above first.</p>
        ) : (
          <div className="max-h-48 overflow-y-auto border border-hv-border-input rounded-md p-3 space-y-2">
            {availableQuestions.map((q) => (
              <label key={q.id} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(q.id)}
                  onChange={() => toggle(q.id)}
                  className="mt-0.5 rounded border-hv-border-input text-hv-accent focus:ring-hv-accent"
                />
                <span className="text-sm text-hv-charcoal">{q.title}</span>
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-hv-sage mt-1">{selectedIds.length} question{selectedIds.length !== 1 ? 's' : ''} selected</p>
      </div>

      {selectedIds.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-hv-charcoal mb-1">Question Order</label>
          <p className="text-xs text-hv-sage mb-2">Drag to reorder or use arrows.</p>
          <div className="border border-hv-border-input rounded-md divide-y divide-hv-border overflow-hidden">
            {selectedIds.map((id, index) => (
              <div
                key={id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 px-3 py-2 bg-white cursor-grab active:cursor-grabbing transition-colors select-none ${
                  dragOverIndex === index && dragIndex !== index ? 'bg-hv-accent/10 border-l-2 border-l-hv-accent' : ''
                } ${dragIndex === index ? 'opacity-40' : ''}`}
              >
                <span className="text-hv-border text-base leading-none">⠿</span>
                <span className="text-sm text-hv-sage w-5 shrink-0">{index + 1}.</span>
                <span className="flex-1 text-sm text-hv-charcoal">{questionMap[id]}</span>
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="text-xs text-hv-sage hover:text-hv-charcoal disabled:opacity-30 leading-tight px-1"
                    aria-label="Move up"
                  >▲</button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index === selectedIds.length - 1}
                    className="text-xs text-hv-sage hover:text-hv-charcoal disabled:opacity-30 leading-tight px-1"
                    aria-label="Move down"
                  >▼</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-hv-crisis text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={save.isPending}
          className="bg-hv-green text-white px-4 py-2 rounded hover:bg-hv-green-hover disabled:opacity-50 transition-colors"
        >
          {save.isPending ? 'Saving...' : initial ? 'Update Set' : 'Create Set'}
        </button>
        <button type="button" onClick={onCancel} className="bg-hv-gray text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const AdminQuestionSetsPage: React.FC = () => {
  const { visitType } = useParams<{ visitType: string }>();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingSet, setEditingSet] = useState<QuestionSetRead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuestionSetRead | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ set: QuestionSetRead; item: QuestionSetItemRead } | null>(null);

  if (!isValidType(visitType)) return <p className="text-red-500">Invalid visit type.</p>;

  const config = CONFIG[visitType];

  const { data: sets = [], isLoading: setsLoading } = useQuery({
    queryKey: ['question-sets', visitType],
    queryFn: () => questionSetsApi.list(visitType),
  });

  const { data: questions = [] } = useQuery({
    queryKey: ['admin', config.questionTable],
    queryFn: config.fetchFn,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => questionSetsApi.delete(visitType, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['question-sets', visitType] });
      setDeleteTarget(null);
    },
  });

  // Removing a single question from a set = replacing the set's ordered questionIds.
  const removeItemMut = useMutation({
    mutationFn: ({ set, item }: { set: QuestionSetRead; item: QuestionSetItemRead }) =>
      questionSetsApi.update(visitType, set.id, {
        questionIds: [...set.items]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .filter((i) => i.id !== item.id)
          .map((i) => i.questionId),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['question-sets', visitType] });
      setRemoveTarget(null);
    },
  });

  const handleSaved = () => { setShowForm(false); setEditingSet(null); };

  const askDeleteSet = (set: QuestionSetRead) => { deleteMut.reset(); setDeleteTarget(set); };
  const cancelDeleteSet = () => { setDeleteTarget(null); deleteMut.reset(); };
  const confirmDeleteSet = () => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); };

  const askRemoveItem = (set: QuestionSetRead, item: QuestionSetItemRead) => {
    removeItemMut.reset();
    setRemoveTarget({ set, item });
  };
  const cancelRemoveItem = () => { setRemoveTarget(null); removeItemMut.reset(); };
  const confirmRemoveItem = () => { if (removeTarget) removeItemMut.mutate(removeTarget); };

  return (
    <RoleGate requiredRole="ADMIN">
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
        <h1 className="text-2xl font-serif font-bold text-hv-charcoal">{config.pageTitle}</h1>
        <Link to="/admin" className="text-hv-terracotta hover:underline transition-colors">← Back to Admin</Link>
      </div>

      {/* Questions section */}
      <QuestionsPanel visitType={visitType} config={config} />

      {/* Sets section */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-hv-charcoal">Question Sets</h2>
        {!showForm && !editingSet && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-hv-green text-white px-4 py-2 rounded hover:bg-hv-green-hover transition-colors text-sm"
          >
            + New Set
          </button>
        )}
      </div>

      {(showForm || editingSet) && (
        <div className="bg-white p-6 rounded-xl border border-hv-border mb-4">
          <h3 className="text-base font-semibold text-hv-charcoal mb-4">
            {editingSet ? `Edit "${editingSet.name}"` : 'New Question Set'}
          </h3>
          <SetForm
            visitType={visitType}
            availableQuestions={questions}
            initial={editingSet ?? undefined}
            onSave={handleSaved}
            onCancel={handleSaved}
          />
        </div>
      )}

      {setsLoading ? (
        <p className="text-hv-gray">Loading...</p>
      ) : sets.length === 0 ? (
        <p className="text-hv-gray text-center py-6">No sets yet. Create one above.</p>
      ) : (
        <div className="space-y-3">
          {sets.map((set) => (
            <div key={set.id} className="bg-white rounded-xl border border-hv-border p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-hv-charcoal">{set.name}</h3>
                  <p className="text-sm text-hv-sage mt-0.5">{set.items.length} question{set.items.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setEditingSet(set); setShowForm(false); }}
                    className="text-hv-accent hover:text-hv-green text-sm transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => askDeleteSet(set)}
                    disabled={deleteMut.isPending}
                    className="text-hv-crisis hover:text-red-700 text-sm disabled:opacity-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {set.items.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {set.items.map((item, i) => (
                    <li key={item.id} className="text-sm text-hv-gray flex gap-2 items-start">
                      <span className="text-hv-sage w-5 shrink-0">{i + 1}.</span>
                      <span className="flex-1">{item.questionTitle}</span>
                      <button
                        onClick={() => askRemoveItem(set, item)}
                        disabled={removeItemMut.isPending}
                        className="text-hv-crisis hover:text-red-700 text-xs shrink-0 disabled:opacity-50 transition-colors"
                        aria-label={`Remove "${item.questionTitle}" from ${set.name}`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Question Set"
        message={
          <>
            <p>
              Delete <span className="font-medium text-hv-charcoal">&ldquo;{deleteTarget?.name}&rdquo;</span>? The
              questions themselves are not deleted, only this grouping of them.
            </p>
            {deleteMut.error && (
              <p className="mt-2 text-hv-crisis">Failed to delete set: {deleteMut.error.message}</p>
            )}
          </>
        }
        warning="Visits already recorded using this set keep their answers — they are not changed or removed."
        busy={deleteMut.isPending}
        onConfirm={confirmDeleteSet}
        onCancel={cancelDeleteSet}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove Question From Set"
        confirmLabel="Remove"
        message={
          <>
            <p>
              Remove{' '}
              <span className="font-medium text-hv-charcoal">&ldquo;{removeTarget?.item.questionTitle}&rdquo;</span>{' '}
              from <span className="font-medium text-hv-charcoal">&ldquo;{removeTarget?.set.name}&rdquo;</span>? The
              question itself is kept and stays available for other sets.
            </p>
            {removeItemMut.error && (
              <p className="mt-2 text-hv-crisis">Failed to remove question: {removeItemMut.error.message}</p>
            )}
          </>
        }
        busy={removeItemMut.isPending}
        onConfirm={confirmRemoveItem}
        onCancel={cancelRemoveItem}
      />
    </div>
    </RoleGate>
  );
};

export default AdminQuestionSetsPage;
