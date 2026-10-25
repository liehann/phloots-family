import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Change, Item, Meal, Plan, Status } from '../types'

const PANE = 'meal-plan'
const TITLE = 'Meal plan'
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu']
// Tue and Thu: Mike and Jina join (4 adults, 2 kids). Mon and Wed: 2 adults, 2 kids.
const HEADCOUNT = [4, 6, 4, 6]
const SEND_AFTER_MS = 20000
const LABEL: Record<Exclude<Status, null>, string> = { buy: 'Buy', have: 'Have', skip: "Don't need" }

// Empty until Claude fills it from the week's meal plan (set_plan). Lunch and
// staples sections are always there.
const EMPTY: Plan = {
  week: '',
  meals: [],
  extras: [
    { id: 'lunch', name: "Kids' lunches & fruit" },
    { id: 'staples', name: 'Staples & other' },
  ],
  items: [],
  notes: '',
}
const STORE_KEY = 'plan'

const plan = atom({ plugin: 'meal-plan', key: 'plan' } as const, EMPTY, { shape: 'plan-1' })
const pending = atom({ plugin: 'meal-plan', key: 'pending' } as const, [] as Change[], { shape: 'pending-1' })

let timer: { cancel: () => void } | undefined

/** Change the plan and keep it across sessions. */
async function savePlan($: EngineInterface, fn: (cur: Plan) => Plan) {
  await update($, plan, cur => fn(cur ?? EMPTY))
  await $.store.set(STORE_KEY, await read($, plan))
}

const statusWord = (s: Status) => (s ? LABEL[s] : 'undecided')

async function flush($: EngineInterface) {
  timer?.cancel()
  timer = undefined
  const changes = await read($, pending)
  if (changes.length === 0) return
  await update($, pending, () => [])
  const lines = changes.map(c => `- ${c.text}`).join('\n')
  await $.prompt.submit({
    text:
      `Meal plan panel changes:\n${lines}\n\n` +
      'Update the Sprouts Instacart cart so it matches every item marked Buy (add, remove or change quantities), ' +
      'act on any notes, then write product ids back with mcp__meal-plan__set_plan. Read the full plan with mcp__meal-plan__get_plan.',
  })
}

async function record($: EngineInterface, text: string) {
  const at = await $.clock.now()
  await update($, pending, list => [...(list ?? []), { at, text }].slice(-100))
  timer?.cancel()
  timer = $.clock.after(SEND_AFTER_MS, () => {
    void flush($)
  })
}

