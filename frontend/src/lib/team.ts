/**
 * The reporting tree. Pure, no I/O — it works over the directory rows the
 * page already has, using each person's `manager_id`.
 */

export type TeamMember = {
  id: string
  first_name: string
  last_name: string
  manager_id: string | null
}

export type TeamNode<T extends TeamMember> = {
  person: T
  reports: TeamNode<T>[]
}

const byName = (a: TeamMember, b: TeamMember) =>
  `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)

/**
 * Roots are people with no manager, or whose manager is not in the list (a
 * deactivated manager, say). Everyone appears exactly once, children sorted by
 * name. A reporting loop cannot come from the API, but if one did, the people
 * in it are surfaced as roots rather than vanishing or recursing forever.
 */
export function buildReportingTree<T extends TeamMember>(people: T[]): TeamNode<T>[] {
  const ids = new Set(people.map((person) => person.id))
  const childrenOf = new Map<string, T[]>()
  const roots: T[] = []

  for (const person of people) {
    if (person.manager_id && person.manager_id !== person.id && ids.has(person.manager_id)) {
      const siblings = childrenOf.get(person.manager_id) ?? []
      siblings.push(person)
      childrenOf.set(person.manager_id, siblings)
    } else {
      roots.push(person)
    }
  }

  const placed = new Set<string>()
  const grow = (person: T): TeamNode<T> => {
    placed.add(person.id)
    const reports = (childrenOf.get(person.id) ?? [])
      .filter((child) => !placed.has(child.id))
      .sort(byName)
      .map(grow)
    return { person, reports }
  }

  const tree = roots.sort(byName).map(grow)
  // Anyone still unplaced is inside a loop with no way in from a root.
  for (const person of people.filter((p) => !placed.has(p.id)).sort(byName)) {
    if (!placed.has(person.id)) tree.push(grow(person))
  }
  return tree
}

/** Everyone under a node, at any depth. */
export const teamSize = <T extends TeamMember>(node: TeamNode<T>): number =>
  node.reports.reduce((sum, report) => sum + 1 + teamSize(report), 0)
