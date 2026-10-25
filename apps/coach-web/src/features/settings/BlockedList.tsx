import { Avatar } from '../../components/ui/Avatar'
import { useBlockedUsers, useUnblock } from '../../lib/queries/moderation'

/** People you've blocked, with Unblock. Unblocking doesn't restore any link or chat. */
export function BlockedList() {
  const blocked = useBlockedUsers()
  const unblock = useUnblock()
  const rows = blocked.data ?? []
  if (!rows.length) return <p className="text-sm text-text-faint">You haven't blocked anyone.</p>
  return (
    <div className="space-y-1">
      {rows.map((u) => (
        <div key={u.user_id} className="flex items-center gap-2">
          <Avatar initials={u.initials} url={u.avatar_url} size="sm" />
          <span className="flex-1 text-sm text-text">{u.name}</span>
          <button onClick={() => unblock.mutate(u.user_id)} aria-label={`Unblock ${u.name}`}
            className="text-xs font-semibold text-accent hover:brightness-110">Unblock</button>
        </div>
      ))}
    </div>
  )
}
