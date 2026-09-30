import React, { useRef, useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { useTranslation } from '../hooks/useTranslation';
import { SearchBar } from './SearchBar';
import { programsApi } from '../api/programs';
import { dashboardApi } from '../api/dashboard';
import {
  LayoutDashboard,
  Layers,
  Users,
  User,
  Baby,
  Home,
  ClipboardList,
  BarChart3,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Languages,
} from 'lucide-react';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive ? 'bg-hv-green-hover text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
  }`;

const subLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center justify-between gap-2 pl-9 pr-3 py-1.5 rounded-md text-sm transition-colors ${
    isActive ? 'bg-hv-green-hover text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
  }`;

interface SidebarNavProps {
  onNavigate?: () => void;
}

const SidebarNav: React.FC<SidebarNavProps> = ({ onNavigate }) => {
  const { user } = useAuthStore();
  const { t } = useTranslation();

  // The program list is data-driven: adding a program row in Admin makes it
  // appear here with no code change (WEB_DESIGN_V2 §2).
  const { data: programs } = useQuery({
    queryKey: ['programs', { activeOnly: true }],
    queryFn: () => programsApi.listPrograms({ activeOnly: true }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: unenrolled } = useQuery({
    queryKey: ['unenrolled-count'],
    queryFn: () => dashboardApi.fetchUnenrolledCount(),
    staleTime: 60 * 1000,
  });

  const unenrolledCount = unenrolled?.total ?? 0;
  const isStaff = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Main">
      <NavLink to="/" end className={linkClass} onClick={onNavigate}>
        <LayoutDashboard size={16} />
        {t('nav.dashboard')}
      </NavLink>

      <div className="space-y-0.5">
        <NavLink to="/programs" end className={linkClass} onClick={onNavigate}>
          <Layers size={16} />
          {t('nav.programs')}
        </NavLink>
        {programs?.items.length === 0 && (
          <p className="pl-9 pr-3 py-1.5 text-sm text-white/50">{t('nav.no_programs')}</p>
        )}
        {programs?.items.map((program) => (
          <NavLink
            key={program.id}
            to={`/programs/${program.id}`}
            className={subLinkClass}
            onClick={onNavigate}
          >
            <span className="truncate">{program.name}</span>
          </NavLink>
        ))}
      </div>

      <div className="space-y-0.5">
        <p className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white">
          <Users size={16} />
          {t('nav.people')}
        </p>
        <NavLink to="/mothers" className={subLinkClass} onClick={onNavigate}>
          <span className="flex items-center gap-2">
            <User size={14} />
            {t('nav.mothers')}
          </span>
        </NavLink>
        <NavLink to="/children" className={subLinkClass} onClick={onNavigate}>
          <span className="flex items-center gap-2">
            <Baby size={14} />
            {t('nav.children')}
          </span>
        </NavLink>
        <NavLink to="/people" className={subLinkClass} onClick={onNavigate}>
          <span className="flex items-center gap-2">
            <User size={14} />
            {t('nav.persons')}
          </span>
        </NavLink>
        <NavLink to="/families" className={subLinkClass} onClick={onNavigate}>
          <span className="flex items-center gap-2">
            <Home size={14} />
            {t('nav.families')}
          </span>
        </NavLink>
        {unenrolledCount > 0 && (
          <NavLink to="/unenrolled" className={subLinkClass} onClick={onNavigate}>
            <span className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-hv-terracotta" />
              {t('nav.unenrolled')}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-hv-terracotta text-white text-xs font-semibold">
              {unenrolledCount}
            </span>
          </NavLink>
        )}
      </div>

      <div className="space-y-0.5">
        <NavLink to="/visits" className={linkClass} onClick={onNavigate}>
          <ClipboardList size={16} />
          {t('nav.visits')}
        </NavLink>
        <NavLink to="/reports" className={linkClass} onClick={onNavigate}>
          <BarChart3 size={16} />
          {t('nav.reports')}
        </NavLink>
        <NavLink to="/events" className={linkClass} onClick={onNavigate}>
          <Calendar size={16} />
          {t('nav.events')}
        </NavLink>
        {isStaff && (
          <NavLink to="/admin" className={linkClass} onClick={onNavigate}>
            <ShieldCheck size={16} />
            {t('nav.admin')}
          </NavLink>
        )}
      </div>
    </nav>
  );
};

/**
 * Sidebar shell: brand + data-driven nav on the left, header with global search
 * and the user menu on top, routed content beneath.
 */
export const Layout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '';

  const brand = (
    <Link to="/" className="flex items-center h-16 px-5 shrink-0">
      <span className="text-white text-xl font-serif font-bold tracking-wide leading-none">
        {t('nav.brand')}
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-hv-page flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-hv-green sticky top-0 h-screen">
        {brand}
        <SidebarNav />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex flex-col w-64 max-w-[80%] h-full bg-hv-green shadow-xl">
            <div className="flex items-center justify-between pr-2">
              {brand}
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label={t('nav.close_menu')}
                className="text-white/80 hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <SidebarNav onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-40 bg-hv-card border-b border-hv-border">
          <div className="flex items-center gap-3 h-16 px-4 sm:px-6">
            <button
              className="md:hidden text-hv-charcoal p-1.5 rounded-md hover:bg-hv-page transition-colors"
              onClick={() => setDrawerOpen(true)}
              aria-label={t('nav.open_menu')}
            >
              <Menu size={20} />
            </button>

            <div className="flex flex-1 min-w-0 max-w-md">
              <SearchBar className="w-full" />
            </div>

            {user && (
              <div className="relative shrink-0" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-hv-page transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-hv-terracotta flex items-center justify-center text-white text-xs font-bold select-none">
                    {initials}
                  </div>
                  <div className="hidden sm:flex flex-col items-start leading-tight">
                    <span className="text-hv-charcoal text-sm font-medium">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="text-hv-sage text-xs capitalize">{user.role?.toLowerCase()}</span>
                  </div>
                  <ChevronDown size={14} className="text-hv-sage hidden sm:block" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-hv-border z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-hv-border bg-hv-page">
                      <p className="text-sm font-semibold text-hv-charcoal">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-hv-sage capitalize">{user.role?.toLowerCase()}</p>
                    </div>
                    <Link
                      to="/admin/language"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 w-full px-4 py-3 text-sm text-hv-charcoal hover:bg-hv-page transition-colors"
                    >
                      <Languages size={15} className="text-hv-sage" />
                      {t('admin.language')}
                    </Link>
                    <div className="border-t border-hv-border" />
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="flex items-center gap-2 w-full px-4 py-3 text-sm text-hv-crisis hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={15} />
                      {t('profile.logout')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