function isPlan(v: unknown): v is Plan {
  const p = v as Plan
  return !!p && Array.isArray(p.meals) && Array.isArray(p.items) && Array.isArray(p.extras ?? [])
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const stored = await $.store.get(STORE_KEY)
    const cur = await read($, plan)
    if (cur.meals.length === 0 && cur.items.length === 0 && isPlan(stored)) {
      await update($, plan, () => stored)
    } else if (cur.meals.length > 0 || cur.items.length > 0) {
      await $.store.set(STORE_KEY, cur)
    }
    await $.tool.register({
      name: 'get_plan',
      description:
        "Read Liehann's meal plan side pane: meals in day order (index 0 = Mon; headcount Mon 4, Tue 6, Wed 4, Thu 6), extra sections, every grocery item with its status (buy / have / skip / null = undecided), Instacart product id, notes, and changes not yet sent.",
      isDeferred: false,
    })
    await $.tool.register({
      name: 'set_plan',
      description:
        'Replace the whole meal plan shown in the side pane. Pass the full plan object as get_plan returns it (week, meals in day order, extras, items, notes), with your edits applied.',
      inputSchema: {
        type: 'object',
        properties: { plan: { type: 'object', description: 'The full plan: { week, meals, extras, items, notes }' } },
        required: ['plan'],
      },
      isDeferred: false,
    })
    await $.command.register({ name: 'meal-plan', description: 'Open the meal plan and shopping list pane' })
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'meal-plan' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Meal plan pane opened.' }
  })

  on('tool.call', { tool: 'mcp__meal-plan__get_plan' }, async $ => {
    const p = await read($, plan)
    const q = await read($, pending)
    const days = p.meals.map((m, i) => ({ day: DAYS[i] ?? 'Extra', people: HEADCOUNT[i] ?? null, meal: m.name }))

    return { result: JSON.stringify({ days, plan: p, unsent: q }, null, 1) }
  })

  on('tool.call', { tool: 'mcp__meal-plan__set_plan' }, async ($, e) => {
    const next = (e as unknown as { plan?: unknown }).plan
    if (!isPlan(next)) return { result: 'Not saved: plan needs meals, extras and items arrays.' }
    await savePlan($, () => ({ ...next, week: next.week ?? '', extras: next.extras ?? [], notes: next.notes ?? '' }))

    return { result: `Saved: ${next.meals.length} meals, ${next.items.length} items.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    // Mobile draws no text field: notes are hidden there.
    const Input = 'Input' in els ? els.Input : undefined
    const p = await read($, plan)
    const q = await read($, pending)

    const setStatus = async (item: Item, s: Status) => {
      const to = item.status === s ? null : s
      await savePlan($, cur => ({ ...cur, items: cur.items.map(i => (i.id === item.id ? { ...i, status: to } : i)) }))
      await record($, `${item.name}: ${statusWord(item.status)} → ${statusWord(to)}`)
    }
    const move = async (idx: number, by: number) => {
      const to = idx + by
      if (to < 0 || to >= p.meals.length) return
      const name = p.meals[idx]?.name ?? 'Meal'
      await savePlan($, cur => {
        const meals = [...cur.meals]
        const [m] = meals.splice(idx, 1)
        if (m) meals.splice(to, 0, m)
        return { ...cur, meals }
      })
      await record($, `Moved ${name} to ${DAYS[to] ?? 'Extra'} (${HEADCOUNT[to] ?? '?'} people)`)
    }
    const noteMeal = async (m: Meal, text: string) => {
      await savePlan($, cur => ({
        ...cur,
        meals: cur.meals.map(x => (x.id === m.id ? { ...x, note: text } : x)),
        extras: cur.extras.map(x => (x.id === m.id ? { ...x, note: text } : x)),
      }))
      await record($, `Note on ${m.name}: "${text}"`)
    }
    const noteGeneral = async (text: string) => {
      await savePlan($, cur => ({ ...cur, notes: text }))
      await record($, `General note: "${text}"`)
    }

    const counts = { buy: 0, have: 0, skip: 0, open: 0 }
    for (const i of p.items) counts[i.status ?? 'open']++

    const itemRow = (i: Item) => (
      <Box key={`row-${i.id}`} flexDirection="column" paddingY="xs">
        <Text weight="medium" strikethrough={i.status === 'skip'} dimColor={i.status === 'skip'}>
          {i.qty ? `${i.qty} × ` : ''}{i.name}
        </Text>
        {i.detail && <Text size="footnote" dimColor>{i.detail}</Text>}
        {i.flag && <Text size="footnote" color="warning">{i.flag}</Text>}
        <Box flexDirection="row" gap="xs" flexWrap="wrap">
          {(['buy', 'have', 'skip'] as const).map(s => (
            <Button
              key={`${i.id}-${s}`}
              label={LABEL[s]}
              variant={i.status === s ? 'primary' : 'secondary'}
              dimColor={i.status !== s}
              onPress={() => void setStatus(i, s)}
            />
          ))}
        </Box>
      </Box>
    )

    const section = (m: Meal, heading: string, sub: string | undefined, idx?: number) => {
      const rows = p.items.filter(i => i.group === m.id)
      return (
        <Box key={`sec-${m.id}`} flexDirection="column" gap="xs" paddingTop="md">
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <Box flexDirection="column">
              <Text size="heading" weight="semibold">{heading}</Text>
              {sub && <Text size="footnote" dimColor>{sub}</Text>}
            </Box>
            {idx !== undefined && (
              <Box flexDirection="row" gap="xs">
                <Button key={`up-${m.id}`} label="↑" plain dimColor onPress={() => void move(idx, -1)} />
                <Button key={`down-${m.id}`} label="↓" plain dimColor onPress={() => void move(idx, 1)} />
              </Box>
            )}
          </Box>
          {m.recipe && <Text size="footnote" dimColor>Recipe: {m.recipe}</Text>}
          {rows.length === 0 && <Text dimColor>No ingredients yet.</Text>}
          {rows.map(itemRow)}
          {Input && <Input
            key={`note-${m.id}`}
            placeholder="Add a note for Claude…"
            value={m.note ?? ''}
            submitLabel="save"
            onSubmit={(v: string) => void noteMeal(m, v)}
          />}
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap="xs">
        <Text size="title" weight="bold">{p.week || 'Meal plan'}</Text>
        {p.meals.length === 0 && (
          <Text dimColor>No plan yet. Tell Claude this week's dinners (in day order, Mon to Thu) and it fills this in.</Text>
        )}
        <Text size="footnote" tabular>
          <Text color="success">{counts.buy} buy</Text> · {counts.have} have · {counts.skip} don't need
          {counts.open > 0 ? <Text color="warning"> · {counts.open} to decide</Text> : ''}
        </Text>
        {q.length > 0 && (
          <Box flexDirection="row" gap="sm" alignItems="center" flexWrap="wrap">
            <Text size="footnote" color="warning">
              {q.length} change{q.length === 1 ? '' : 's'} going to Claude in a few seconds
            </Text>
            <Button key="send-now" label="Send now" variant="primary" onPress={() => void flush($)} />
          </Box>
        )}
        {p.meals.map((m, i) =>
          section(m, `${DAYS[i] ?? 'Extra'} · ${m.name}`, `${HEADCOUNT[i] ?? '?'} people`, i),
        )}
        {p.extras.map(m => section(m, m.name, undefined))}
        <Box flexDirection="column" gap="xs" paddingTop="md">
          <Text size="heading" weight="semibold">Notes</Text>
          {Input && <Input
            key="note-general"
            rows={3}
            placeholder="Anything else for this week's shop…"
            value={p.notes}
            submitLabel="save"
            onSubmit={(v: string) => void noteGeneral(v)}
          />}
        </Box>
      </Box>
    )
  })
}
