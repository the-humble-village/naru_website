import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout, ProtectedRoute, RoleGate, RedirectRoute } from './components';
import {
  LoginPage,
  DashboardPage,
  FamiliesPage,
  FamilyDetailPage,
  ChildDetailPage,
  AddFamilyPage,
  AddChildPage,
  AdminPage,
  AdminUsersPage,
  AdminLookupsPage,
  AdminBirthingAssistantsPage,
  AdminSitesPage,
  AdminProgramsPage,
  AdminQuestionSetsPage,
  EventsPage,
  AddEventPage,
  EventDetailPage,
  LanguagePage,
  PlaceholderPage,
  ErrorPage,
} from './pages';

// Create a React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const soon = (title: string, note?: string) => <PlaceholderPage title={title} note={note} />;

const adminOnly = (element: React.ReactNode) => (
  <RoleGate requiredRole={['ADMIN']}>{element}</RoleGate>
);

const supervisorPlus = (element: React.ReactNode) => (
  <RoleGate requiredRole={['SUPERVISOR', 'ADMIN']}>{element}</RoleGate>
);

// Route map per WEB_DESIGN_V2.md §3. Pages not yet built render a placeholder so
// navigation and redirects can be wired ahead of them.
const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },

      // Programs
      { path: 'programs', element: soon('Programs') },
      { path: 'programs/:id', element: soon('Program roster') },
      { path: 'programs/:id/enroll', element: soon('Enroll') },

      // Mothers
      { path: 'mothers', element: soon('Mothers') },
      { path: 'mothers/new', element: soon('New mother') },
      { path: 'mothers/:id', element: soon('Mother') },
      { path: 'mothers/:id/edit', element: soon('Edit mother') },

      // Children
      { path: 'children', element: soon('Children') },
      { path: 'children/new', element: <AddChildPage /> },
      { path: 'children/:id', element: <ChildDetailPage /> },
      { path: 'children/:id/edit', element: <RedirectRoute to="/children/:id" /> },

      // Persons
      { path: 'people', element: soon('Persons') },
      { path: 'people/new', element: soon('New person') },
      { path: 'people/:id', element: soon('Person') },
      { path: 'people/:id/edit', element: soon('Edit person') },

      // Families
      { path: 'families', element: <FamiliesPage /> },
      { path: 'families/new', element: <AddFamilyPage /> },
      { path: 'families/:id', element: <FamilyDetailPage /> },
      { path: 'families/:id/edit', element: <RedirectRoute to="/families/:id" /> },

      { path: 'unenrolled', element: soon('Unenrolled') },

      // Enrollments
      { path: 'enrollments/:id', element: soon('Enrollment') },
      { path: 'enrollments/:id/exit', element: soon('Exit program') },
      { path: 'enrollments/:id/visits/new', element: soon('Record visit') },

      // Visits
      { path: 'visits', element: soon('Visits') },
      { path: 'visits/:id', element: soon('Visit') },
      { path: 'visits/:id/edit', element: soon('Edit visit') },

      // Reports
      { path: 'reports', element: soon('Reports') },
      { path: 'reports/:slug', element: soon('Report') },

      // Events
      { path: 'events', element: <EventsPage /> },
      { path: 'events/new', element: <AddEventPage /> },
      { path: 'events/:id', element: <EventDetailPage /> },

      // V1 family-nested paths, kept for one release so bookmarks survive
      { path: 'families/:id/children/new', element: <RedirectRoute to="/children/new?familyId=:id" /> },
      { path: 'families/:id/children/:cid', element: <RedirectRoute to="/children/:cid" /> },
      { path: 'families/:id/parents/*', element: <RedirectRoute to="/families/:id" /> },
      { path: 'families/:id/visits/*', element: <RedirectRoute to="/families/:id" /> },

      // Admin
      { path: 'admin', element: supervisorPlus(<AdminPage />) },
      { path: 'admin/users', element: adminOnly(<AdminUsersPage />) },
      { path: 'admin/programs', element: adminOnly(<AdminProgramsPage />) },
      { path: 'admin/sites', element: adminOnly(<AdminSitesPage />) },
      { path: 'admin/question-sets', element: adminOnly(<AdminQuestionSetsPage />) },
      { path: 'admin/birthing-assistants', element: supervisorPlus(<AdminBirthingAssistantsPage />) },
      { path: 'admin/language', element: <LanguagePage /> },
      { path: 'admin/:table', element: adminOnly(<AdminLookupsPage />) },
    ],
  },
]);

/**
 * Main App component with React Router and React Query setup
 */
export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
};

export default App;
