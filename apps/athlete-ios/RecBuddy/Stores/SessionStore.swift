import Foundation
import Observation
import Supabase

/// Auth session + own profile. Drives the root switch and is the app-wide
/// source of "who am I". The inverse of coach-web's RequireCoach: only
/// accounts with the athlete role (is_athlete flag) reach the tabs.
@Observable @MainActor
final class SessionStore {
    enum State: Equatable {
        case loading                 // app launch, restoring session
        case signedOut
        case networkError            // valid session, profile fetch failed (offline?)
        case wrongRole               // signed in but no athlete role (e.g. coach-only account)
        case athlete(Profile)
    }
    private(set) var state: State = .loading
    /// Whether the athlete is linked to any coach. False after a coach removes
    /// them — their plan stays; the UI offers "add a coach" (invite code).
    /// nil until the first load completes.
    private(set) var hasCoach: Bool?
    /// Why the queued invite code (from the signup wizard) could not be
    /// redeemed after sign-in — surfaced by the join screens instead of the
    /// old silent swallow. Cleared once shown.
    private(set) var redeemNotice: String?

    func clearRedeemNotice() { redeemNotice = nil }
    /// Backed by UserDefaults — NOT tracked by @Observable; don't read it inside View bodies expecting reactive updates.
    var pendingInviteCode: String? {
        get { UserDefaults.standard.string(forKey: "pendingInviteCode") }
        set { UserDefaults.standard.set(newValue, forKey: "pendingInviteCode") }
    }
    /// Goal-race name the athlete edited during registration. The invite's goal
    /// seeds the plan at redeem (coach's default); this override is applied
    /// right after, so the athlete's version wins. UserDefaults-backed like
    /// pendingInviteCode (survives the confirm-email round trip).
    var pendingGoalRace: String? {
        get { UserDefaults.standard.string(forKey: "pendingGoalRace") }
        set { UserDefaults.standard.set(newValue, forKey: "pendingGoalRace") }
    }

    func start() async {
        for await (event, session) in Supa.shared.auth.authStateChanges {
            guard [.initialSession, .signedIn, .signedOut, .userUpdated].contains(event) else { continue }
            if session == nil { TodaySnapshot.clear(); state = .signedOut; continue }
            await onSignedIn()
        }
    }

    private func onSignedIn() async {
        // Redeem a held invite before loading the profile (first sign-in after confirm).
        if let code = pendingInviteCode {
            do {
                try await Supa.shared.rpc("redeem_invite", params: ["p_code": code]).execute()
                pendingInviteCode = nil
                await applyPendingGoalRace()
            } catch {
                // The server rejected the code (own invite, used, head coach
                // exists…): retrying the same code can never succeed, so stop
                // and SURFACE the reason — the old silent swallow left users
                // guessing. Transient network errors keep the code queued.
                if InviteErrors.isPermanent(error) {
                    pendingInviteCode = nil
                    pendingGoalRace = nil
                    redeemNotice = InviteErrors.friendly(error)
                }
            }
        }
        do {
            guard let uid = Supa.shared.auth.currentUser?.id.uuidString.lowercased() else {
                state = .signedOut; return
            }
            let profile: Profile = try await Supa.shared.from("profiles")
                .select().eq("id", value: uid).single().execute().value
            if profile.athleteAccess {
                // Coachless detection (e.g. after removal): any coach link left?
                struct Link: Decodable { let coach_id: String }
                let links: [Link] = (try? await Supa.shared.from("coach_athlete")
                    .select("coach_id").eq("athlete_id", value: uid)
                    .limit(1).execute().value) ?? []
                hasCoach = !links.isEmpty
                state = .athlete(profile)
            } else {
                state = .wrongRole
            }
        } catch is URLError {
            // Transient network failure — the session is still valid; offer retry
            // instead of dumping the user to the sign-in screen.
            state = .networkError
        } catch {
            state = .signedOut
        }
    }

    /// Re-fetches the profile; also re-attempts any un-cleared invite redemption (normally a no-op).
    func refreshProfile() async {
        await onSignedIn()
    }

    /// The redeem seeds the plan from the INVITE's goal (coach's default).
    /// If the athlete edited the race name during registration, their version
    /// wins — rewrite it via update_my_goal, preserving the seeded
    /// distance/date/time. Best-effort: the goal is editable in Settings anyway.
    private func applyPendingGoalRace() async {
        guard let race = pendingGoalRace else { return }
        defer { pendingGoalRace = nil }
        guard let uid = Supa.shared.auth.currentUser?.id.uuidString.lowercased() else { return }
        struct Seeded: Decodable {
            let goal_distance: String?
            let goal_date: String?
            let goal_time: String?
        }
        struct GoalParams: Encodable {
            let p_goal_race: String?
            let p_goal_distance: String?
            let p_goal_date: String?
            let p_goal_time: String?
        }
        guard let plan: Seeded = try? await Supa.shared.from("plans")
            .select("goal_distance, goal_date, goal_time")
            .eq("athlete_id", value: uid).single().execute().value else { return }
        _ = try? await Supa.shared.rpc("update_my_goal", params: GoalParams(
            p_goal_race: race,
            p_goal_distance: plan.goal_distance,
            p_goal_date: plan.goal_date,
            p_goal_time: plan.goal_time
        )).execute()
    }

    func signIn(email: String, password: String) async throws {
        try await Supa.shared.auth.signIn(email: email, password: password)
        // authStateChanges drives the state transition.
    }

    func signOut() async {
        await PushRegistrar.deleteToken()   // no pushes for a signed-out device
        try? await Supa.shared.auth.signOut()
        TodaySnapshot.clear()   // never show the previous athlete's plan on a widget
        state = .signedOut
    }
}
