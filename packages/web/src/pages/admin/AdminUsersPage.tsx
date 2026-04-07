import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/users';
import { UserRead, UserCreate, UserUpdate, Role } from '@naru/shared';
import { RoleGate } from '../../components/RoleGate';

interface UserFormData {
  login: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: Role;
  lang: string;
}

/**
 * AdminUsersPage - User management interface for admins
 */
export const AdminUsersPage: React.FC = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRead | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    login: '',
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    role: 'CASEWORKER',
    lang: 'en',
  });

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
      setShowCreateForm(false);
      resetForm();
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserUpdate }) =>
      usersApi.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUser(null);
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      login: '',
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      role: 'CASEWORKER',
      lang: 'en',
    });
  };

  const handleCreate = async () => {
    try {
      await createUserMutation.mutateAsync(formData);
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };

  const handleUpdate = async () => {
    if (!editingUser) return;

    const updateData: UserUpdate = {
      login: formData.login !== editingUser.login ? formData.login : undefined,
      email: formData.email !== editingUser.email ? formData.email : undefined,
      firstName: formData.firstName !== editingUser.firstName ? formData.firstName : undefined,
      lastName: formData.lastName !== editingUser.lastName ? formData.lastName : undefined,
      role: formData.role !== editingUser.role ? formData.role : undefined,
      lang: formData.lang !== editingUser.lang ? formData.lang : undefined,
    };

    // Remove undefined values
    const cleanUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    ) as UserUpdate;

    try {
      await updateUserMutation.mutateAsync({ id: editingUser.id, data: cleanUpdateData });
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const startEdit = (user: UserRead) => {
    setEditingUser(user);
    setFormData({
      login: user.login,
      email: user.email || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      password: '', // Don't pre-fill password for edits
      role: user.role,
      lang: user.lang,
    });
    setShowCreateForm(true);
  };

  const cancelForm = () => {
    setShowCreateForm(false);
    setEditingUser(null);
    resetForm();
  };

  const getRoleDisplayName = (role: Role) => {
    switch (role) {
      case 'ADMIN': return 'Admin';
      case 'SUPERVISOR': return 'Supervisor';
      case 'CASEWORKER': return 'Caseworker';
    }
  };

  const formatUserName = (user: UserRead) => {
    const parts = [user.firstName, user.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : user.login;
  };

  if (isLoading) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
          <h1 className="text-2xl font-serif font-bold text-hv-charcoal">User Management</h1>
          <Link
            to="/admin"
            className="text-hv-terracotta hover:underline transition-colors"
          >
            ← Back to Admin
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
          <h1 className="text-2xl font-serif font-bold text-hv-charcoal">User Management</h1>
          <Link
            to="/admin"
            className="text-hv-terracotta hover:underline transition-colors"
          >
            ← Back to Admin
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
          <h1 className="text-2xl font-serif font-bold text-hv-charcoal">User Management</h1>
          <Link
            to="/admin"
            className="text-hv-terracotta hover:underline transition-colors"
          >
            ← Back to Admin
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-hv-border">
          <div className="flex justify-between items-center p-6 border-b border-hv-border">
            <h2 className="text-lg font-serif font-semibold text-hv-charcoal">Users ({users.length})</h2>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-hv-terracotta text-white px-4 py-2 rounded-md hover:bg-hv-terracotta-hover transition-colors"
            >
              Add User
            </button>
          </div>

          {/* User Form */}
          {showCreateForm && (
            <div className="p-6 border-b border-hv-border bg-hv-page">
              <h3 className="text-lg font-serif font-semibold text-hv-charcoal mb-4">
                {editingUser ? 'Edit User' : 'Create New User'}
              </h3>
              <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="user-login" className="block text-sm font-medium text-hv-charcoal mb-1">
                      Login <span className="text-red-500">*</span>
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
                      Email
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
                      First Name
                    </label>
                    <input
                      id="user-firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor="user-lastName" className="block text-sm font-medium text-hv-charcoal mb-1">
                      Last Name
                    </label>
                    <input
                      id="user-lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                    />
                  </div>
                  {!editingUser && (
                    <div>
                      <label htmlFor="user-password" className="block text-sm font-medium text-hv-charcoal mb-1">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="user-password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                        required={!editingUser}
                        minLength={6}
                      />
                    </div>
                  )}
                  <div>
                    <label htmlFor="user-role" className="block text-sm font-medium text-hv-charcoal mb-1">
                      Role
                    </label>
                    <select
                      id="user-role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                      className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                    >
                      <option value="CASEWORKER">Caseworker</option>
                      <option value="SUPERVISOR">Supervisor</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="user-language" className="block text-sm font-medium text-hv-charcoal mb-1">
                      Language
                    </label>
                    <select
                      id="user-language"
                      value={formData.lang}
                      onChange={(e) => setFormData({ ...formData, lang: e.target.value })}
                      className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="px-4 py-2 text-hv-gray border border-hv-border rounded-md hover:bg-hv-page transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={editingUser ? handleUpdate : handleCreate}
                    disabled={createUserMutation.isPending || updateUserMutation.isPending}
                    className="px-4 py-2 bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover disabled:opacity-50 transition-colors"
                  >
                    {createUserMutation.isPending || updateUserMutation.isPending
                      ? 'Saving...'
                      : editingUser
                        ? 'Update User'
                        : 'Create User'}
                  </button>
                </div>
                {(createUserMutation.error || updateUserMutation.error) && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-hv-crisis text-sm">
                      Failed to {editingUser ? 'update' : 'create'} user: {(createUserMutation.error || updateUserMutation.error)?.message}
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
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    Language
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-hv-border">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-hv-page">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-hv-charcoal">
                        {formatUserName(user)}
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
                      {user.lang === 'en' ? 'English' : 'Spanish'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-hv-sage">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => startEdit(user)}
                        className="text-hv-terracotta hover:underline transition-colors"
                      >
                        Edit
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
      </div>
    </RoleGate>
  );
};

export default AdminUsersPage;
