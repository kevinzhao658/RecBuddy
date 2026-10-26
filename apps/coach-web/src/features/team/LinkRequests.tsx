import { useMyLinkRequests, useRespondLinkRequest } from '../../lib/queries/linkRequests'

/** Co-coach invites waiting on me, shown above the roster. Nothing is shared
 *  with me until I accept. */
export function LinkRequests() {
  const requests = (useMyLinkRequests().data ?? []).filter((r) => r.kind === 'co_coach')
  const respond = useRespondLinkRequest()
  if (requests.length === 0) return null
  return (
    <div className="flex flex-col gap-2 px-3 pb-2">
      {requests.map((r) => (
        <div key={r.id} className="rounded-[14px] border border-line bg-surface2/60 p-3">
          <p className="text-sm text-text">{r.requester_name} invited you to coach {r.athlete_name}.</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => respond.mutate({ id: r.id, accept: true })} disabled={respond.isPending}
              className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-on-accent disabled:opacity-50">Accept</button>
            <button onClick={() => respond.mutate({ id: r.id, accept: false })} disabled={respond.isPending}
              className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-text-mute hover:text-text disabled:opacity-50">Decline</button>
          </div>
        </div>
      ))}
    </div>
  )
}
