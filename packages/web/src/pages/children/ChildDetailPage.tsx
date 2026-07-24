import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { childrenApi } from '../../api/children';
import { visitsApi } from '../../api/visits';
import { ChildRead, ChildVisitRead, ChildUpdate, Sex } from '@naru/shared';
import ZScoreBadge from '../../components/ZScoreBadge';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';

interface ChildEditForm {
  name: string;
  sex: Sex;
  weight: number | '';
  birthDate: string;
  dateEntered: string;
  nutritionalState: string;
  reasonEnrollment: string;
  observations: string;
}

interface ChildWithZScores extends ChildRead {
  zScores?: {
    weightForAge?: { zScore: number; classification: string } | null;
    ageInDays: number;
  } | null;
}

export const ChildDetailPage: React.FC = () => {
  const { id: familyId, cid: childId } = useParams<{ id: string; cid: string }>();

  const familyIdNum = familyId ? parseInt(familyId, 10) : 0;
  const childIdNum  = childId  ? parseInt(childId,  10) : 0;

  const { data: child, isLoading, error } = useQuery<ChildWithZScores>({
    queryKey: ['child', familyIdNum, childIdNum],
    queryFn: () => childrenApi.fetchChild(familyIdNum, childIdNum) as Promise<ChildWithZScores>,
    enabled: familyIdNum > 0 && childIdNum > 0,
  });

  const { data: visitsResponse, isLoading: isLoadingVisits, error: visitsError } = useQuery<ChildVisitRead[]>({
    queryKey: ['child-visits', familyIdNum, childIdNum],
    queryFn: async () => {
      const res = await visitsApi.listChildVisits(familyIdNum, childIdNum, { limit: 50 });
      return Array.isArray(res) ? res : (res as any).visits ?? [];
    },
    enabled: familyIdNum > 0 && childIdNum > 0,
  });

  const [expandedVisitId, setExpandedVisitId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ChildEditForm | null>(null);

  const queryClient = useQueryClient();
  const updateChildMutation = useMutation({
    mutationFn: (data: ChildUpdate) => childrenApi.updateChild(familyIdNum, childIdNum, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['child', familyIdNum, childIdNum] });
      queryClient.invalidateQueries({ queryKey: ['children', familyIdNum] });
      setIsEditing(false);
      setEditData(null);
    },
  });

  const handleEdit = () => {
    if (!child) return;
    setEditData({
      name: child.name || '',
      sex: child.sex,
      weight: child.weight ?? 0,
      birthDate: child.birthDate ? child.birthDate.split('T')[0] : '',
      dateEntered: child.dateEntered ? child.dateEntered.split('T')[0] : '',
      nutritionalState: child.nutritionalState || '',
      reasonEnrollment: child.reasonEnrollment || '',
      observations: child.observations || '',
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData(null);
  };

  const handleSave = () => {
    if (!child || !editData) return;
    const dataToSave: ChildUpdate = {};

    if (editData.name !== (child.name || '')) dataToSave.name = editData.name;
    if (editData.sex !== child.sex) dataToSave.sex = editData.sex;

    const weightNum = editData.weight === '' ? 0 : Number(editData.weight);
    if (weightNum !== child.weight) dataToSave.weight = weightNum;

    // Calendar dates: store as UTC midnight so they round-trip without shifting.
    const birthDateFormatted = editData.birthDate ? `${editData.birthDate}T00:00:00.000Z` : null;
    if (birthDateFormatted && birthDateFormatted !== child.birthDate) dataToSave.birthDate = birthDateFormatted;

    const dateEnteredFormatted = editData.dateEntered ? `${editData.dateEntered}T00:00:00.000Z` : null;
    if (dateEnteredFormatted !== child.dateEntered) dataToSave.dateEntered = dateEnteredFormatted;

    if (editData.nutritionalState !== (child.nutritionalState || '')) {
      dataToSave.nutritionalState = editData.nutritionalState || null;
    }
    if (editData.reasonEnrollment !== (child.reasonEnrollment || '')) {
      dataToSave.reasonEnrollment = editData.reasonEnrollment || null;
    }
    if (editData.observations !== (child.observations || '')) {
      dataToSave.observations = editData.observations || null;
    }

    updateChildMutation.mutate(dataToSave);
  };

  if (isLoading) return <div className="text-hv-gray">Loading...</div>;
  if (error || !child) return <div className="text-red-500">Child not found</div>;

  const formatDate = (d: string) => new Date(d).toLocaleDateString();
  // Calendar dates (birthDate, visitDate) are stored as UTC midnight, so render
  // them in UTC to avoid the local-timezone shift that pushes them back a day.
  const formatDateOnly = (d: string) => new Date(d).toLocaleDateString(undefined, { timeZone: 'UTC' });

  const ageInMonths = (() => {
    const birth = new Date(child.birthDate);
    const now = new Date();
    return (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 + (now.getUTCMonth() - birth.getUTCMonth());
  })();
  const ageLabel = ageInMonths < 12
    ? `${ageInMonths} mo`
    : `${Math.floor(ageInMonths / 12)} yr${ageInMonths % 12 > 0 ? ` ${ageInMonths % 12} mo` : ''}`;

  const zscore = child.zScores?.weightForAge;

  // Build visit table (sorted newest-first)
  const sortedVisits = visitsResponse
    ? [...visitsResponse].sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
    : [];

  // Build chart data (oldest-first)
  const chartData = visitsResponse && visitsResponse.length > 1
    ? [...visitsResponse]
        .sort((a, b) => new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime())
        .map(v => ({
          date: new Date(v.visitDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
          weight: parseFloat((v.weight / 1000).toFixed(2)),
          muac:   v.armCircumference > 0 ? parseFloat((v.armCircumference / 10).toFixed(1)) : null,
          height: v.height > 0          ? parseFloat((v.height / 10).toFixed(1))           : null,
        }))
    : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <Link to={`/families/${familyId}`} className="text-xs text-hv-sage hover:text-hv-charcoal transition-colors">
            ← Back to Family
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-2xl font-serif font-bold text-hv-charcoal">{child.name}</h1>
            <span className="text-xs text-hv-sage">{child.sex === 'MALE' ? 'Male' : 'Female'} · {ageLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {!isEditing && (
            <button
              onClick={handleEdit}
              className="px-3 py-1.5 text-sm bg-hv-green text-white rounded-md hover:bg-hv-green-hover transition-colors"
            >
              Edit
            </button>
          )}
          <Link
            to={`/families/${familyId}/children/${childId}/visits/new`}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover transition-colors"
          >
            <Plus size={14} />
            Add Visit
          </Link>
        </div>
      </div>

      {/* Edit form */}
      {isEditing && editData ? (
        <div className="bg-white rounded-xl border border-hv-border mb-5 p-5">
          <h2 className="text-sm font-semibold text-hv-charcoal mb-4">Edit Child Information</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-hv-charcoal mb-1">Name</label>
                <input
                  type="text"
                  id="name"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
                  placeholder="Enter child name"
                  maxLength={256}
                />
              </div>
              <div>
                <label htmlFor="sex" className="block text-sm font-medium text-hv-charcoal mb-1">Sex</label>
                <select
                  id="sex"
                  value={editData.sex}
                  onChange={(e) => setEditData({ ...editData, sex: e.target.value as Sex })}
                  className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="birthDate" className="block text-sm font-medium text-hv-charcoal mb-1">Birth Date</label>
                <input
                  type="date"
                  id="birthDate"
                  value={editData.birthDate}
                  onChange={(e) => setEditData({ ...editData, birthDate: e.target.value })}
                  className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
                />
              </div>
              <div>
                <label htmlFor="dateEntered" className="block text-sm font-medium text-hv-charcoal mb-1">Date Entered</label>
                <input
                  type="date"
                  id="dateEntered"
                  value={editData.dateEntered}
                  onChange={(e) => setEditData({ ...editData, dateEntered: e.target.value })}
                  className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
                />
              </div>
            </div>

            <div>
              <label htmlFor="weight" className="block text-sm font-medium text-hv-charcoal mb-1">Weight (grams)</label>
              <input
                type="number"
                id="weight"
                value={editData.weight}
                onChange={(e) => setEditData({ ...editData, weight: e.target.value === '' ? '' : Number(e.target.value) })}
                min="0"
                className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
                placeholder="Weight in grams"
              />
            </div>

            <div>
              <label htmlFor="nutritionalState" className="block text-sm font-medium text-hv-charcoal mb-1">Nutritional State</label>
              <input
                type="text"
                id="nutritionalState"
                value={editData.nutritionalState}
                onChange={(e) => setEditData({ ...editData, nutritionalState: e.target.value })}
                className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
                placeholder="e.g. Normal, Malnourished"
                maxLength={512}
              />
            </div>

            <div>
              <label htmlFor="reasonEnrollment" className="block text-sm font-medium text-hv-charcoal mb-1">Reason for Enrollment</label>
              <textarea
                id="reasonEnrollment"
                rows={3}
                value={editData.reasonEnrollment}
                onChange={(e) => setEditData({ ...editData, reasonEnrollment: e.target.value })}
                className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
                placeholder="Enter reason for enrollment"
                maxLength={4096}
              />
            </div>

            <div>
              <label htmlFor="observations" className="block text-sm font-medium text-hv-charcoal mb-1">Observations</label>
              <textarea
                id="observations"
                rows={4}
                value={editData.observations}
                onChange={(e) => setEditData({ ...editData, observations: e.target.value })}
                className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
                placeholder="Enter any observations"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={updateChildMutation.isPending}
                className="bg-hv-terracotta text-white px-4 py-2 rounded-md text-sm hover:bg-hv-terracotta-hover transition-colors disabled:opacity-50"
              >
                {updateChildMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                disabled={updateChildMutation.isPending}
                className="px-4 py-2 border border-hv-border rounded-md text-sm text-hv-charcoal hover:bg-hv-page transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            {updateChildMutation.isError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-hv-crisis text-sm">
                  Error saving child: {updateChildMutation.error instanceof Error ? updateChildMutation.error.message : 'Unknown error'}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
      /* Info strip */
      <div className="bg-white rounded-xl border border-hv-border mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-hv-border">
          <div className="px-4 py-3">
            <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">Birth Date</div>
            <div className="text-sm font-medium text-hv-charcoal">{formatDateOnly(child.birthDate)}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">Weight</div>
            <div className="text-sm font-medium text-hv-charcoal">{(child.weight / 1000).toFixed(2)} kg</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">Nutritional State</div>
            <div className="text-sm font-medium text-hv-charcoal">{child.nutritionalState || '—'}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">Date Entered</div>
            <div className="text-sm font-medium text-hv-charcoal">{child.dateEntered ? formatDate(child.dateEntered) : '—'}</div>
          </div>
        </div>

        {/* Z-score row */}
        {zscore && (
          <div className="px-4 py-3 border-t border-hv-border flex items-center gap-4">
            <div className="text-xs text-hv-sage uppercase tracking-wide">Weight-for-Age Z-Score</div>
            <ZScoreBadge zScore={zscore.zScore} label="Weight-for-Age" showValue={true} />
            <span className="text-xs text-hv-sage">{child.zScores!.ageInDays} days old</span>
          </div>
        )}

        {/* Notes / enrollment reason */}
        {(child.reasonEnrollment || child.observations) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-hv-border border-t border-hv-border">
            {child.reasonEnrollment && (
              <div className="px-4 py-3">
                <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">Reason for Enrollment</div>
                <div className="text-sm text-hv-charcoal">{child.reasonEnrollment}</div>
              </div>
            )}
            {child.observations && (
              <div className="px-4 py-3">
                <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">Observations</div>
                <div className="text-sm text-hv-charcoal">{child.observations}</div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Visit History */}
      <div className="bg-white rounded-xl border border-hv-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-hv-border">
          <h2 className="text-sm font-semibold text-hv-charcoal">Visit History</h2>
          {sortedVisits.length > 0 && (
            <span className="text-xs text-hv-sage">{sortedVisits.length} visit{sortedVisits.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {isLoadingVisits ? (
          <div className="px-4 py-6 text-center text-hv-gray text-sm">Loading visits...</div>
        ) : visitsError ? (
          <div className="px-4 py-4 text-hv-crisis text-sm">Error loading visits</div>
        ) : sortedVisits.length === 0 ? (
          <div className="px-4 py-6 text-center text-hv-gray text-sm">No visits recorded yet</div>
        ) : (
          <>
            {/* Charts — only when 2+ visits */}
            {chartData && (
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-hv-border border-b border-hv-border">
                {([
                  { key: 'weight', label: 'Weight (kg)',         color: '#2f4f39' },
                  { key: 'muac',   label: 'Arm Circ. (cm)',      color: '#C27D5F', refLine: 11.5 },
                  { key: 'height', label: 'Height (cm)',         color: '#637dff' },
                ] as { key: string; label: string; color: string; refLine?: number }[]).map(({ key, label, color, refLine }) => (
                  <div key={key} className="px-4 py-4">
                    <div className="text-xs font-medium text-hv-sage uppercase tracking-wide mb-2">{label}</div>
                    <ResponsiveContainer width="100%" height={110}>
                      <LineChart data={chartData} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#7A8B76' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#7A8B76' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 11 }}
                          formatter={(val: number) => [val, label]}
                        />
                        {refLine && (
                          <ReferenceLine y={refLine} stroke="#c0392b" strokeDasharray="4 2"
                            label={{ value: `${refLine}`, fontSize: 9, fill: '#c0392b' }} />
                        )}
                        <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2}
                          dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 4 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-hv-page">
                    <th className="w-8 px-3 py-2" />
                    {['Date', 'Weight (kg)', 'MUAC (cm)', 'Height (cm)', 'Notes'].map(h => (
                      <th key={h} className="text-left px-4 py-2 text-xs font-medium text-hv-sage uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hv-border">
                  {sortedVisits.map((visit: ChildVisitRead) => {
                    const isOpen = expandedVisitId === visit.id;
                    const extras: { label: string; value: React.ReactNode }[] = [
                      { label: 'INCAP',             value: visit.incap            ? 'Yes' : 'No' },
                      { label: 'Leche',             value: visit.leche            ? 'Yes' : 'No' },
                      { label: 'Bags Given',        value: visit.bagsGiven ?? '—' },
                      { label: 'Received Medicine', value: visit.recvAnyMedicine  ? 'Yes' : 'No' },
                      { label: 'Left Program',      value: visit.leftFromProg     ? 'Yes' : 'No' },
                      { label: 'Passed Away',       value: visit.passedAway       ? 'Yes' : 'No' },
                    ];
                    return (
                      <React.Fragment key={visit.id}>
                        <tr
                          className={`cursor-pointer transition-colors ${isOpen ? 'bg-hv-page' : 'hover:bg-hv-page'}`}
                          onClick={() => setExpandedVisitId(isOpen ? null : visit.id)}
                        >
                          <td className="px-3 py-2.5 text-hv-sage">
                            {isOpen
                              ? <ChevronDown size={14} />
                              : <ChevronRight size={14} />}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-hv-charcoal">{formatDateOnly(visit.visitDate)}</td>
                          <td className="px-4 py-2.5 text-sm text-hv-charcoal">{(visit.weight / 1000).toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-sm text-hv-charcoal">{visit.armCircumference > 0 ? (visit.armCircumference / 10).toFixed(1) : '—'}</td>
                          <td className="px-4 py-2.5 text-sm text-hv-charcoal">{visit.height > 0 ? (visit.height / 10).toFixed(1) : '—'}</td>
                          <td className="px-4 py-2.5 text-sm text-hv-charcoal truncate max-w-xs">{visit.notes || '—'}</td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-hv-page">
                            <td />
                            <td colSpan={5} className="px-4 pb-4 pt-2">
                              <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-6 gap-y-2 mb-3">
                                {extras.map(({ label, value }) => (
                                  <div key={label}>
                                    <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">{label}</div>
                                    <div className="text-sm font-medium text-hv-charcoal">{value}</div>
                                  </div>
                                ))}
                              </div>
                              {visit.notes && (
                                <div>
                                  <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">Notes</div>
                                  <div className="text-sm text-hv-charcoal">{visit.notes}</div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChildDetailPage;
