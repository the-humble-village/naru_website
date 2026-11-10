import React, { useRef } from 'react';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (key: string) => void;
  label?: string;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, value, onChange, label, className }) => {
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.findIndex((tab) => tab.key === value);
    if (current < 0 || tabs.length === 0) {
      return;
    }

    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (current + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (current - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = tabs.length - 1;
    }

    if (next === -1) {
      return;
    }

    const nextTab = tabs[next];
    if (!nextTab) {
      return;
    }

    event.preventDefault();
    onChange(nextTab.key);
    buttons.current[nextTab.key]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={`flex gap-1 overflow-x-auto border-b border-hv-border${
        className ? ` ${className}` : ''
      }`}
    >
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              buttons.current[tab.key] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.key)}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap rounded-t-md border-b-2 px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-hv-accent ${
              active
                ? 'border-hv-green text-hv-green'
                : 'border-transparent text-hv-gray hover:border-hv-border hover:text-hv-charcoal'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                  active ? 'bg-hv-green text-white' : 'bg-hv-page text-hv-gray'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
