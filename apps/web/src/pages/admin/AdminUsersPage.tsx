import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { z } from 'zod';
import { usersApi } from '../../api/users';
import {
  UserRead,
  UserCreate,
  UserUpdate,
  UserCreateSchema,
  UserPasswordResetSchema,
  Role,
  type TranslationKey,
} from '@naru/shared';
import { parseZodErrors } from '../../hooks/useFieldErrors';
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
  confirmPassword: string;
  role: Role;
  lang: string;
}

const EMPTY_FORM: UserFormData = {
  login: '',
  email: '',
  firstName: '',
  lastName: '',
  password: '',
  confirmPassword: '',
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
 * A plain sentence for each field the user form can get wrong. Zod's own
 * messages ("String must contain at least 12 character(s)") aren't fit to show,
 * and gluing the field name on front ("email: Invalid email") read worse.
 */
const FIELD_ERROR_KEYS: Partial<Record<string, TranslationKey>> = {
  login: 'admin.invalid_login',
  email: 'admin.invalid_email',
  firstName: 'admin.first_name_required',
  lastName: 'admin.last_name_required',
  password: 'admin.invalid_password',
};

/** Fields checked inline, under the input, in the order they appear on the form. */
type CheckedField = 'email' | 'firstName' | 'lastName';
const CHECKED_FIELDS: CheckedField[] = ['email', 'firstName', 'lastName'];
const NOTHING_TOUCHED: Record<CheckedField, boolean> = {
  email: false,
  firstName: false,
  lastName: false,
};
const REQUIRED_KEYS: Record<CheckedField, TranslationKey> = {
  email: 'admin.email_required',
  firstName: 'admin.first_name_required',
  lastName: 'admin.last_name_required',
};

/**
 * Validate against the shared schema before hitting the network, returning the
 * name of the first field that fails, or null if the payload is good.
 *
 * The save button is an onClick, not a submit, so the `minLength` attributes on
 * these inputs never trigger browser validation — without this the first sign
 * that a password is too short is a 400 from the server. Reusing the schema
 * keeps the client rule from drifting away from the server's.
 */
const preflight = <T,>(schema: z.ZodType<T>, data: unknown): string | null => {
  const result = schema.safeParse(data);
  if (result.success) return null;
  return Object.keys(parseZodErrors(result.error))[0] ?? '';
};

/**
 * The shared schema's own email rule, so the inline check can't drift from the
 * one the server enforces.
 */
const isValidEmail = (email: string): boolean =>
  UserCreateSchema.shape.email.safeParse(email).success;

/** Likewise the server's password rule (length), checked as it is typed. */
const isValidPassword = (password: string): boolean =>
  UserCreateSchema.shape.password.safeParse(password).success;

const formatUserName = (user: UserRead) => {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : user.login;
};

type SortColumn = 'name' | 'role';
type SortDirection = 'asc' | 'desc';

// Ascending role order runs down the hierarchy, Admin first.
const ROLE_RANK: Record<Role, number> = { ADMIN: 0, SUPERVISOR: 1, CASEWORKER: 2 };

const SORT_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-green focus-visible:ring-offset-2';

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
  // A field's error waits until it is first left (or the form is submitted), so
  // it doesn't fire on every keystroke of a half-typed address. After that it
  // updates live, clearing as soon as the value is fixed.
  const [touched, setTouched] = useState(NOTHING_TOUCHED);
  // Same rule for the password boxes: no "too short" or "don't match" while
  // they're half typed.
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [loginTouched, setLoginTouched] = useState(false);
  // The login last checked against the server, set when the field is left.
  const [checkedLogin, setCheckedLogin] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRead | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Null keeps the server's order until a header is clicked.
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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

  // The loaded list can't see soft-deleted users, whose logins are still
  // reserved, so the server has the final word. Asked once the field is left
  // rather than per keystroke.
  const editingId = editingUser?.id;
  const { data: loginAvailability } = useQuery({
    queryKey: ['users', 'login-availability', checkedLogin, editingId],
    queryFn: () => usersApi.checkLoginAvailability(checkedLogin, editingId),
    enabled: showCreateForm && checkedLogin !== '' && checkedLogin !== editingUser?.login,
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
    setTouched(NOTHING_TOUCHED);
    setPasswordTouched(false);
    setConfirmTouched(false);
    setLoginTouched(false);
    setCheckedLogin('');
  };

  const trimmed: Record<CheckedField, string> = {
    email: formData.email.trim(),
    firstName: formData.firstName.trim(),
    lastName: formData.lastName.trim(),
  };

  // Required for a new user, and for an existing one who already has a value
  // (it can be changed, not removed). Accounts created before these fields were
  // required can still be edited without filling them in.
  const isRequired = (field: CheckedField): boolean =>
    editingUser === null || Boolean(editingUser[field]);

  const fieldProblem = (field: CheckedField): TranslationKey | null => {
    const value = trimmed[field];
    if (value === '') return isRequired(field) ? REQUIRED_KEYS[field] : null;
    if (field === 'email' && !isValidEmail(value)) return 'admin.invalid_email';
    return null;
  };

  const fieldError = (field: CheckedField): string | null => {
    const key = touched[field] ? fieldProblem(field) : null;
    return key ? t(key) : null;
  };

  /** Props shared by the inline-checked inputs: blur tracking, a11y and the error border. */
  const checkedInputProps = (field: CheckedField) => {
    const error = fieldError(field);
    return {
      onBlur: () => setTouched((prev) => ({ ...prev, [field]: true })),
      required: isRequired(field),
      'aria-required': isRequired(field),
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? `user-${field}-error` : undefined,
      className: `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent ${
        error ? 'border-red-500' : 'border-hv-border-input'
      }`,
    };
  };

  const renderFieldError = (field: CheckedField) => {
    const error = fieldError(field);
    return error ? (
      <p id={`user-${field}-error`} className="text-red-500 text-sm mt-1">
        {error}
      </p>
    ) : null;
  };

  const requiredMark = (field: CheckedField) =>
    isRequired(field) ? <span className="text-red-500"> *</span> : null;

  /** The sentence to show for a field that failed `preflight`. */
  const fieldErrorMessage = (field: string): string => {
    const key = FIELD_ERROR_KEYS[field];
    return key ? t(key) : t('admin.invalid_form');
  };

  // The list check is instant and live; the server answer only applies while
  // the field still holds the login it was asked about.
  const loginProblem = ((): TranslationKey | null => {
    const login = formData.login;
    if (login === '') return 'admin.invalid_login';
    if (users.some((u) => u.login === login && u.id !== editingId)) return 'admin.login_taken';
    if (loginAvailability && checkedLogin === login && !loginAvailability.available) {
      return loginAvailability.deleted ? 'admin.login_taken_deleted' : 'admin.login_taken';
    }
    return null;
  })();
  const loginError = loginTouched && loginProblem ? t(loginProblem) : null;

  // A typo in a password nobody can see locks the user out, so it has to be
  // typed twice. Both blank is fine on edit: that keeps the current password.
  const passwordsMismatch = formData.password !== formData.confirmPassword;
  const confirmError = confirmTouched && passwordsMismatch ? t('admin.passwords_mismatch') : null;
  // Blank is only allowed on edit, where it means "keep the current password".
  const passwordInvalid =
    formData.password === '' ? editingUser === null : !isValidPassword(formData.password);
  const passwordError = passwordTouched && passwordInvalid ? t('admin.invalid_password') : null;

  /** Flags every bad field under its input; returns false if submit should stop. */
  const checkFields = (): boolean => {
    setTouched({ email: true, firstName: true, lastName: true });
    setLoginTouched(true);
    setPasswordTouched(true);
    setConfirmTouched(true);
    if (loginProblem) {
      document.getElementById('user-login')?.focus();
      return false;
    }
    const firstBad = CHECKED_FIELDS.find((field) => fieldProblem(field) !== null);
    if (firstBad) {
      document.getElementById(`user-${firstBad}`)?.focus();
      return false;
    }
    if (passwordInvalid) {
      document.getElementById('user-password')?.focus();
      return false;
    }
    if (passwordsMismatch) {
      document.getElementById('user-confirmPassword')?.focus();
      return false;
    }
    return true;
  };

  const closeForm = () => {
    setShowCreateForm(false);
    setEditingUser(null);
    setFormError(null);
    resetForm();
  };

  const handleCreate = async () => {
    setFormError(null);
    if (!checkFields()) return;
    const createData: UserCreate = {
      login: formData.login,
      email: trimmed.email,
      firstName: trimmed.firstName,
      lastName: trimmed.lastName,
      password: formData.password,
      role: formData.role,
      lang: formData.lang,
    };
    const invalid = preflight(UserCreateSchema, createData);
    if (invalid !== null) {
      setFormError(fieldErrorMessage(invalid));
      return;
    }

    try {
      await createUserMutation.mutateAsync(createData);
      closeForm();
    } catch (err) {
      setFormError(getErrorMessage(err, t('admin.try_again')));
    }
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    setFormError(null);
    if (!checkFields()) return;

    // Only send changed fields
    const dataToSave: UserUpdate = {};
    if (formData.login !== editingUser.login) {
      dataToSave.login = formData.login;
    }
    // Blank only gets past checkFields() for a user who never had that value, so
    // there's nothing to send.
    for (const field of CHECKED_FIELDS) {
      const value = trimmed[field];
      if (value !== '' && value !== (editingUser[field] ?? '')) {
        dataToSave[field] = value;
      }
    }
    if (formData.role !== editingUser.role) {
      dataToSave.role = formData.role;
    }
    if (formData.lang !== editingUser.lang) {
      dataToSave.lang = formData.lang;
    }

    // Checked before the update fires, so a too-short password cannot leave the
    // other field edits already saved while the reset half fails.
    if (formData.password) {
      const invalid = preflight(UserPasswordResetSchema, { password: formData.password });
      if (invalid !== null) {
        setFormError(fieldErrorMessage(invalid));
        return;
      }
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
      setFormError(getErrorMessage(err, t('admin.try_again')));
    }
  };

  const startEdit = (user: UserRead) => {
    setFormError(null);
    setTouched(NOTHING_TOUCHED);
    setPasswordTouched(false);
    setConfirmTouched(false);
    setLoginTouched(false);
    setCheckedLogin('');
    setEditingUser(user);
    setFormData({
      login: user.login,
      email: user.email || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      password: '', // Blank means "keep the current password"
      confirmPassword: '',
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

  const isCurrentUser = (user: UserRead) => currentUser?.id === user.id;

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedUsers = useMemo(() => {
    if (!sortColumn) return users;
    const byName = (a: UserRead, b: UserRead) =>
      formatUserName(a).localeCompare(formatUserName(b), undefined, {
        sensitivity: 'base',
        numeric: true,
      });
    const sign = sortDirection === 'asc' ? 1 : -1;
    return [...users].sort((a, b) => {
      if (sortColumn === 'role') {
        // Within a role, users stay alphabetical whichever way the roles run.
        return sign * (ROLE_RANK[a.role] - ROLE_RANK[b.role]) || byName(a, b);
      }
      return sign * byName(a, b);
    });
  }, [users, sortColumn, sortDirection]);

  const sortableHeader = (column: SortColumn, label: string) => {
    const sorted = sortColumn === column;
    return (
      <th
        scope="col"
        aria-sort={sorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
        className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider"
      >
        <button
          type="button"
          onClick={() => handleSort(column)}
          className={`inline-flex items-center gap-1 rounded uppercase tracking-wider hover:text-hv-charcoal ${SORT_FOCUS}`}
        >
          {label}
          <span aria-hidden="true" className="text-hv-gray">
            {sorted ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
          </span>
        </button>
      </th>
    );
  };

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
                      placeholder={t('admin.placeholder_login')}
                      type="text"
                      value={formData.login}
                      onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                      onBlur={() => {
                        setLoginTouched(true);
                        setCheckedLogin(formData.login);
                      }}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent ${
                        loginError ? 'border-red-500' : 'border-hv-border-input'
                      }`}
                      required
                      aria-invalid={loginError ? true : undefined}
                      aria-describedby={loginError ? 'user-login-error' : undefined}
                      autoComplete="off"
                    />
                    {loginError && (
                      <p id="user-login-error" className="text-red-500 text-sm mt-1">
                        {loginError}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="user-email" className="block text-sm font-medium text-hv-charcoal mb-1">
                      {t('common.col_email')}
                      {requiredMark('email')}
                    </label>
                    <input
                      id="user-email"
                      placeholder={t('admin.placeholder_email')}
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      autoComplete="off"
                      {...checkedInputProps('email')}
                    />
                    {renderFieldError('email')}
                  </div>
                  <div>
                    <label htmlFor="user-firstName" className="block text-sm font-medium text-hv-charcoal mb-1">
                      {t('common.first_name')}
                      {requiredMark('firstName')}
                    </label>
                    <NameInput
                      id="user-firstName"
                      placeholder={t('admin.placeholder_first_name')}
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      {...checkedInputProps('firstName')}
                    />
                    {renderFieldError('firstName')}
                  </div>
                  <div>
                    <label htmlFor="user-lastName" className="block text-sm font-medium text-hv-charcoal mb-1">
                      {t('common.last_name')}
                      {requiredMark('lastName')}
                    </label>
                    <NameInput
                      id="user-lastName"
                      placeholder={t('admin.placeholder_last_name')}
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      {...checkedInputProps('lastName')}
                    />
                    {renderFieldError('lastName')}
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
                      onBlur={() => setPasswordTouched(true)}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent ${
                        passwordError ? 'border-red-500' : 'border-hv-border-input'
                      }`}
                      aria-invalid={passwordError ? true : undefined}
                      aria-describedby={passwordError ? 'user-password-error' : undefined}
                      required={!editingUser}
                      minLength={12}
                      autoComplete="new-password"
                      placeholder={editingUser ? t('admin.placeholder_password_keep') : t('admin.placeholder_password')}
                    />
                    {passwordError && (
                      <p id="user-password-error" className="text-red-500 text-sm mt-1">
                        {passwordError}
                      </p>
                    )}
                    {/* The create case needs its own hint: the edit-only version below
                        meant a new user's first sign that 12 is required was a 400. */}
                    <p className="text-xs text-hv-gray mt-1">
                      {editingUser
                        ? 'Leave blank to keep the current password. At least 12 characters to reset it. Resetting a password signs the user out on all devices.'
                        : 'At least 12 characters.'}
                    </p>
                  </div>
                  <div>
                    <label htmlFor="user-confirmPassword" className="block text-sm font-medium text-hv-charcoal mb-1">
                      {editingUser ? t('common.confirm_new_password') : <>{t('common.confirm_password')} <span className="text-red-500">*</span></>}
                    </label>
                    <input
                      id="user-confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      onBlur={() => setConfirmTouched(true)}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent ${
                        confirmError ? 'border-red-500' : 'border-hv-border-input'
                      }`}
                      required={!editingUser || formData.password !== ''}
                      aria-invalid={confirmError ? true : undefined}
                      aria-describedby={confirmError ? 'user-confirmPassword-error' : undefined}
                      autoComplete="new-password"
                    />
                    {confirmError && (
                      <p id="user-confirmPassword-error" className="text-red-500 text-sm mt-1">
                        {confirmError}
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
                    <p className="text-hv-crisis text-sm" role="alert">
                      {editingUser ? t('admin.update_user_failed') : t('admin.create_user_failed')}{' '}
                      {formError}
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
                  {sortableHeader('name', t('common.col_name'))}
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    {t('common.col_email')}
                  </th>
                  {sortableHeader('role', t('common.col_role'))}
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
                {sortedUsers.map((user) => (
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
