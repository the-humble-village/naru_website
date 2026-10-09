import React, { useRef, useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { useTranslation } from '../hooks/useTranslation';
import { SearchBar } from './SearchBar';
import { programsApi } from '../api/programs';
import { dashboardApi } from '../api/dashboard';
import {
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

const topLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
    isActive ? 'bg-hv-green-hover text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
  }`;

const triggerClass = (isActive: boolean) =>
  `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
    isActive ? 'bg-hv-green-hover text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
  }`;

const menuItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center justify-between gap-2 px-4 py-2.5 text-sm transition-colors ${
    isActive ? 'bg-hv-page text-hv-green font-medium' : 'text-hv-charcoal hover:bg-hv-page'
  }`;

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
    isActive ? 'bg-hv-green-hover text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
  }`;

const countBadgeClass =
  'px-2 py-0.5 rounded-full bg-hv-terracotta text-white text-xs font-semibold';

interface NavMenuProps {
  buttonClass: string;
  trigger: (open: boolean) => React.ReactNode;
  align?: 'left' | 'right';
  width?: string;
  children: (close: () => void) => React.ReactNode;
}

const NavMenu: React.FC<NavMenuProps> = ({
  buttonClass,
  trigger,
  align = 'left',
  width = 'w-60',
  children,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={buttonClass}
      >
        {trigger(open)}
      </button>
      {open && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 ${width} bg-white rounded-xl shadow-lg border border-hv-border z-50 overflow-hidden py-1`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
};

const useNavData = () => {
  const { user } = useAuthStore();

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

  return {
    programs: programs?.items ?? [],
    programsLoaded: programs !== undefined,
    unenrolledCount: unenrolled?.total ?? 0,
    isStaff: user?.role === 'ADMIN' || user?.role === 'SUPERVISOR',
  };
};

const peopleRoots = ['/mothers', '/children', '/people', '/families', '/unenrolled'];

