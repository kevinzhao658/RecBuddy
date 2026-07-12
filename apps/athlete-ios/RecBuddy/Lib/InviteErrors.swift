import Foundation
import Supabase

/// Maps redeem_invite failures to actionable copy. The server raises specific
/// reasons (own code, used, head coach exists…) — showing them beats the old
/// generic "invalid, used, or expired", which sent users chasing the wrong fix.
enum InviteErrors {
    static func friendly(_ error: Error) -> String {
        let msg = ((error as? PostgrestError)?.message ?? error.localizedDescription).lowercased()
        if msg.contains("your own invite") {
            return "That code came from your own coach account — ask another coach for theirs."
        }
        if msg.contains("already used") {
            return "That code has already been used — ask your coach for a new one."
        }
        if msg.contains("already has a head coach") {
            return "You're already linked to a head coach — remove them first to switch."
        }
        if msg.contains("confirm your email") {
            return "Confirm your email first, then enter the code again."
        }
        if msg.contains("expired") {
            return "That code has expired — ask your coach for a new one."
        }
        if msg.contains("invalid invite code") {
            return "That code doesn't match an invite — double-check it."
        }
        return "Couldn't add the coach — check the code and try again."
    }

    /// True when the server definitively rejected the code (retrying the same
    /// code can never succeed) — vs. a transient network failure worth retrying.
    static func isPermanent(_ error: Error) -> Bool {
        error is PostgrestError
    }
}
