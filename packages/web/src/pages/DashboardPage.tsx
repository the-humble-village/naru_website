import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import { familiesApi } from '../api/families';
import { childrenApi } from '../api/children';
import { FamilyRead, ChildRead, type TranslationKey } from '@naru/shared';
import { useTranslation } from '../hooks/useTranslation';
import {
  Users, Baby, AlertTriangle, CalendarCheck, ClipboardList, UserRound, Plus,
  LayoutDashboard, X, ChevronRight,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useFamilyTable } from './families/useFamilyTable';
import { FamiliesTable } from './families/FamiliesTable';

type ActiveTab = 'overview' | 'families';

function timeAgo(dateStr: string, t: (key: TranslationKey) => string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days === 0) return t('dash.today');
  if (days === 1) return t('dash.yesterday');
  return t('dash.days_ago').replace('{days}', days.toString());
}

const COLLAPSED_COUNT = 3;
const COMMUNITY_COLLAPSED_COUNT = 5;

interface OverviewSectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  empty: string;
  action?: React.ReactNode;
  children: React.ReactNode[];
}

const OverviewSection: React.FC<OverviewSectionProps> = ({ title, icon, count, empty, action, children }) => {
  const [expanded, setExpanded] = React.useState(false);
  const visible = expanded ? children : children.slice(0, COLLAPSED_COUNT);
  const hasMore = children.length > COLLAPSED_COUNT;

  return (
    <div className="bg-white rounded-xl border border-hv-border">
      <div className="flex items-center justify-between px-4 py-3 border-b border-hv-border">
        <h2 className="text-sm font-semibold text-hv-charcoal flex items-center gap-1.5">
          {icon}
          {title}
          {count > 0 && (
            <span className="ml-1 bg-hv-page text-hv-sage text-xs px-1.5 py-0.5 rounded-full">{count}</span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          {action}
          {hasMore && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs text-hv-terracotta hover:underline"
            >
              {expanded ? 'Show less' : `Show all ${children.length}`}
            </button>
          )}
        </div>
      </div>
      <div className="px-4 py-2">
        {children.length === 0 ? (
          <p className="text-sm text-hv-gray py-2">{empty}</p>
        ) : (
          visible
        )}
      </div>
    </div>
  );
};

// ── AddVisitModal ─────────────────────────────────────────────────────────────
type VisitType = 'family' | 'child';
type ModalStep = 'type' | 'family' | 'child';

interface AddVisitModalProps {
  onClose: () => void;
}

const AddVisitModal: React.FC<AddVisitModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<ModalStep>('type');
  const [visitType, setVisitType] = useState<VisitType | null>(null);
  const [familySearch, setFamilySearch] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<FamilyRead | null>(null);

  const { data: familiesData, isLoading: familiesLoading } = useQuery({
    queryKey: ['modal-families', familySearch],
    queryFn: () => familiesApi.listFamilies({ search: familySearch.trim() || undefined, limit: 20 }),
    enabled: step === 'family',
  });

  const { data: children = [], isLoading: childrenLoading } = useQuery({
    queryKey: ['modal-children', selectedFamily?.id],
    queryFn: () => childrenApi.listChildren(selectedFamily!.id),
    enabled: step === 'child' && !!selectedFamily,
  });

  const modalFamilies = familiesData?.families ?? [];

  const handleSelectType = (type: VisitType) => {
    setVisitType(type);
    setStep('family');
  };

  const handleSelectFamily = (family: FamilyRead) => {
    if (visitType === 'family') {
      navigate(`/families/${family.id}/visits/new`);
      onClose();
    } else {
      setSelectedFamily(family);
      setStep('child');
    }
  };

  const handleSelectChild = (child: ChildRead) => {
    navigate(`/families/${selectedFamily!.id}/children/${child.id}/visits/new`);
    onClose();
  };

  const handleBack = () => {
    if (step === 'family') { setStep('type'); setFamilySearch(''); }
    else if (step === 'child') { setStep('family'); setSelectedFamily(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-hv-card rounded-lg border border-hv-border shadow-xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-hv-border">
          <div className="flex items-center gap-2">
            {step !== 'type' && (
              <button onClick={handleBack} className="text-hv-gray hover:text-hv-green transition-colors mr-1">
                ←
              </button>
            )}
            <h2 className="text-base font-semibold text-hv-charcoal">
              {step === 'type' && t('common.add_visit')}
              {step === 'family' && t('dash.select_family')}
              {step === 'child' && `Children of ${selectedFamily?.familyName || 'Family'}`}
            </h2>
          </div>
          <button onClick={onClose} className="text-hv-gray hover:text-hv-charcoal transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {step === 'type' && (
            <div className="space-y-3">
              <p className="text-sm text-hv-gray mb-4">What kind of visit would you like to record?</p>
              <button
                onClick={() => handleSelectType('family')}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-hv-border hover:border-hv-green hover:bg-hv-page transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Users size={20} className="text-hv-green" />
                  <div className="text-left">
                    <div className="text-sm font-medium text-hv-charcoal">{t('dash.family_visit')}</div>
                    <div className="text-xs text-hv-gray">Record a visit for the whole family</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-hv-gray group-hover:text-hv-green transition-colors" />
              </button>
              <button
                onClick={() => handleSelectType('child')}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-hv-border hover:border-hv-green hover:bg-hv-page transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Baby size={20} className="text-hv-green" />
                  <div className="text-left">
                    <div className="text-sm font-medium text-hv-charcoal">{t('dash.child_visit')}</div>
                    <div className="text-xs text-hv-gray">Record a visit for a specific child</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-hv-gray group-hover:text-hv-green transition-colors" />
              </button>
            </div>
          )}

          {step === 'family' && (
            <div className="space-y-3">
              <input
                autoFocus
                type="text"
                placeholder="Search families..."
                value={familySearch}
                onChange={e => setFamilySearch(e.target.value)}
                className="w-full px-3 py-2 border border-hv-border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-hv-accent"
              />
              <div className="max-h-64 overflow-y-auto space-y-1">
                {familiesLoading ? (
                  <p className="text-sm text-hv-gray text-center py-4">Loading...</p>
                ) : modalFamilies.length === 0 ? (
                  <p className="text-sm text-hv-gray text-center py-4">{t('families.none_found')}</p>
                ) : (
                  modalFamilies.map(family => (
                    <button
                      key={family.id}
                      onClick={() => handleSelectFamily(family)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-hv-page transition-colors text-left group"
                    >
                      <span className="text-sm font-medium text-hv-charcoal group-hover:text-hv-green transition-colors">
                        {family.familyName || 'Unnamed Family'}
                      </span>
                      <ChevronRight size={14} className="text-hv-gray shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {step === 'child' && (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {childrenLoading ? (
                <p className="text-sm text-hv-gray text-center py-4">Loading...</p>
              ) : children.length === 0 ? (
                <p className="text-sm text-hv-gray text-center py-4">No children found for this family</p>
              ) : (
                children.map(child => (
                  <button
                    key={child.id}
                    onClick={() => handleSelectChild(child)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-hv-page transition-colors text-left group"
                  >
                    <span className="text-sm font-medium text-hv-charcoal group-hover:text-hv-green transition-colors">
                      {child.name}
                    </span>
                    <ChevronRight size={14} className="text-hv-gray shrink-0" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── DashboardPage ─────────────────────────────────────────────────────────────
export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [showAddVisitModal, setShowAddVisitModal] = useState(false);
  const [showAllCommunities, setShowAllCommunities] = useState(false);
  const table = useFamilyTable();

  const { data: dashboardData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.fetchDashboardData,
  });

  const stats = dashboardData?.stats;

  const communityRows = useMemo(
    () => (dashboardData?.communityBreakdown ?? []).slice().sort((a, b) => b.families - a.families),
    [dashboardData?.communityBreakdown],
  );

  const crisisByCommunity = useMemo(() => {
    if (!dashboardData?.familiesInCrisis) return [];
    const counts: Record<string, number> = {};
    dashboardData.familiesInCrisis.forEach((f) => {
      const name = f.communityId ? (table.communityLookup[f.communityId] ?? 'Unknown') : 'No Community';
      counts[name] = (counts[name] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [dashboardData?.familiesInCrisis, table.communityLookup]);

  const handleCrisisCardClick = () => {
    setActiveTab('families');
    table.setInCrisisFilter(true);
    table.setCurrentPage(1);
  };

  return (
    <>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-serif font-bold text-hv-charcoal">{t('nav.dashboard')}</h1>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="col-span-2 bg-white p-5 rounded-xl border border-hv-border">
            <div className="flex gap-8 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-bold text-hv-green">{dashLoading ? '—' : stats?.totalFamilies ?? 0}</div>
                  <Users className="text-hv-sage" size={20} />
                </div>
                <div className="text-xs text-hv-sage mt-0.5 uppercase tracking-wide">{t('dash.total_families')}</div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-bold text-hv-green">{dashLoading ? '—' : stats?.totalChildren ?? 0}</div>
                  <Baby className="text-hv-sage" size={20} />
                </div>
                <div className="text-xs text-hv-sage mt-0.5 uppercase tracking-wide">{t('dash.total_children')}</div>
              </div>
            </div>
            {!dashLoading && communityRows.length > 0 && (
              <>
                <table className="w-full text-xs border-t border-hv-border pt-2 mt-1">
                  <thead>
                    <tr className="text-hv-sage uppercase tracking-wide">
                      <th className="text-left py-1 font-medium">{t('families.col_community')}</th>
                      <th className="text-right py-1 font-medium">{t('nav.families')}</th>
                      <th className="text-right py-1 font-medium">{t('families.col_children')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showAllCommunities ? communityRows : communityRows.slice(0, COMMUNITY_COLLAPSED_COUNT)).map((row) => {
                      const name = row.communityId ? (table.communityLookup[row.communityId] ?? 'Unknown') : 'No Community';
                      return (
                        <tr key={row.communityId ?? 'none'} className="border-t border-hv-border/50">
                          <td className="py-1 text-hv-charcoal">{name}</td>
                          <td className="py-1 text-right text-hv-charcoal font-medium">{row.families}</td>
                          <td className="py-1 text-right text-hv-charcoal font-medium">{row.children}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {communityRows.length > COMMUNITY_COLLAPSED_COUNT && (
                  <button
                    onClick={() => setShowAllCommunities(v => !v)}
                    className="mt-1.5 text-xs text-hv-terracotta hover:underline"
                  >
                    {showAllCommunities
                      ? t('dash.show_less')
                      : t('dash.more_communities').replace(
                          '{count}',
                          (communityRows.length - COMMUNITY_COLLAPSED_COUNT).toString()
                        )}
                  </button>
                )}
              </>
            )}
          </div>

          <button
            onClick={handleCrisisCardClick}
            className="bg-white p-6 rounded-xl border border-hv-border text-left hover:border-hv-crisis/40 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center gap-2">
              <div className="text-3xl font-bold text-hv-crisis">
                {dashLoading ? '—' : stats?.familiesInCrisis ?? 0}
              </div>
              <AlertTriangle className="text-hv-crisis" size={24} />
            </div>
            <div className="text-xs text-hv-sage mt-1 uppercase tracking-wide">{t('dash.crisis')}</div>
            {!dashLoading && crisisByCommunity.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-hv-border pt-2">
                {crisisByCommunity.map(([community, count]) => (
                  <div key={community} className="flex justify-between text-xs text-hv-charcoal">
                    <span className="truncate mr-2 text-hv-sage">{community}</span>
                    <span className="font-medium text-hv-crisis shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </button>

          <div className="bg-white p-4 rounded-xl border border-hv-border flex flex-col">
            <div className="flex items-start justify-between mb-1">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-hv-green">
                    {dashLoading ? '—' : stats?.visitsThisMonth ?? 0}
                  </span>
                  <CalendarCheck className="text-hv-sage" size={24} />
                </div>
                <div className="text-xs text-hv-sage uppercase tracking-wide mt-0.5">{t('dash.visits_this_month')}</div>
              </div>
            </div>
            <div className="flex-1" style={{ height: 60 }}>
              {dashboardData?.visitsPerMonth && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.visitsPerMonth} margin={{ top: 2, right: 4, left: -32, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 8, fill: '#7A8B76' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 8, fill: '#7A8B76' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 11 }}
                      cursor={{ stroke: '#e0e0e0' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#2f4f39"
                      strokeWidth={2}
                      dot={{ r: 2, fill: '#2f4f39', strokeWidth: 0 }}
                      activeDot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-hv-border mb-6">
          <nav className="-mb-px flex gap-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-hv-terracotta text-hv-terracotta'
                  : 'border-transparent text-hv-sage hover:text-hv-charcoal hover:border-hv-border'
              }`}
            >
              <LayoutDashboard size={15} />
              {t('dash.overview')}
            </button>
            <button
              onClick={() => setActiveTab('families')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'families'
                  ? 'border-hv-terracotta text-hv-terracotta'
                  : 'border-transparent text-hv-sage hover:text-hv-charcoal hover:border-hv-border'
              }`}
            >
              <Users size={15} />
              {t('nav.families')}
              {!table.familiesLoading && table.totalFamilies > 0 && (
                <span className="ml-1 bg-hv-page text-hv-sage text-xs px-1.5 py-0.5 rounded-full">
                  {table.totalFamilies}
                </span>
              )}
            </button>
          </nav>
          {activeTab === 'families' && (
            <Link
              to="/families/new"
              className="flex items-center gap-1.5 bg-hv-terracotta text-white px-3 py-1.5 rounded-md hover:bg-hv-terracotta-hover transition-colors text-sm font-medium mb-px"
            >
              <Plus size={15} />
              {t('add_family.title')}
            </Link>
          )}
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div>
            {dashLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-hv-gray">Loading...</div>
              </div>
            ) : !dashboardData ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-hv-gray">{t('dash.no_data')}</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <OverviewSection
                  title={t('dash.recent_visits')}
                  icon={<ClipboardList size={16} className="text-hv-sage" />}
                  count={dashboardData.recentVisits.childVisits.length + dashboardData.recentVisits.familyVisits.length}
                  empty={t('dash.no_visits')}
                  action={
                    <button
                      onClick={() => setShowAddVisitModal(true)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover transition-colors"
                    >
                      <Plus size={12} />
                      {t('common.add_visit')}
                    </button>
                  }
                >
                  {[
                    ...dashboardData.recentVisits.childVisits.map(v => ({
                      key: `child-${v.id}`,
                      primary: v.child.name,
                      secondary: `${t('dash.child_visit')} · ${timeAgo(v.visitDate, t)}`,
                      to: `/families/${v.familyId}/children/${v.childId}/visits/${v.id}`,
                    })),
                    ...dashboardData.recentVisits.familyVisits.map(v => ({
                      key: `family-${v.id}`,
                      primary: v.family.familyName || 'Unnamed Family',
                      secondary: `${t('dash.family_visit')} · ${timeAgo(v.visitDate, t)}`,
                      to: `/families/${v.familyId}/visits/${v.id}`,
                    })),
                  ].map(item => (
                    <Link
                      key={item.key}
                      to={item.to}
                      className="flex items-baseline justify-between gap-2 py-1.5 border-b border-hv-border last:border-b-0 hover:bg-hv-page -mx-4 px-4 transition-colors group"
                    >
                      <span className="text-sm font-medium text-hv-charcoal group-hover:text-hv-green truncate transition-colors">{item.primary}</span>
                      <span className="text-xs text-hv-sage shrink-0">{item.secondary}</span>
                    </Link>
                  ))}
                </OverviewSection>

                <OverviewSection
                  title={t('dash.recent_children_title')}
                  icon={<UserRound size={16} className="text-hv-sage" />}
                  count={dashboardData.recentlyUpdatedChildren.length}
                  empty={t('dash.no_children')}
                >
                  {dashboardData.recentlyUpdatedChildren.map(child => (
                    <Link
                      key={child.id}
                      to={`/families/${child.familyId}/children/${child.id}`}
                      className="block py-1.5 border-b border-hv-border last:border-b-0 hover:bg-hv-page -mx-4 px-4 transition-colors group"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-hv-charcoal group-hover:text-hv-green truncate transition-colors">{child.name}</span>
                        <span className="text-xs text-hv-sage shrink-0">
                          {child.family.familyName || 'Unnamed Family'}
                          {child.latestVisit && ` · ${timeAgo(child.latestVisit.visitDate, t)}`}
                        </span>
                      </div>
                      {child.latestVisit && (
                        <div className="text-xs text-hv-gray mt-0.5">
                          {child.latestVisit.weight.toFixed(1)} kg
                          {child.latestVisit.height > 0 && ` · ${child.latestVisit.height} mm`}
                        </div>
                      )}
                    </Link>
                  ))}
                </OverviewSection>
              </div>
            )}
          </div>
        )}

        {/* Families tab */}
        {activeTab === 'families' && (
          <FamiliesTable table={table} highlightCrisis compact />
        )}
      </div>
      {showAddVisitModal && <AddVisitModal onClose={() => setShowAddVisitModal(false)} />}
    </>
  );
};

export default DashboardPage;
