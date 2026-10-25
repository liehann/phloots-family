export type Status = 'buy' | 'have' | 'skip' | null

/** One grocery line. `group` is a meal id or an extra section id. */
export type Item = {
  id: string
  group: string
  name: string
  detail?: string
  qty?: string
  status: Status
  /** Claude's flag (substitution, open question). */
  flag?: string
  /** The person's own note. */
  note?: string
  /** Instacart product id once it is in the cart. */
  pid?: string
}

/** A dinner (ordered: index 0 = Monday) or an extra section. */
export type Meal = {
  id: string
  name: string
  recipe?: string
  note?: string
}

export type Plan = {
  week: string
  meals: Meal[]
  extras: Meal[]
  items: Item[]
  notes: string
}

export type Change = { at: number; text: string }

declare module 'claude-code' {
  interface PluginState {
    'meal-plan': {
      plan: Shaped<Plan>
      pending: Shaped<Change[]>
    }
  }
}