export const Layout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { programs, programsLoaded, unenrolledCount, isStaff } = useNavData();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '';

  const programsActive = location.pathname.startsWith('/programs');
  const peopleActive = peopleRoots.some((root) => location.pathname.startsWith(root));

  const peopleLinks = [
    { to: '/mothers', label: t('nav.mothers'), icon: <User size={14} /> },
    { to: '/children', label: t('nav.children'), icon: <Baby size={14} /> },
    { to: '/people', label: t('nav.persons'), icon: <User size={14} /> },
    { to: '/families', label: t('nav.families'), icon: <Home size={14} /> },
  ];

  const sectionLinks = [
    { to: '/visits', label: t('nav.visits'), icon: <ClipboardList size={16} />, staffOnly: false },
    { to: '/events', label: t('nav.events'), icon: <Calendar size={16} />, staffOnly: false },
    { to: '/reports', label: t('nav.reports'), icon: <BarChart3 size={16} />, staffOnly: true },
    { to: '/admin', label: t('nav.admin'), icon: <ShieldCheck size={16} />, staffOnly: true },
  ].filter((link) => !link.staffOnly || isStaff);

  return (
    <div className="min-h-screen bg-hv-page flex flex-col">
      <header className="sticky top-0 z-40 bg-hv-green shadow-lg">
        <div className="flex items-center gap-2 h-16 px-4 sm:px-6">
          <Link to="/" className="flex items-center shrink-0 pr-2">
            <span className="text-white text-xl font-serif font-bold tracking-wide leading-none">
              {t('nav.brand')}
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 shrink-0" aria-label="Main">
            <NavMenu
              buttonClass={triggerClass(programsActive)}
              trigger={(open) => (
                <>
                  <Layers size={16} />
                  {t('nav.programs')}
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </>
              )}
            >
              {(close) => (
                <>
                  <NavLink to="/programs" end className={menuItemClass} onClick={close}>
                    {t('nav.all_programs')}
                  </NavLink>
                  <div className="my-1 border-t border-hv-border" />
                  {programsLoaded && programs.length === 0 && (
                    <p className="px-4 py-2.5 text-sm text-hv-sage">{t('nav.no_programs')}</p>
                  )}
                  {programs.map((program) => (
                    <NavLink
                      key={program.id}
                      to={`/programs/${program.id}`}
                      className={menuItemClass}
                      onClick={close}
                    >
                      <span className="truncate">{program.name}</span>
                    </NavLink>
                  ))}
                </>
              )}
            </NavMenu>

            <NavMenu
              buttonClass={triggerClass(peopleActive)}
              trigger={(open) => (
                <>
                  <Users size={16} />
                  {t('nav.people')}
                  {unenrolledCount > 0 && <span className={countBadgeClass}>{unenrolledCount}</span>}
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </>
              )}
            >
              {(close) => (
                <>
                  {peopleLinks.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      className={menuItemClass}
                      onClick={close}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-hv-sage">{link.icon}</span>
                        {link.label}
                      </span>
                    </NavLink>
                  ))}
                  {unenrolledCount > 0 && (
                    <>
                      <div className="my-1 border-t border-hv-border" />
                      <NavLink to="/unenrolled" className={menuItemClass} onClick={close}>
                        <span className="flex items-center gap-2">
                          <AlertTriangle size={14} className="text-hv-terracotta" />
                          {t('nav.unenrolled')}
                        </span>
                        <span className={countBadgeClass}>{unenrolledCount}</span>
                      </NavLink>
                    </>
                  )}
                </>
              )}
            </NavMenu>
          </nav>

          <div className="flex flex-1 min-w-0 justify-center px-1 sm:px-3">
            <SearchBar className="w-full max-w-md" />
          </div>

          <nav className="hidden lg:flex items-center gap-1 shrink-0" aria-label="Sections">
            {sectionLinks.map((link) => (
              <NavLink key={link.to} to={link.to} className={topLinkClass}>
                {link.icon}
                {link.label}
              </NavLink>
            ))}
          </nav>

          {user && (
            <NavMenu
              align="right"
              width="w-52"
              buttonClass="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-white/10 transition-colors shrink-0"
              trigger={() => (
                <>
                  <div className="w-8 h-8 rounded-full bg-hv-terracotta flex items-center justify-center text-white text-xs font-bold select-none">
                    {initials}
                  </div>
                  <ChevronDown size={14} className="text-white/70 hidden sm:block" />
                </>
              )}
            >
              {(close) => (
                <>
                  <div className="px-4 py-3 border-b border-hv-border bg-hv-page">
                    <p className="text-sm font-semibold text-hv-charcoal">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-hv-sage capitalize">{user.role?.toLowerCase()}</p>
                  </div>
                  <Link
                    to="/admin/language"
                    onClick={close}
                    className="flex items-center gap-2 w-full px-4 py-3 text-sm text-hv-charcoal hover:bg-hv-page transition-colors"
                  >
                    <Languages size={15} className="text-hv-sage" />
                    {t('admin.language')}
                  </Link>
                  <div className="border-t border-hv-border" />
                  <button
                    onClick={() => {
                      close();
                      logout();
                    }}
                    className="flex items-center gap-2 w-full px-4 py-3 text-sm text-hv-crisis hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={15} />
                    {t('profile.logout')}
                  </button>
                </>
              )}
            </NavMenu>
          )}

          <button
            className="lg:hidden text-white/80 hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-colors shrink-0"
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? t('nav.close_menu') : t('nav.open_menu')}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileOpen && (
          <nav
            className="lg:hidden border-t border-white/10 px-3 py-3 space-y-1 max-h-[70vh] overflow-y-auto"
            aria-label="Mobile"
          >
            <NavLink to="/programs" end className={mobileLinkClass}>
              <span className="flex items-center gap-2">
                <Layers size={16} />
                {t('nav.programs')}
              </span>
            </NavLink>
            {programs.map((program) => (
              <NavLink
                key={program.id}
                to={`/programs/${program.id}`}
                className={({ isActive }) => `${mobileLinkClass({ isActive })} pl-9`}
              >
                <span className="truncate">{program.name}</span>
              </NavLink>
            ))}

            <p className="flex items-center gap-2 px-3 pt-3 pb-1 text-sm font-medium text-white">
              <Users size={16} />
              {t('nav.people')}
            </p>
            {peopleLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `${mobileLinkClass({ isActive })} pl-9`}
              >
                <span className="flex items-center gap-2">
                  {link.icon}
                  {link.label}
                </span>
              </NavLink>
            ))}
            {unenrolledCount > 0 && (
              <NavLink
                to="/unenrolled"
                className={({ isActive }) => `${mobileLinkClass({ isActive })} pl-9`}
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-hv-terracotta" />
                  {t('nav.unenrolled')}
                </span>
                <span className={countBadgeClass}>{unenrolledCount}</span>
              </NavLink>
            )}

            <div className="pt-3 space-y-1">
              {sectionLinks.map((link) => (
                <NavLink key={link.to} to={link.to} className={mobileLinkClass}>
                  <span className="flex items-center gap-2">
                    {link.icon}
                    {link.label}
                  </span>
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
