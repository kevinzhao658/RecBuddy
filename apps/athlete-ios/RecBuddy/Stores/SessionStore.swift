import Foundation
import Observation
import Supabase

/// Auth session + own profile. Drives the root switch and is the app-wide
/// source of "who am I". The inverse of coach-web's RequireCoach: only
/// role=='athlete' reaches the tabs.
@Observable @MainActor
final class SessionStore {
    enum State: Equatable {
        case loading                 // app launch, restoring session
        case signedOut
        case wrongRole               // signed in but not an athlete
        case athlete(Profile)
    }
    private(set) var state: State = .loading
    /// Invite code held through the confirm-email gap; redeemed on first session.
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
                if "\(error)".contains("already used") { pendingInviteCode = nil }
            }
        }
        do {
            guard let uid = Supa.shared.auth.currentUser?.id.uuidString.lowercased() else {
                state = .signedOut; return
            }
            let profile: Profile = try await Supa.shared.from("profiles")
                .select().eq("id", value: uid).single().execute().value
            state = profile.role == "athlete" ? .athlete(profile) : .wrongRole
        } catch {
            state = .signedOut
        }
    }

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
