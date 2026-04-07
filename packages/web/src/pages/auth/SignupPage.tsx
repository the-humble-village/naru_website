import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Register, RegisterSchema } from '@naru/shared';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/auth';

/**
 * SignupPage - User registration form with validation and API integration
 */
export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [formData, setFormData] = useState<Register>({
    login: '',
    email: null,
    firstName: null,
    lastName: null,
    password: '',
    lang: 'en',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Convert empty strings to null for optional fields
    const finalValue = (name === 'email' || name === 'firstName' || name === 'lastName') && value === '' ? null : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
    // Clear field-specific error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    // Clear API error when user makes changes
    if (apiError) {
      setApiError('');
    }
  };

  const validateForm = (): boolean => {
    try {
      RegisterSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error: any) {
      const formErrors: Record<string, string> = {};
      error.errors?.forEach((err: any) => {
        if (err.path?.length > 0) {
          formErrors[err.path[0]] = err.message;
        }
      });
      setErrors(formErrors);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setApiError('');

    try {
      const response = await authApi.register(formData);

      // Store auth data in Zustand store
      login(response.user, response.accessToken, response.refreshToken);

      // Navigate to dashboard
      navigate('/');
    } catch (error: any) {
      console.error('Registration error:', error);
      const message = error.response?.data?.message || 'Registration failed. Please try again.';
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-hv-page flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-center text-hv-charcoal">Create Account</h1>
          <p className="mt-2 text-center text-sm italic text-hv-sage">
            Create your HumbleVillage account
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="bg-hv-card p-8 rounded-2xl border border-hv-border shadow-lg">
            {apiError && (
              <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200">
                <p className="text-sm text-red-800">{apiError}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="login" className="block text-sm font-medium text-hv-charcoal">
                  Username *
                </label>
                <input
                  id="login"
                  name="login"
                  type="text"
                  value={formData.login}
                  onChange={handleInputChange}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-hv-accent focus:border-hv-accent ${
                    errors.login
                      ? 'border-red-500 bg-red-50'
                      : 'border-hv-border-input bg-white'
                  }`}
                  placeholder="Choose a username"
                />
                {errors.login && (
                  <p className="mt-1 text-sm text-red-600">{errors.login}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-hv-charcoal">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={handleInputChange}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-hv-accent focus:border-hv-accent ${
                    errors.email
                      ? 'border-red-500 bg-red-50'
                      : 'border-hv-border-input bg-white'
                  }`}
                  placeholder="Enter your email (optional)"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-hv-charcoal">
                    First Name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={formData.firstName || ''}
                    onChange={handleInputChange}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-hv-accent focus:border-hv-accent ${
                      errors.firstName
                        ? 'border-red-500 bg-red-50'
                        : 'border-hv-border-input bg-white'
                    }`}
                    placeholder="First name"
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-hv-charcoal">
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={formData.lastName || ''}
                    onChange={handleInputChange}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-hv-accent focus:border-hv-accent ${
                      errors.lastName
                        ? 'border-red-500 bg-red-50'
                        : 'border-hv-border-input bg-white'
                    }`}
                    placeholder="Last name"
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-hv-charcoal">
                  Password *
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-hv-accent focus:border-hv-accent ${
                    errors.password
                      ? 'border-red-500 bg-red-50'
                      : 'border-hv-border-input bg-white'
                  }`}
                  placeholder="Enter a password (minimum 6 characters)"
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              <div>
                <label htmlFor="lang" className="block text-sm font-medium text-hv-charcoal">
                  Language
                </label>
                <select
                  id="lang"
                  name="lang"
                  value={formData.lang}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-hv-border-input rounded-md shadow-sm focus:outline-none focus:ring-hv-accent focus:border-hv-accent bg-white"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-hv-terracotta hover:bg-hv-terracotta-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hv-terracotta disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating account...
                  </div>
                ) : (
                  'Create Account'
                )}
              </button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-hv-gray">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="font-medium text-hv-terracotta hover:underline"
                >
                  Sign in here
                </button>
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignupPage;
