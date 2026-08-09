import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { usersApi } from '../../api/users';
import { UserRead, UserCreate, UserUpdate, Role } from '@naru/shared';
import { RoleGate } from '../../components/RoleGate';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { NameInput } from '../../components/ui/NameInput';
import { useAuthStore } from '../../store/auth';
import { useTranslation } from '../../hooks';
import { formatDate } from '../../utils/datetime';

interface UserFormData {
  login: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: Role;
  lang: string;
}

const EMPTY_FORM: UserFormData = {
  login: '',
  email: '',
  firstName: '',
  lastName: '',
  password: '',
  role: 'CASEWORKER',
  lang: 'en',
};

/**
 * Pull the server's message out of an API failure.
 *
 * The backend error handler responds with `{ error: string }` (see app.ts
 * onError), so domain messages such as "Cannot delete the last remaining admin"
 * only live on the response body — axios' own `.message` is just
 * "Request failed with status code 400".
 */
const getErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

/**
 * AdminUsersPage - User management interface for admins
 */
export const AdminUsersPage: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const { t } = useTranslation();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRead | null>(null);
  const [formData, setFormData] = useState<UserFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRead | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Fetch users
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.fetchUsers,
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: usersApi.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserUpdate }) =>
      usersApi.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  // Password reset mutation (dedicated admin endpoint)
  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      usersApi.resetUserPassword(id, { password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  // Delete (soft) user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => usersApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const resetForm = () => {
    setFormData(EMPTY_FORM);
  };

  const closeForm = () => {
    setShowCreateForm(false);
    setEditingUser(null);
    setFormError(null);
    resetForm();
  };

  const handleCreate = async () => {
    setFormError(null);
    // Blank optional strings must go over the wire as null: `email` is validated
    // with z.string().email() and would reject ''.
    const createData: UserCreate = {
      login: formData.login,
      email: formData.email || null,
      firstName: formData.firstName || null,
      lastName: formData.lastName || null,
      password: formData.password,
      role: formData.role,
      lang: formData.lang,
    };
    try {
      await createUserMutation.mutateAsync(createData);
      closeForm();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to create user'));
    }
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    setFormError(null);

    // Only send changed fields
    const dataToSave: UserUpdate = {};
    if (formData.login !== editingUser.login) {
      dataToSave.login = formData.login;
    }
    if (formData.email !== (editingUser.email ?? '')) {
      dataToSave.email = formData.email || null;
    }
    if (formData.firstName !== (editingUser.firstName ?? '')) {
      dataToSave.firstName = formData.firstName || null;
    }
    if (formData.lastName !== (editingUser.lastName ?? '')) {
      dataToSave.lastName = formData.lastName || null;
    }
    if (formData.role !== editingUser.role) {
      dataToSave.role = formData.role;
    }
    if (formData.lang !== editingUser.lang) {
      dataToSave.lang = formData.lang;
    }

    try {
      if (Object.keys(dataToSave).length > 0) {
        await updateUserMutation.mutateAsync({ id: editingUser.id, data: dataToSave });
      }
      if (formData.password) {
        await resetPasswordMutation.mutateAsync({
          id: editingUser.id,
          password: formData.password,
        });
      }
      closeForm();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to update user'));
    }
  };

  const startEdit = (user: UserRead) => {
    setFormError(null);
    setEditingUser(user);
    setFormData({
      login: user.login,
      email: user.email || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      password: '', // Blank means "keep the current password"
      role: user.role,
      lang: user.lang,
    });
    setShowCreateForm(true);
  };

  const cancelForm = () => {
    closeForm();
  };

  const requestDelete = (user: UserRead) => {
    setDeleteError(null);
    setDeleteTarget(user);
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteUserMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      // Keep the dialog open so the server's reason (e.g. "Cannot delete the
      // last remaining admin") stays visible.
      setDeleteError(getErrorMessage(err, 'Failed to delete user'));
    }
  };

  const getRoleDisplayName = (role: Role) => {
    switch (role) {
      case 'ADMIN': return t('role.admin');
      case 'SUPERVISOR': return t('role.supervisor');
      case 'CASEWORKER': return t('role.caseworker');
    }
  };

  const formatUserName = (user: UserRead) => {
    const parts = [user.firstName, user.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : user.login;
  };

  const isCurrentUser = (user: UserRead) => currentUser?.id === user.id;

  // Mirrors the server guard: an admin may not demote themselves out of ADMIN.
  const roleLocked = editingUser !== null && isCurrentUser(editingUser) && editingUser.role === 'ADMIN';
  const selfRoleTitle = 'You cannot change your own admin role. Ask another admin to do it.';
  const selfDeleteTitle = 'You cannot delete your own account';

  const isSaving =
    createUserMutation.isPending || updateUserMutation.isPending || resetPasswordMutation.isPending;

  if (isLoading) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
          <h1 className="text-2xl font-serif font-bold text-hv-charcoal">{t('common.user_management')}</h1>
          <Link
            to="/admin"
            className="text-hv-terracotta hover:underline transition-colors"
          >
            ← {t('common.back_to_admin')}
          </Link>
        </div>
        <div className="bg-white p-6 rounded-xl border border-hv-border">
          <p className="text-hv-gray">Loading users...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
          <h1 className="text-2xl font-serif font-bold text-hv-charcoal">{t('common.user_management')}</h1>
          <Link
            to="/admin"
            className="text-hv-terracotta hover:underline transition-colors"
          >
            ← {t('common.back_to_admin')}
          </Link>
        </div>
        <div className="bg-white p-6 rounded-xl border border-hv-border">
          <p className="text-red-600">Failed to load users: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <RoleGate requiredRole="ADMIN">
      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
          <h1 className="text-2xl font-serif font-bold text-hv-charcoal">{t('common.user_management')}</h1>
          <Link
            to="/admin"
            className="text-hv-terracotta hover:underline transition-colors"
          >
            ← {t('common.back_to_admin')}
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-hv-border">
          <div className="flex justify-between items-center p-6 border-b border-hv-border">
            <h2 className="text-lg font-serif font-semibold text-hv-charcoal">{t('admin.users')} ({users.length})</h2>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-hv-terracotta text-white px-4 py-2 rounded-md hover:bg-hv-terracotta-hover transition-colors"
            >
              {t('common.add_user')}
            </button>
          </div>

          {/* User Form */}
          {showCreateForm && (
            <div className="p-6 border-b border-hv-border bg-hv-page">
              <h3 className="text-lg font-serif font-semibold text-hv-charcoal mb-4">
                {editingUser ? t('admin.edit_user_title') : t('common.create_new_user')}
              </h3>
              <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="user-login" className="block text-sm font-medium text-hv-charcoal mb-1">
                      {t('common.col_login')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="user-login"
                      type="text"
                      value={formData.login}
                      onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                      className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="user-email" className="block text-sm font-medium text-hv-charcoal mb-1">
                      {t('common.col_email')}
                    </label>
                    <input
                      id="user-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor="user-firstName" className="block text-sm font-medium text-hv-charcoal mb-1">
                      {t('common.first_name')}
                    </label>
                    <NameInput
                      id="user-firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor="user-lastName" className="block text-sm font-medium text-hv-charcoal mb-1">
                      {t('common.last_name')}
                    </label>
                    <NameInput
                      id="user-lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor="user-password" className="block text-sm font-medium text-hv-charcoal mb-1">
                      {editingUser ? t('common.new_password') : <>{t('common.password')} <span className="text-red-500">*</span></>}
                    </label>
                    <input
                      id="user-password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                      required={!editingUser}
                      minLength={6}
                      autoComplete="new-password"
                      placeholder={editingUser ? 'Leave blank to keep current password' : ''}
                    />
                    {editingUser && (
                      <p className="text-xs text-hv-gray mt-1">
                        Leave blank to keep the current password. At least 6 characters to reset it.
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="user-role" className="block text-sm font-medium text-hv-charcoal mb-1">
                      {t('common.col_role')}
                    </label>
                    <select
                      id="user-role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                      disabled={roleLocked}
                      title={roleLocked ? selfRoleTitle : undefined}
                      className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="CASEWORKER">{t('role.caseworker')}</option>
                      <option value="SUPERVISOR">{t('role.supervisor')}</option>
                      <option value="ADMIN">{t('role.admin')}</option>
                    </select>
                    {roleLocked && (
                      <p className="text-xs text-hv-gray mt-1">{selfRoleTitle}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="user-language" className="block text-sm font-medium text-hv-charcoal mb-1">
                      {t('admin.language')}
                    </label>
                    <select
                      id="user-language"
                      value={formData.lang}
                      onChange={(e) => setFormData({ ...formData, lang: e.target.value })}
                      className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                    >
                      <option value="en">{t('lang.english')}</option>
                      <option value="es">{t('lang.spanish')}</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="px-4 py-2 text-hv-gray border border-hv-border rounded-md hover:bg-hv-page transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={editingUser ? handleUpdate : handleCreate}
                    disabled={isSaving}
                    className="px-4 py-2 bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover disabled:opacity-50 transition-colors"
                  >
                    {isSaving
                      ? t('common.saving')
                      : editingUser
                        ? t('common.update_user')
                        : t('common.create_user')}
                  </button>
                </div>
                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-hv-crisis text-sm">
                      Failed to {editingUser ? 'update' : 'create'} user: {formError}
                    </p>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-hv-page">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    {t('common.col_user')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    {t('common.col_login')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    {t('common.col_email')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    {t('common.col_role')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    {t('admin.language')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    {t('common.col_created')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    {t('common.col_actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-hv-border">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-hv-page">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-hv-charcoal">
                        {formatUserName(user)}
                        {isCurrentUser(user) && (
                          <span className="ml-2 text-xs font-normal text-hv-gray">({t('common.you')})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-hv-sage">
                      {user.login}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-hv-sage">
                      {user.email || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === 'ADMIN'
                          ? 'bg-red-100 text-red-800'
                          : user.role === 'SUPERVISOR'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {getRoleDisplayName(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-hv-sage">
                      {user.lang === 'en' ? t('lang.english') : t('lang.spanish')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-hv-sage">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                      <button
                        onClick={() => startEdit(user)}
                        className="text-hv-terracotta hover:underline transition-colors"
                      >
                        {t('admin.edit_entity_title')}
                      </button>
                      <button
                        onClick={() => requestDelete(user)}
                        disabled={isCurrentUser(user) || deleteUserMutation.isPending}
                        title={isCurrentUser(user) ? selfDeleteTitle : `Delete ${formatUserName(user)}`}
                        className="text-hv-crisis hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline transition-colors"
                      >
                        {t('common.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="p-6 text-center text-hv-gray">
              No users found. Create your first user to get started.
            </div>
          )}
        </div>

        {deleteTarget && (
          <ConfirmDialog
            open
            title="Delete user"
            confirmLabel="Delete"
            busy={deleteUserMutation.isPending}
            message={
              <div className="space-y-2">
                <p>
                  Delete <strong>{formatUserName(deleteTarget)}</strong> ({deleteTarget.login})?
                  They will immediately lose access and will no longer be able to sign in.
                </p>
                {deleteError && (
                  <p className="text-hv-crisis font-medium">{deleteError}</p>
                )}
              </div>
            }
            warning={
              deleteTarget.role === 'ADMIN'
                ? 'This is an admin account. The last remaining admin cannot be deleted.'
                : undefined
            }
            onConfirm={confirmDelete}
            onCancel={cancelDelete}
          />
        )}
      </div>
    </RoleGate>
  );
};

export default AdminUsersPage;
