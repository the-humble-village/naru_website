import React from 'react';
import { type QuestionSetRead } from '@naru/shared';

interface VisitQuestion {
  questionId: number;
  question: string;
  answer: string;
}

interface AvailableQuestion {
  id: number;
  title: string;
}

interface VisitQuestionsPanelProps {
  questionSets: QuestionSetRead[];
  availableQuestions: AvailableQuestion[];
  loadingQuestions: boolean;
  questions: VisitQuestion[];
  onApplySet: (setId: number) => void;
  onAdd: (questionId: number, title: string) => void;
  onChange: (questionId: number, question: string, answer: string) => void;
  onRemove: (questionId: number) => void;
}

export const VisitQuestionsPanel: React.FC<VisitQuestionsPanelProps> = ({
  questionSets,
  availableQuestions,
  loadingQuestions,
  questions,
  onApplySet,
  onAdd,
  onChange,
  onRemove,
}) => (
  <div>
    <label className="block text-sm font-medium text-hv-charcoal mb-2">Visit Questions</label>

    {questionSets.length > 0 && (
      <div className="mb-4 flex items-center gap-3 p-3 bg-hv-page rounded-lg border border-hv-border">
        <span className="text-sm text-hv-gray shrink-0">Apply a set:</span>
        <select
          onChange={(e) => {
            const id = parseInt(e.target.value, 10);
            if (id) { onApplySet(id); e.target.value = ''; }
          }}
          className="flex-1 px-3 py-1.5 border border-hv-border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-hv-accent"
          defaultValue=""
        >
          <option value="">Select a question set...</option>
          {questionSets.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.items.length} questions)</option>
          ))}
        </select>
      </div>
    )}

    {!loadingQuestions && availableQuestions.length > 0 && (
      <div className="mb-4">
        <select
          onChange={(e) => {
            const questionId = parseInt(e.target.value, 10);
            const q = availableQuestions.find((aq) => aq.id === questionId);
            if (q) { onAdd(questionId, q.title); e.target.value = ''; }
          }}
          className="px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-green"
          value=""
        >
          <option value="">Add a question...</option>
          {availableQuestions
            .filter((q) => !questions.some((fq) => fq.questionId === q.id))
            .map((q) => (
              <option key={q.id} value={q.id}>{q.title}</option>
            ))}
        </select>
      </div>
    )}

    <div className="space-y-3">
      {questions.map((item) => (
        <div key={item.questionId} className="border border-hv-border p-3 rounded-md">
          <div className="flex justify-between items-start mb-2">
            <label className="text-sm font-medium text-hv-gray">{item.question}</label>
            <button
              type="button"
              onClick={() => onRemove(item.questionId)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              Remove
            </button>
          </div>
          <textarea
            value={item.answer}
            onChange={(e) => onChange(item.questionId, item.question, e.target.value)}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-green"
            rows={2}
            placeholder="Enter answer..."
          />
        </div>
      ))}
    </div>
  </div>
);
