import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout, ProtectedRoute, RoleGate } from './components';
import {
  LoginPage,
  SignupPage,
  DashboardPage,
  FamiliesPage,
  FamilyDetailPage,
  ChildDetailPage,
  ParentDetailPage,
  AddFamilyPage,
  AddChildPage,
  AddParentPage,
  AddChildVisitPage,
  AddFamilyVisitPage,
  FamilyVisitDetailPage,
  ChildVisitDetailPage,
  AdminPage,
  AdminUsersPage,
  AdminLookupsPage,
  AdminBirthingAssistantsPage,
  AddParentVisitPage,
  ParentVisitDetailPage,
  EditParentVisitPage,
  AdminQuestionSetsPage,
  AdminSitesPage,
  LanguagePage,
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

// Router configuration with all routes from ARCHITECTURE.md
const router = createBrowserRouter([
  // Public routes (no authentication required)
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
    errorElement: <ErrorPage />,
  },

  // Protected routes (authentication required)
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'families',
        children: [
          {
            index: true,
            element: <FamiliesPage />,
          },
          {
            path: 'new',
            element: <AddFamilyPage />,
          },
          {
            path: ':id',
            element: <FamilyDetailPage />,
          },
          {
            path: ':id/children/new',
            element: <AddChildPage />,
          },
          {
            path: ':id/parents/new',
            element: <AddParentPage />,
          },
          {
            path: ':id/parents/:pid',
            element: <ParentDetailPage />,
          },
          {
            path: ':id/parents/:pid/visits/new',
            element: <AddParentVisitPage />,
          },
          {
            path: ':id/parents/:pid/visits/:vid',
            element: <ParentVisitDetailPage />,
          },
          {
            path: ':id/parents/:pid/visits/:vid/edit',
            element: <EditParentVisitPage />,
          },
          {
            path: ':id/children/:cid',
            element: <ChildDetailPage />,
          },
          {
            path: ':id/children/:cid/visits/new',
            element: <AddChildVisitPage />,
          },
          {
            path: ':id/children/:cid/visits/:vid',
            element: <ChildVisitDetailPage />,
          },
          {
            path: ':id/visits/new',
            element: <AddFamilyVisitPage />,
          },
          {
            path: ':id/visits/:vid',
            element: <FamilyVisitDetailPage />,
          },
        ],
      },

      // Admin routes (role-gated)
      {
        path: 'admin',
        element: (
          <RoleGate requiredRole={['SUPERVISOR', 'ADMIN']}>
            <AdminPage />
          </RoleGate>
        ),
      },
      {
        path: 'admin/users',
        element: (
          <RoleGate requiredRole={['ADMIN']}>
            <AdminUsersPage />
          </RoleGate>
        ),
      },
      {
        path: 'admin/birthing-assistants',
        element: (
          <RoleGate requiredRole={['SUPERVISOR', 'ADMIN']}>
            <AdminBirthingAssistantsPage />
          </RoleGate>
        ),
      },
      {
        path: 'admin/language',
        element: <LanguagePage />,
      },
      {
        path: 'admin/sites',
        element: (
          <RoleGate requiredRole={['ADMIN']}>
            <AdminSitesPage />
          </RoleGate>
        ),
      },
      {
        path: 'admin/question-sets/:visitType',
        element: (
          <RoleGate requiredRole={['ADMIN']}>
            <AdminQuestionSetsPage />
          </RoleGate>
        ),
      },
      {
        path: 'admin/:table',
        element: (
          <RoleGate requiredRole={['ADMIN']}>
            <AdminLookupsPage />
          </RoleGate>
        ),
      },

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