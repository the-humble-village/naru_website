import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { Users, User, Baby, FileText, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SearchResultItem } from '@naru/shared';
import { searchApi } from '../api/search';
import { useTranslation } from '../hooks/useTranslation';

export interface SearchBarProps {
  placeholder?: string;
  className?: string;
}

/**
 * SearchBar component with global search functionality that shows results in a dropdown
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const {
    data: searchResults,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchApi.searchByName(query),
    enabled: query.length >= 2 && isOpen,
    staleTime: 10_000,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(value.length >= 2);
  };

  const handleResultSelect = (result: SearchResultItem) => {
    setIsOpen(false);
    setQuery('');
    switch (result.type) {
      case 'family':
        navigate(`/families/${result.familyId}`);
        break;
      case 'parent':
        navigate(`/families/${result.familyId}/parents/${result.id}`);
        break;
      case 'child':
        navigate(`/families/${result.familyId}/children/${result.id}`);
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
    }
  };

  const getResultIcon = (type: SearchResultItem['type']): ReactNode => {
    switch (type) {
      case 'family':
        return <Users className="w-4 h-4" />;
      case 'parent':
        return <User className="w-4 h-4" />;
      case 'child':
        return <Baby className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getResultTypeLabel = (type: SearchResultItem['type']) => {
    switch (type) {
      case 'family':
        return t('search.types.family');
      case 'parent':
        return t('search.types.parent');
      case 'child':
        return t('search.types.child');
      default:
        return type;
    }
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('search.placeholder')}
          className="w-full px-4 py-2 pl-10 pr-4 text-sm text-hv-charcoal bg-white border border-hv-border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-hv-terracotta focus:border-transparent"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="w-4 h-4 text-gray-500" />
        </div>
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-hv-border rounded-xl shadow-md max-h-60 sm:max-h-80 overflow-auto">
          {isLoading && (
            <div className="px-4 py-3 text-sm text-gray-500">
              {t('search.searching')}...
            </div>
          )}

          {error && (
            <div className="px-4 py-3 text-sm text-red-600">
              {t('search.error')}
            </div>
          )}

          {searchResults && searchResults.results.length === 0 && !isLoading && (
            <div className="px-4 py-3 text-sm text-gray-500">
              {t('search.noResults')}
            </div>
          )}

          {searchResults && searchResults.results.length > 0 && (
            <>
              {searchResults.results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultSelect(result)}
                  className="w-full px-4 py-3 text-left hover:bg-hv-page focus:bg-hv-page focus:outline-none transition-colors border-b border-hv-border last:border-b-0"
                >
                  <div className="flex items-start space-x-3">
                    <span className="flex items-center text-hv-sage mt-0.5">{getResultIcon(result.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-hv-charcoal">
                          {result.name || t('common.unnamed')}
                        </span>
                        <span className="text-xs px-2 py-1 bg-hv-terracotta text-white rounded-full">
                          {getResultTypeLabel(result.type)}
                        </span>
                      </div>
                      {result.familyName && result.type !== 'family' && (
                        <div className="text-sm text-hv-sage truncate">
                          {t('search.familyLabel')}: {result.familyName}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}

              {searchResults.total > searchResults.results.length && (
                <div className="px-4 py-2 text-sm text-gray-500 border-t border-hv-border">
                  {t('search.showingResults')
                    .replace('{shown}', searchResults.results.length.toString())
                    .replace('{total}', searchResults.total.toString())}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;