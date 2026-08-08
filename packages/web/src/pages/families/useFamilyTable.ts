import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { familiesApi } from '../../api/families';
import { adminApi } from '../../api/admin';

export type SortColumn = 'familyName' | 'community' | 'site' | 'inCrisis' | 'updatedAt' | 'childrenEditable';
export type SortDirection = 'asc' | 'desc';
export type ColumnKey = 'familyName' | 'community' | 'site' | 'inCrisis' | 'notes' | 'childrenEditable' | 'updatedAt';

export const SORTABLE: Set<ColumnKey> = new Set([
  'familyName', 'community', 'site', 'inCrisis', 'updatedAt', 'childrenEditable',
]);

export const ALL_COLUMNS: { key: ColumnKey; label: string; defaultWidth: number; defaultVisible: boolean }[] = [
  { key: 'familyName',       label: 'Family Name',   defaultWidth: 200, defaultVisible: true  },
  { key: 'community',        label: 'Community',     defaultWidth: 150, defaultVisible: true  },
  { key: 'site',             label: 'Site',          defaultWidth: 150, defaultVisible: false },
  { key: 'inCrisis',         label: 'Crisis Status', defaultWidth: 130, defaultVisible: true  },
  { key: 'updatedAt',        label: 'Last Updated',  defaultWidth: 130, defaultVisible: true  },
  { key: 'notes',            label: 'Notes',         defaultWidth: 220, defaultVisible: false },
  { key: 'childrenEditable', label: 'Children',      defaultWidth: 100, defaultVisible: false },
];

const DEFAULT_VISIBLE = ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
const DEFAULT_WIDTHS = Object.fromEntries(
  ALL_COLUMNS.map((c) => [c.key, c.defaultWidth])
) as Record<ColumnKey, number>;

export function useFamilyTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | ''>('');
  const [selectedSiteId, setSelectedSiteId] = useState<number | ''>('');
  const [inCrisisFilter, setInCrisisFilter] = useState<boolean | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_VISIBLE);
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(DEFAULT_WIDTHS);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef<{ colKey: ColumnKey; startX: number; startWidth: number } | null>(null);
  const dragCleanupRef = useRef<{ move: (ev: MouseEvent) => void; up: () => void } | null>(null);

  useEffect(() => {
    if (!showColumnPicker) return;
    const handler = (e: MouseEvent) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColumnPicker]);

  useEffect(() => {
    return () => {
      if (dragCleanupRef.current) {
        document.removeEventListener('mousemove', dragCleanupRef.current.move);
        document.removeEventListener('mouseup', dragCleanupRef.current.up);
      }
    };
  }, []);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, colKey: ColumnKey) => {
      e.preventDefault();
      e.stopPropagation();
      const startWidth = columnWidths[colKey] ?? DEFAULT_WIDTHS[colKey];
      resizingRef.current = { colKey, startX: e.clientX, startWidth };
      const onMouseMove = (ev: MouseEvent) => {
        if (!resizingRef.current) return;
        const newWidth = Math.max(60, resizingRef.current.startWidth + ev.clientX - resizingRef.current.startX);
        setColumnWidths((prev) => ({ ...prev, [resizingRef.current!.colKey]: newWidth }));
      };
      const onMouseUp = () => {
        resizingRef.current = null;
        dragCleanupRef.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      dragCleanupRef.current = { move: onMouseMove, up: onMouseUp };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [columnWidths]
  );

  const { data: rawCommunities = [], isLoading: communitiesLoading } = useQuery({
    queryKey: ['communities'],
    queryFn: adminApi.fetchCommunities,
  });

  const communities = useMemo(
    () => Array.from(new Map(rawCommunities.map((c) => [c.title, c])).values()),
    [rawCommunities]
  );

  const communityLookup = useMemo(() => {
    const lookup: Record<number, string> = {};
    communities.forEach((c) => { lookup[c.id] = c.title; });
    return lookup;
  }, [communities]);

  const { data: rawSites = [], isLoading: sitesLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: adminApi.fetchSites,
  });

  const sites = useMemo(
    () => Array.from(new Map(rawSites.map((s) => [s.title, s])).values()),
    [rawSites]
  );

  const siteLookup = useMemo(() => {
    const lookup: Record<number, string> = {};
    sites.forEach((s) => { lookup[s.id] = s.title; });
    return lookup;
  }, [sites]);

  const queryParams = useMemo(
    () => ({
      search: searchTerm.trim() || undefined,
      communityId: selectedCommunityId || undefined,
      siteId: selectedSiteId || undefined,
      inCrisis: inCrisisFilter !== '' ? inCrisisFilter : undefined,
      skip: (currentPage - 1) * pageSize,
      limit: pageSize,
    }),
    [searchTerm, selectedCommunityId, selectedSiteId, inCrisisFilter, currentPage, pageSize]
  );

  const { data: familiesData, isLoading: familiesLoading, isError, error } = useQuery({
    queryKey: ['families', queryParams],
    queryFn: () => familiesApi.listFamilies(queryParams),
  });

  const rawFamilies = familiesData?.families ?? [];
  const totalFamilies = familiesData?.total ?? 0;
  const totalPages = Math.ceil(totalFamilies / pageSize);

  const handleFilterChange = () => setCurrentPage(1);

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const families = useMemo(() => {
    if (!sortColumn) return rawFamilies;
    return [...rawFamilies].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortColumn) {
        case 'familyName':
          aVal = (a.familyName || '').toLowerCase();
          bVal = (b.familyName || '').toLowerCase();
          break;
        case 'community':
          aVal = (a.communityId ? communityLookup[a.communityId] ?? '' : '').toLowerCase();
          bVal = (b.communityId ? communityLookup[b.communityId] ?? '' : '').toLowerCase();
          break;
        case 'site':
          aVal = (a.siteId ? siteLookup[a.siteId] ?? '' : '').toLowerCase();
          bVal = (b.siteId ? siteLookup[b.siteId] ?? '' : '').toLowerCase();
          break;
        case 'inCrisis':
          aVal = a.inCrisis ? 1 : 0;
          bVal = b.inCrisis ? 1 : 0;
          break;
        case 'childrenEditable':
          aVal = a.childrenEditable;
          bVal = b.childrenEditable;
          break;
        default:
          aVal = new Date(a.updatedAt).getTime();
          bVal = new Date(b.updatedAt).getTime();
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rawFamilies, sortColumn, sortDirection, communityLookup, siteLookup]);

  const activeColumns = useMemo(
    () => ALL_COLUMNS.filter((c) => visibleColumns.includes(c.key)),
    [visibleColumns]
  );

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  return {
    searchTerm, setSearchTerm,
    selectedCommunityId, setSelectedCommunityId,
    selectedSiteId, setSelectedSiteId,
    inCrisisFilter, setInCrisisFilter,
    currentPage, setCurrentPage,
    pageSize,
    sortColumn, sortDirection, handleSort,
    visibleColumns, columnWidths, showColumnPicker, setShowColumnPicker,
    columnPickerRef, activeColumns, toggleColumn,
    handleResizeMouseDown,
    communities, communitiesLoading,
    communityLookup,
    sites, sitesLoading,
    siteLookup,
    families, familiesLoading, isError, error,
    totalFamilies, totalPages,
    handleFilterChange,
  };
}

export type FamilyTableState = ReturnType<typeof useFamilyTable>;
