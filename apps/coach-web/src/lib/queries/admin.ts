import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'

// Admin console data. Every call is an admin-only SECURITY DEFINER RPC (or the
// admin-action Edge Function) — the server re-checks profiles.is_admin, so a
// non-admin hitting these gets "admin only" no matter what the UI shows.

export type ReportStatus = 'open' | 'actioned' | 'dismissed'

export interface ContentSnapshot {
  kind?: string
  body?: string | null
  payload?: Record<string, unknown> | null
  thread_id?: string
  sent_at?: string
}

export interface AdminReport {
  id: string
  reason: string
  details: string | null
  status: ReportStatus
  created_at: string
  resolved_at: string | null
  resolution_note: string | null
  message_id: string | null
  content_snapshot: ContentSnapshot | null
  reporter_id: string | null
  reporter_name: string | null
  reporter_email: string | null
  reported_user_id: string | null
  reported_name: string | null
  reported_email: string | null
  reported_suspended_at: string | null
  reported_open_reports: number
  /** Enforcement actions already taken on this report (delete_message, suspend, delete_user…). */
  actions_taken: string[]
  /** The signed-in admin's own triage marks. */
  starred: boolean
  read_at: string | null
}

export interface ContextMessage {
  id: string
  from_user_id: string
  sender_name: string | null
  kind: string
  body: string | null
  payload: Record<string, unknown> | null
  created_at: string
  is_reported: boolean
}

export interface AdminUserRow {
  id: string
  name: string
  email: string | null
  is_coach: boolean
  is_athlete: boolean
  is_admin: boolean
  suspended_at: string | null
  reports_against: number
  reports_by: number
}

interface PersonLink { id: string; name: string; email: string | null; relationship: string; permission: string }
interface BlockRow { id: string; name: string | null; at: string }
interface ReportBrief { id: string; reason: string; status: ReportStatus; created_at: string }

export interface AdminUserDetail {
  profile: {
    id: string; name: string; email: string | null
    is_coach: boolean; is_athlete: boolean; is_admin: boolean
    suspended_at: string | null; suspended_reason: string | null
  }
  coaches: PersonLink[]
  athletes: PersonLink[]
  blocked: BlockRow[]
  blocked_by: BlockRow[]
  reports_against: ReportBrief[]
  reports_by: ReportBrief[]
  actions: { action: string; note: string | null; admin: string | null; created_at: string }[]
}

export interface AdminAction {
  id: string
  action: string
  note: string | null
  details: Record<string, unknown> | null
  created_at: string
  admin_name: string | null
  target_user_id: string | null
  target_name: string | null
  report_id: string | null
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data as T
}

// ── Reads ────────────────────────────────────────────────────────────────

export function useAdminReports(status: ReportStatus) {
  return useQuery({
    queryKey: ['admin', 'reports', status],
    queryFn: () => rpc<AdminReport[]>('admin_list_reports', { p_status: status }),
  })
}

export function useReportContext(reportId: string | null) {
  return useQuery({
    queryKey: ['admin', 'report-context', reportId],
    queryFn: () => rpc<ContextMessage[]>('admin_report_context', { p_report_id: reportId }),
    enabled: !!reportId,
  })
}

export function useAdminUsers(query: string) {
  return useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: () => rpc<AdminUserRow[]>('admin_search_users', { p_query: query }),
  })
}

export function useAdminUser(userId: string | null) {
  return useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => rpc<AdminUserDetail>('admin_user_detail', { p_user_id: userId }),
    enabled: !!userId,
  })
}

export function useAdminActions() {
  return useQuery({
    queryKey: ['admin', 'actions'],
    queryFn: () => rpc<AdminAction[]>('admin_list_actions', { p_limit: 200 }),
  })
}

// ── Writes ───────────────────────────────────────────────────────────────

/** Any admin write changes reports, users, and the audit log — refresh all. */
function useAdminMutation<A>(fn: (a: A) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  })
}

export const useResolveReport = () =>
  useAdminMutation((a: { reportId: string; status: ReportStatus; note: string }) =>
    rpc('admin_resolve_report', { p_report_id: a.reportId, p_status: a.status, p_note: a.note }))

/** Star/unstar and read/unread are per admin. Optimistic so the list reacts instantly. */
export function useMarkReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (a: { reportId: string; read?: boolean; starred?: boolean }) =>
      rpc('admin_mark_report', { p_report_id: a.reportId, p_read: a.read ?? null, p_starred: a.starred ?? null }),
    onMutate: (a) => {
      qc.setQueriesData<AdminReport[]>({ queryKey: ['admin', 'reports'] }, (rows) => rows?.map((r) => r.id !== a.reportId ? r : {
        ...r,
        starred: a.starred ?? r.starred,
        read_at: a.read === undefined ? r.read_at : a.read ? (r.read_at ?? new Date().toISOString()) : null,
      }))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'reports'] }),
  })
}

export const useRemoveLink = () =>
  useAdminMutation((a: { coachId: string; athleteId: string; note: string }) =>
    rpc('admin_remove_link', { p_coach_id: a.coachId, p_athlete_id: a.athleteId, p_note: a.note }))

export const useSetHead = () =>
  useAdminMutation((a: { coachId: string; athleteId: string; note: string }) =>
    rpc('admin_set_head', { p_coach_id: a.coachId, p_athlete_id: a.athleteId, p_note: a.note }))

export type AdminFnAction =
  | { action: 'delete_message'; message_id: string; report_id?: string; note: string }
  | { action: 'suspend' | 'unsuspend' | 'delete_user'; user_id: string; report_id?: string; note: string }

/** Service-role actions (ban / delete + photo removal) via the admin-action Edge Function. */
export async function adminAction(body: AdminFnAction): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-action', { body })
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(detail?.error ?? error.message)
  }
  if (data?.error) throw new Error(data.error)
}
export const useAdminAction = () => useAdminMutation(adminAction)

// ── CSV export / import ──────────────────────────────────────────────────

/** Every report, all statuses (p_status = null is the uncapped export). */
export const fetchAllReports = () => rpc<AdminReport[]>('admin_list_reports', { p_status: null })

/** Apply one validated CSV row: the enforcement action first, then the status.
 *  Both re-check admin rights server-side and write the audit log. */
export async function applyReportChange(c: {
  reportId: string
  action?: 'delete_message' | 'suspend' | 'unsuspend' | 'delete_user'
  newStatus?: ReportStatus
  note: string
  messageId?: string | null
  userId?: string | null
}): Promise<void> {
  if (c.action === 'delete_message') {
    await adminAction({ action: 'delete_message', message_id: c.messageId!, report_id: c.reportId, note: c.note })
  } else if (c.action) {
    await adminAction({ action: c.action, user_id: c.userId!, report_id: c.reportId, note: c.note })
  }
  if (c.newStatus) await rpc('admin_resolve_report', { p_report_id: c.reportId, p_status: c.newStatus, p_note: c.note })
}

/** Refresh every admin view after a bulk import. */
export function useInvalidateAdmin() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['admin'] })
}
