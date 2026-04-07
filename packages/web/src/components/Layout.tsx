import React, { useRef, useState, useEffect } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useTranslation } from '../hooks/useTranslation';
import { SearchBar } from './SearchBar';
import { LayoutDashboard, ShieldCheck, LogOut, Menu, X, ChevronDown, Languages } from 'lucide-react';

/**
 * Layout component with navigation bar and page shell
 */
export const Layout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-white/20 text-white'
        : 'text-white/80 hover:text-white hover:bg-white/10'
    }`;

  return (
    <div className="min-h-screen bg-hv-page">
      {/* Navigation Bar */}
      <nav className="bg-hv-green shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">

            {/* Left: Brand + Nav Links */}
            <div className="flex items-center gap-6 shrink-0">
              <Link to="/" className="flex items-center gap-2">
                <span className="text-white text-xl font-serif font-bold tracking-wide leading-none">
                  Humble Village
                </span>
              </Link>

              {/* Desktop Nav Links */}
              <div className="hidden md:flex items-center gap-1">
                <NavLink to="/" end className={navLinkClass}>
                  <LayoutDashboard size={15} />
                  {t('nav.dashboard')}
                </NavLink>
                {(user?.role === 'ADMIN' || user?.role === 'SUPERVISOR') && (
                  <NavLink to="/admin" className={navLinkClass}>
                    <ShieldCheck size={15} />
                    {t('nav.admin')}
                  </NavLink>
                )}
              </div>
            </div>

            {/* Center: Search */}
            <div className="flex flex-1 min-w-0 max-w-sm">
              <SearchBar className="w-full" />
            </div>

            {/* Right: User Menu + Mobile Toggle */}
            <div className="flex items-center gap-2 shrink-0">
              {user && (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen((o) => !o)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/10 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-hv-terracotta flex items-center justify-center text-white text-xs font-bold select-none">
                      {initials}
                    </div>
                    <div className="hidden md:flex flex-col items-start leading-tight">
                      <span className="text-white text-sm font-medium">
                        {user.firstName} {user.lastName}
                      </span>
                      <span className="text-white/60 text-xs capitalize">
                        {user.role?.toLowerCase()}
                      </span>
                    </div>
                    <ChevronDown size={14} className="text-white/60 hidden md:block" />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-hv-border z-50 overflow-hidden">
                      {/* User info header */}
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
                        onClick={() => { setUserMenuOpen(false); logout(); }}
                        className="flex items-center gap-2 w-full px-4 py-3 text-sm text-hv-crisis hover:bg-red-50 transition-colors"
                      >
                        <LogOut size={15} />
                        {t('profile.logout')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mobile hamburger */}
              <button
                className="md:hidden text-white/80 hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-colors"
                onClick={() => setMobileMenuOpen((o) => !o)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-hv-green px-4 py-3 space-y-1">
              <NavLink
              to="/" end
              className={navLinkClass}
              onClick={() => setMobileMenuOpen(false)}
            >
              <LayoutDashboard size={15} />
              {t('nav.dashboard')}
            </NavLink>
            {(user?.role === 'ADMIN' || user?.role === 'SUPERVISOR') && (
              <NavLink
                to="/admin"
                className={navLinkClass}
                onClick={() => setMobileMenuOpen(false)}
              >
                <ShieldCheck size={15} />
                {t('nav.admin')}
              </NavLink>
            )}
          </div>
        )}
      </nav>

      {/* Page Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-hv-card rounded-xl shadow-sm border border-hv-border p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
