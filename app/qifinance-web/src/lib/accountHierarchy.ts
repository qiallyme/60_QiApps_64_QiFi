import type { Account, AccountType } from '../types';

export interface HierarchyAccount {
  account: Account;
  depth: number;
  childCount: number;
}

export function parentLedgerId(account: Account): string | null {
  return account.parentLedgerAccountId || account.parentAccountId || null;
}

export function flattenAccountHierarchy(accounts: Account[], type: AccountType): HierarchyAccount[] {
  const active = accounts.filter(account => account.isActive && account.type === type);
  const byId = new Map(active.map(account => [account.id, account]));
  const children = new Map<string, Account[]>();
  active.forEach(account => {
    const parentId = parentLedgerId(account);
    if (!parentId || !byId.has(parentId) || parentId === account.id) return;
    children.set(parentId, [...(children.get(parentId) || []), account]);
  });
  children.forEach(items => items.sort((left, right) => left.code.localeCompare(right.code)));

  const roots = active
    .filter(account => {
      const parentId = parentLedgerId(account);
      return !parentId || !byId.has(parentId) || parentId === account.id;
    })
    .sort((left, right) => left.code.localeCompare(right.code));
  const result: HierarchyAccount[] = [];
  const visited = new Set<string>();
  const traverse = (account: Account, depth: number) => {
    if (visited.has(account.id)) return;
    visited.add(account.id);
    const descendants = children.get(account.id) || [];
    result.push({ account, depth, childCount: descendants.length });
    descendants.forEach(child => traverse(child, depth + 1));
  };
  roots.forEach(root => traverse(root, 0));

  // Preserve malformed/cyclic accounts visibly instead of silently dropping them.
  active
    .filter(account => !visited.has(account.id))
    .sort((left, right) => left.code.localeCompare(right.code))
    .forEach(account => traverse(account, 0));
  return result;
}
