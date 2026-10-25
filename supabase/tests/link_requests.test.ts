import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { admin, createAndSignIn } from './helpers'

// A coaching link (and the data access + chat reach it brings) exists only
// once the person being added has agreed: a co-coach accepts an admin's
// request; an athlete accepts a coach's "add existing athlete" request.

const tag = randomUUID().slice(0, 6)
const coach = (name: string) => createAndSignIn({ role: 'coach', name: `${name} ${tag}`, title: 'Head Coach' })
const athlete = (name: string) => createAndSignIn({ role: 'athlete', name: `${name} ${tag}` })
const linked = async (coachId: string, athleteId: string) =>
  ((await admin().from('coach_athlete').select('relationship, permission').eq('coach_id', coachId).eq('athlete_id', athleteId)).data ?? [])
const reach = async (client: any, query: string) =>
  ((await client.rpc('search_chat_people', { p_query: query })).data ?? []).map((r: any) => r.user_id)

async function headOf() {
  const head = await coach('Head')
  const a = await athlete('Ath')
  await admin().from('coach_athlete').insert({ coach_id: head.id, athlete_id: a.id, relationship: 'head', permission: 'admin' })
  return { head, a }
}

describe('co-coach requests', () => {
  it('an admin coach can no longer link another coach directly', async () => {
    const { head, a } = await headOf()
    const x = await coach('Direct')
    const ins = await head.client.from('coach_athlete').insert({ coach_id: x.id, athlete_id: a.id, relationship: 'assistant' })
    expect(ins.error).not.toBeNull()
    expect(await linked(x.id, a.id)).toHaveLength(0)
    expect(await reach(head.client, `Direct ${tag}`)).not.toContain(x.id)
  })

  it('a request gives no link or reach until the added coach accepts', async () => {
    const { head, a } = await headOf()
    const x = await coach('Asked')
    const r = await head.client.rpc('request_co_coach', { p_athlete_id: a.id, p_coach_id: x.id })
    expect(r.error).toBeNull()
    expect(await linked(x.id, a.id)).toHaveLength(0)
    expect(await reach(head.client, `Asked ${tag}`)).not.toContain(x.id)

    const pending = (await head.client.rpc('pending_co_coaches', { p_athlete_id: a.id })).data ?? []
    expect(pending.map((p: any) => p.coach_id)).toEqual([x.id])

    const mine = (await x.client.rpc('my_link_requests')).data ?? []
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ athlete_id: a.id, athlete_name: `Ath ${tag}`, requester_name: `Head ${tag}`, kind: 'co_coach' })

    const ok = await x.client.rpc('respond_link_request', { p_id: mine[0].id, p_accept: true })
    expect(ok.error).toBeNull()
    expect(await linked(x.id, a.id)).toEqual([{ relationship: 'assistant', permission: 'edit' }])
    expect(await reach(head.client, `Asked ${tag}`)).toContain(x.id)
    expect((await x.client.rpc('my_link_requests')).data).toHaveLength(0)
  })

  it('declining leaves no link and clears the request', async () => {
    const { head, a } = await headOf()
    const x = await coach('Nope')
    await head.client.rpc('request_co_coach', { p_athlete_id: a.id, p_coach_id: x.id })
    const [req] = (await x.client.rpc('my_link_requests')).data ?? []
    expect((await x.client.rpc('respond_link_request', { p_id: req.id, p_accept: false })).error).toBeNull()
    expect(await linked(x.id, a.id)).toHaveLength(0)
    expect((await head.client.rpc('pending_co_coaches', { p_athlete_id: a.id })).data).toHaveLength(0)
  })

  it('only the added coach can answer, and only an admin coach can ask', async () => {
    const { head, a } = await headOf()
    const x = await coach('Target')
    const outsider = await coach('Outsider')
    expect((await outsider.client.rpc('request_co_coach', { p_athlete_id: a.id, p_coach_id: x.id })).error).not.toBeNull()

    await head.client.rpc('request_co_coach', { p_athlete_id: a.id, p_coach_id: x.id })
    const [req] = (await x.client.rpc('my_link_requests')).data ?? []
    expect((await head.client.rpc('respond_link_request', { p_id: req.id, p_accept: true })).error).not.toBeNull()
    expect((await a.client.rpc('respond_link_request', { p_id: req.id, p_accept: true })).error).not.toBeNull()
    expect(await linked(x.id, a.id)).toHaveLength(0)
  })

  it('asking twice keeps one request, and the asker can cancel it', async () => {
    const { head, a } = await headOf()
    const x = await coach('Twice')
    await head.client.rpc('request_co_coach', { p_athlete_id: a.id, p_coach_id: x.id })
    await head.client.rpc('request_co_coach', { p_athlete_id: a.id, p_coach_id: x.id })
    const pending = (await head.client.rpc('pending_co_coaches', { p_athlete_id: a.id })).data ?? []
    expect(pending).toHaveLength(1)
    expect((await head.client.rpc('cancel_link_request', { p_id: pending[0].id })).error).toBeNull()
    expect((await x.client.rpc('my_link_requests')).data).toHaveLength(0)
  })

  it('refuses a request between blocked people', async () => {
    const { head, a } = await headOf()
    const x = await coach('Blocker')
    await admin().from('user_blocks').insert({ blocker_id: x.id, blocked_id: a.id })
    expect((await head.client.rpc('request_co_coach', { p_athlete_id: a.id, p_coach_id: x.id })).error).not.toBeNull()
  })

  it('a request can be accepted only while the asker is still an admin coach', async () => {
    const { head, a } = await headOf()
    const x = await coach('Late')
    await head.client.rpc('request_co_coach', { p_athlete_id: a.id, p_coach_id: x.id })
    await admin().from('coach_athlete').delete().eq('coach_id', head.id).eq('athlete_id', a.id)
    const [req] = (await x.client.rpc('my_link_requests')).data ?? []
    expect(req).toBeUndefined()
  })
})

