import SwiftUI
import Supabase

/// Permanent account deletion — requires current password re-verification.
/// Calls the delete-account Edge Function which re-verifies server-side, then
/// cascades deletion of auth user, profile, plans, logs, and chat history.
struct DeleteAccountView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss

    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
    @State private var showConfirmAlert = false

    var body: some View {
        ZStack {
            RB.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {

                    // ── Warning card ───────────────────────────────────────
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(Color.red)
                            Text("This action is permanent")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(.white)
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            bulletPoint("Your profile and all training data will be permanently deleted.")
                            bulletPoint("You will be unlinked from all coaches.")
                            bulletPoint("All training logs and chat history will be removed.")
                            bulletPoint("This cannot be undone.")
                        }
                    }
                    .padding(16)
                    .background(Color.red.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.red.opacity(0.25), lineWidth: 1)
                    )

                    // ── Password ───────────────────────────────────────────
                    VStack(alignment: .leading, spacing: 8) {
                        RBLabel("CURRENT PASSWORD")
                        SecureField("Enter your password to confirm", text: $password)
                            .textContentType(.password)
                            .foregroundStyle(.white)
                            .rbField()
                            .accessibilityLabel("Current password")
                    }

                    if let error {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }

                    // ── Confirm button ─────────────────────────────────────
                    Button {
                        showConfirmAlert = true
                    } label: {
                        Text(busy ? "Deleting…" : "Delete my account")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color.red)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color.red.opacity(0.15))
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .disabled(busy || password.isEmpty)
                    .accessibilityLabel("Delete account")
                    .alert("Delete your account?", isPresented: $showConfirmAlert) {
                        Button("Cancel", role: .cancel) {}
                        Button("Delete permanently", role: .destructive) {
                            Task { await deleteAccount() }
                        }
                    } message: {
                        Text("This is permanent and cannot be undone.")
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 40)
            }
        }
        .navigationTitle("Delete account")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
    }

    // MARK: – Helpers

    private func bulletPoint(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text("•")
                .font(.footnote)
                .foregroundStyle(Color.red.opacity(0.7))
            Text(text)
                .font(.footnote)
                .foregroundStyle(RB.textMute)
        }
    }

    // MARK: – Action

    private func deleteAccount() async {
        busy = true; error = nil
        defer { busy = false }
        do {
            try await Supa.shared.functions.invoke(
                "delete-account",
                options: FunctionInvokeOptions(body: ["password": password])
            )
            await session.signOut()
        } catch let FunctionsError.httpError(_, data) {
            let serverMsg = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
            error = serverMsg ?? "Incorrect password — please try again."
        } catch {
            self.error = "Could not delete account — check your connection and try again."
        }
    }
}
