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
    /// Backed by UserDefaults — NOT tracked by @Observable; don't read it inside View bodies expecting reactive updates.
    var pendingInviteCode: String? {
        get { UserDefaults.standard.string(forKey: "pendingInviteCode") }
        set { UserDefaults.standard.set(newValue, forKey: "pendingInviteCode") }
    }

    func start() async {
        for await (event, session) in Supa.shared.auth.authStateChanges {
            guard [.initialSession, .signedIn, .signedOut, .userUpdated].contains(event) else { continue }
            if session == nil { state = .signedOut; continue }
            await onSignedIn()
        }
    }

    private func onSignedIn() async {
        // Redeem a held invite before loading the profile (first sign-in after confirm).
        if let code = pendingInviteCode {
            do {
                try await Supa.shared.rpc("redeem_invite", params: ["p_code": code]).execute()
                pendingInviteCode = nil
            } catch {
                // A consumed code errors here but the profile still loads (athlete
                // just stays unlinked); clear it so we don't retry forever.
                if (error as? PostgrestError)?.message.contains("already used") == true {
                    pendingInviteCode = nil
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

    func signIn(email: String, password: String) async throws {
        try await Supa.shared.auth.signIn(email: email, password: password)
        // authStateChanges drives the state transition.
    }

    func signOut() async {
        try? await Supa.shared.auth.signOut()
        state = .signedOut
    }
}
