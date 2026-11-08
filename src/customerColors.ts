import type { CSSProperties } from 'react'
import type { Customer } from './model'

export const customerColors = [
  { key: 'blue', fill: '#0066ff', text: '#ffffff' },
  { key: 'violet', fill: '#8247ff', text: '#ffffff' },
  { key: 'teal', fill: '#00c9b1', text: '#171717' },
  { key: 'coral', fill: '#ff785a', text: '#171717' },
  { key: 'pink', fill: '#ff5caf', text: '#171717' },
  { key: 'yellow', fill: '#ffda3b', text: '#171717' },
  { key: 'green', fill: '#62dc6c', text: '#171717' },
  { key: 'sky', fill: '#52c7ff', text: '#171717' },
  { key: 'orange', fill: '#ffad33', text: '#171717' },
  { key: 'lime', fill: '#b9eb3d', text: '#171717' },
  { key: 'lilac', fill: '#c18aff', text: '#171717' },
  { key: 'rose', fill: '#ff8da1', text: '#171717' },
] as const

export function customerColor(customer: Pick<Customer, 'id' | 'colorKey'>) {
  return customerColors.find((c) => c.key === customer.colorKey) ?? customerColors[0]
}

// Assign once on ingestion, never during rendering. Balance usage for large accounts.
export function assignCustomerColors<T extends Pick<Customer, 'id' | 'colorKey'>>(
  customers: T[],
): T[] {
  const usage = new Map<string, number>(customerColors.map((c) => [c.key, 0]))
  for (const c of customers)
    if (c.colorKey && usage.has(c.colorKey)) usage.set(c.colorKey, usage.get(c.colorKey)! + 1)
  return customers.map((c) => {
    if (c.colorKey && usage.has(c.colorKey)) return c
    const min = Math.min(...usage.values())
    const available = customerColors.filter((color) => usage.get(color.key) === min)
    const chosen = available[Math.floor(Math.random() * available.length)]
    usage.set(chosen.key, usage.get(chosen.key)! + 1)
    return { ...c, colorKey: chosen.key }
  })
}

export function customerColorStyle(customer: Pick<Customer, 'id' | 'colorKey'>): CSSProperties {
  const color = customerColor(customer)
  return { '--client-color': color.fill, '--client-text': color.text } as CSSProperties
}
