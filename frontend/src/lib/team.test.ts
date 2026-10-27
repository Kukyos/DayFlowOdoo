/**
 * Run with:  node --experimental-strip-types src/lib/team.test.ts
 */
import assert from 'node:assert/strict'
import { buildReportingTree, teamSize } from './team.ts'

const person = (id: string, first: string, manager: string | null = null) =>
  ({ id, first_name: first, last_name: 'X', manager_id: manager })

const names = (nodes: Array<{ person: { first_name: string } }>) => nodes.map((n) => n.person.first_name)

// A normal company: one root, two levels, children sorted by name.
{
  const tree = buildReportingTree([
    person('p', 'Praneet'),
    person('z', 'Zoya', 'p'),
    person('a', 'Armaan', 'p'),
    person('r', 'Rahul', 'a'),
  ])
  assert.deepEqual(names(tree), ['Praneet'])
  assert.deepEqual(names(tree[0].reports), ['Armaan', 'Zoya'])
  assert.deepEqual(names(tree[0].reports[0].reports), ['Rahul'])
  assert.equal(teamSize(tree[0]), 3)
}

// A manager missing from the list (deactivated) makes their reports roots.
{
  const tree = buildReportingTree([person('a', 'Armaan', 'gone'), person('b', 'Bala')])
  assert.deepEqual(names(tree), ['Armaan', 'Bala'])
}

// A loop never recurses forever, and nobody is dropped or duplicated.
{
  const tree = buildReportingTree([
    person('a', 'Asha', 'b'),
    person('b', 'Bilal', 'a'),
    person('c', 'Chitra', 'c'),
  ])
  const all: string[] = []
  const walk = (nodes: typeof tree) => nodes.forEach((n) => { all.push(n.person.first_name); walk(n.reports) })
  walk(tree)
  assert.deepEqual(all.sort(), ['Asha', 'Bilal', 'Chitra'])
}

console.log('team: all assertions passed')
