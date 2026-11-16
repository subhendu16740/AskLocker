// The family tree's rules, kept on the phone for a locked vault (073), where
// the server cannot see the links. The same rules and words as 031's
// tree_connect(), tree_add_parent() and tree_add_pair(): one link a pair, at
// most two parents, nobody their own ancestor. Pure: the QA self-test pins it.

import type { KinLink } from '../../supabase/functions/_shared/kinship';

export type TreeRelation = 'parent' | 'child' | 'spouse' | 'sibling';

export class TreeRuleError extends Error {}

function pairLink(links: KinLink[], a: string, b: string): KinLink | undefined {
  return links.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
}

function addParent(links: KinLink[], parent: string, child: string): KinLink[] {
  const existing = pairLink(links, parent, child);
  if (existing) {
    if (existing.kind === 'parent' && existing.from === parent) return links;
    throw new TreeRuleError('These two are already connected in the tree.');
  }
  if (links.filter((l) => l.kind === 'parent' && l.to === child).length >= 2) {
    throw new TreeRuleError('Someone can have at most two parents in the tree.');
  }
  // Nobody may become their own ancestor: refuse if the child is already above the parent.
  const up = new Set<string>([parent]);
  const queue = [parent];
  while (queue.length) {
    const id = queue.shift()!;
    for (const l of links) {
      if (l.kind === 'parent' && l.to === id && !up.has(l.from)) {
        up.add(l.from);
        queue.push(l.from);
      }
    }
  }
  if (up.has(child)) throw new TreeRuleError('That would make someone their own ancestor.');
  return [...links, { from: parent, to: child, kind: 'parent' }];
}

function addPair(links: KinLink[], a: string, b: string, kind: 'spouse' | 'sibling'): KinLink[] {
  const existing = pairLink(links, a, b);
  if (existing) {
    if (existing.kind === kind) return links;
    throw new TreeRuleError('These two are already connected in the tree.');
  }
  return [...links, { from: a < b ? a : b, to: a < b ? b : a, kind }];
}

/**
 * "person is the <relation> of relative" (and, for a child, of otherParent
 * too): the links after it, or a TreeRuleError in the server's words.
 */
export function connectInTree(
  links: KinLink[],
  people: Iterable<string>,
  person: string,
  relation: TreeRelation,
  relative: string | null | undefined,
  otherParent?: string | null,
): KinLink[] {
  const inTree = new Set(people);
  if (!['parent', 'child', 'spouse', 'sibling'].includes(relation)) throw new TreeRuleError('Unknown relation.');
  if (!relative) throw new TreeRuleError('Choose who they are related to.');
  if (relative === person) throw new TreeRuleError('Someone cannot be their own relative.');
  if (!inTree.has(relative)) throw new TreeRuleError("That person is not in this family's tree.");
  switch (relation) {
    case 'parent':
      return addParent(links, person, relative);
    case 'child': {
      let next = addParent(links, relative, person);
      if (otherParent) {
        if (otherParent === person || otherParent === relative) throw new TreeRuleError('Choose a different second parent.');
        if (!inTree.has(otherParent)) throw new TreeRuleError("That person is not in this family's tree.");
        next = addParent(next, otherParent, person);
      }
      return next;
    }
    default:
      return addPair(links, person, relative, relation);
  }
}

/** The links that still name only people in the tree (someone taken out takes theirs). */
export function linksAmong(links: KinLink[], people: Iterable<string>): KinLink[] {
  const inTree = new Set(people);
  return links.filter((l) => inTree.has(l.from) && inTree.has(l.to) && l.from !== l.to);
}
