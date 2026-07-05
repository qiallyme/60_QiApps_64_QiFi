/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Account } from '../types';
import { ChevronDown, Search, Check } from 'lucide-react';

interface SearchableAccountSelectProps {
  value: string;
  onChange: (value: string) => void;
  accounts: Account[];
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function getHierarchicalAccounts(accounts: Account[]): (Account & { depth: number })[] {
  const parentToChildren: Record<string, Account[]> = {};
  const rootAccounts: Account[] = [];

  accounts.forEach(a => {
    if (!a.parentAccountId) {
      rootAccounts.push(a);
    } else {
      if (!parentToChildren[a.parentAccountId]) {
        parentToChildren[a.parentAccountId] = [];
      }
      parentToChildren[a.parentAccountId].push(a);
    }
  });

  const sortByCode = (list: Account[]) => {
    return [...list].sort((a, b) => {
      const codeA = a.code || '';
      const codeB = b.code || '';
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });
  };

  const sortedRoots = sortByCode(rootAccounts);
  const result: (Account & { depth: number })[] = [];

  const traverse = (node: Account, depth: number) => {
    result.push({ ...node, depth });
    const children = parentToChildren[node.id] || [];
    const sortedChildren = sortByCode(children);
    sortedChildren.forEach(child => traverse(child, depth + 1));
  };

  sortedRoots.forEach(root => traverse(root, 0));

  const includedIds = new Set(result.map(r => r.id));
  const orphans = accounts.filter(a => !includedIds.has(a.id));
  if (orphans.length > 0) {
    const sortedOrphans = sortByCode(orphans);
    sortedOrphans.forEach(o => result.push({ ...o, depth: 0 }));
  }

  return result;
}

export default function SearchableAccountSelect({
  value,
  onChange,
  accounts,
  className = '',
  placeholder = 'Select account...',
  disabled = false
}: SearchableAccountSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // 1. Get hierarchically sorted list
  const hierarchicalList = useMemo(() => {
    return getHierarchicalAccounts(accounts);
  }, [accounts]);

  // 2. Filter list based on search query
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return hierarchicalList;
    const query = searchQuery.toLowerCase().trim();
    return hierarchicalList.filter(
      a => a.name.toLowerCase().includes(query) || (a.code || '').toLowerCase().includes(query)
    );
  }, [hierarchicalList, searchQuery]);

  // Find the currently selected account details for display
  const selectedAccount = useMemo(() => {
    return accounts.find(a => a.id === value);
  }, [accounts, value]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlight index when filtered list changes or dropdown opens
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredList, isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (accId: string) => {
    onChange(accId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % Math.max(1, filteredList.length));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + filteredList.length) % Math.max(1, filteredList.length));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredList[highlightedIndex]) {
          handleSelect(filteredList[highlightedIndex].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        const listEl = listRef.current;
        if (activeEl.offsetTop < listEl.scrollTop) {
          listEl.scrollTop = activeEl.offsetTop;
        } else if (activeEl.offsetTop + activeEl.offsetHeight > listEl.scrollTop + listEl.clientHeight) {
          listEl.scrollTop = activeEl.offsetTop + activeEl.offsetHeight - listEl.clientHeight;
        }
      }
    }
  }, [highlightedIndex, isOpen]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Selector Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`flex w-full items-center justify-between bg-zinc-950 border border-zinc-850 hover:border-zinc-700 text-left rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none transition-all ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${isOpen ? 'ring-1 ring-emerald-500/50 border-emerald-500/50' : ''}`}
      >
        <span className="truncate text-zinc-200">
          {selectedAccount ? (
            <>
              {selectedAccount.code ? `(${selectedAccount.code}) ` : ''}
              {selectedAccount.name}
            </>
          ) : (
            <span className="text-zinc-500">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-[999] mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-1.5 shadow-2xl animate-fadeIn">
          {/* Search Input Container */}
          <div className="flex items-center gap-2 border-b border-zinc-900 px-2 pb-2 pt-0.5">
            <Search size={12} className="text-zinc-500 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by code or name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-650 outline-none focus:ring-0"
            />
          </div>

          {/* Accounts List */}
          <div
            ref={listRef}
            className="max-h-60 overflow-y-auto pt-1 space-y-0.5 scrollbar-thin scrollbar-thumb-zinc-800"
          >
            {filteredList.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-zinc-650 italic">
                No accounts match "{searchQuery}"
              </div>
            ) : (
              filteredList.map((acc, index) => {
                const isSelected = acc.id === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleSelect(acc.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : isHighlighted
                        ? 'bg-zinc-900 text-zinc-100'
                        : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
                    }`}
                  >
                    <span className="truncate flex items-center">
                      {/* Indentation representing depth */}
                      {acc.depth > 0 && (
                        <span className="text-zinc-600 font-mono shrink-0 mr-1.5 opacity-60">
                          {'\u00A0'.repeat(acc.depth * 3)}├─
                        </span>
                      )}
                      <span className="truncate">
                        {acc.code ? `${acc.code} - ` : ''}
                        {acc.name}
                      </span>
                    </span>
                    {isSelected && <Check size={12} className="text-emerald-400 shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