describe('request integrity', () => {
  it('an invited co-coach cannot turn the invite into a head request they approve themselves', async () => {
    // An admin co-coach and no head coach yet, so a head request is possible.
    const head = await coach('AdminAsst')
    const a = await athlete('Headless')
    await admin().from('coach_athlete').insert({ coach_id: head.id, athlete_id: a.id, relationship: 'assistant', permission: 'admin' })
    const x = await coach('Climber')
    await head.client.rpc('request_co_coach', { p_athlete_id: a.id, p_coach_id: x.id })
    const [invite] = (await x.client.rpc('my_link_requests')).data ?? []
    await x.client.rpc('coach_add_athlete', { p_athlete_id: a.id, p_relationship: 'head' })
    // The athlete now decides; the coach can't answer it.
    expect((await x.client.rpc('respond_link_request', { p_id: invite.id, p_accept: true })).error).not.toBeNull()
    expect(await linked(x.id, a.id)).toHaveLength(0)
    const forAthlete = (await a.client.rpc('my_link_requests')).data ?? []
    expect(forAthlete).toHaveLength(1)
    expect(forAthlete[0]).toMatchObject({ coach_id: x.id, relationship: 'head' })
  })

  it('a block between coach and athlete drops a pending request', async () => {
    const { head, a } = await headOf()
    const x = await coach('Blocked later')
    await head.client.rpc('request_co_coach', { p_athlete_id: a.id, p_coach_id: x.id })
    const [req] = (await x.client.rpc('my_link_requests')).data ?? []
    await a.client.rpc('block_user', { p_user_id: x.id })
    expect((await x.client.rpc('my_link_requests')).data).toHaveLength(0)
    expect((await x.client.rpc('respond_link_request', { p_id: req.id, p_accept: true })).error).not.toBeNull()
    expect(await linked(x.id, a.id)).toHaveLength(0)
  })
})

describe('adding an existing athlete', () => {
  it('sends the athlete a request instead of linking them', async () => {
    const c = await coach('Adder')
    const a = await athlete('Found')
    expect((await c.client.rpc('coach_add_athlete', { p_athlete_id: a.id, p_relationship: 'head' })).error).toBeNull()
    expect(await linked(c.id, a.id)).toHaveLength(0)
    expect(await reach(c.client, `Found ${tag}`)).not.toContain(a.id)
    await admin().from('plans').insert({ athlete_id: a.id })
    const { data: plans } = await c.client.from('plans').select('athlete_id').eq('athlete_id', a.id)
    expect(plans).toHaveLength(0)

    const mine = (await a.client.rpc('my_link_requests')).data ?? []
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ coach_id: c.id, requester_name: `Adder ${tag}`, kind: 'athlete', relationship: 'head' })

    expect((await a.client.rpc('respond_link_request', { p_id: mine[0].id, p_accept: true })).error).toBeNull()
    expect(await linked(c.id, a.id)).toEqual([{ relationship: 'head', permission: 'admin' }])
  })

  it('search shows a pending request so the coach sees "Requested"', async () => {
    const c = await coach('Searcher')
    const a = await athlete(`Pendo`)
    await c.client.rpc('coach_add_athlete', { p_athlete_id: a.id, p_relationship: 'assistant' })
    const rows = (await c.client.rpc('search_athletes', { p_query: `Pendo ${tag}` })).data ?? []
    expect(rows.find((r: any) => r.id === a.id)).toMatchObject({ already_on_roster: false, requested: true })
  })

  it('accepting as head is refused when someone else became head meanwhile', async () => {
    const c = await coach('Second')
    const a = await athlete('Taken')
    await c.client.rpc('coach_add_athlete', { p_athlete_id: a.id, p_relationship: 'head' })
    const other = await coach('First')
    await admin().from('coach_athlete').insert({ coach_id: other.id, athlete_id: a.id, relationship: 'head', permission: 'admin' })
    const [req] = (await a.client.rpc('my_link_requests')).data ?? []
    expect((await a.client.rpc('respond_link_request', { p_id: req.id, p_accept: true })).error?.message).toMatch(/head coach/)
    expect(await linked(c.id, a.id)).toHaveLength(0)
  })
})
