import SwiftUI

/// Report a coach's message (or the coach themselves, from Settings → Coaches).
/// Optionally blocks them in the same step.
struct ReportSheet: View {
    struct Target: Identifiable {
        let userId: String
        let userName: String
        var messageId: String? = nil
        var id: String { messageId ?? userId }
    }

    let target: Target
    /// Called after a successful block so the caller can refresh.
    var onBlocked: (() async -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var reason: ReportReason?
    @State private var details = ""
    @State private var alsoBlock = false
    @State private var busy = false
    @State private var error: String?
    @State private var done = false
    @State private var reported = false  // a retry after a failed block won't re-file the report

    var body: some View {
        NavigationStack {
            ZStack {
                RB.bg.ignoresSafeArea()
                if done { confirmation } else { form }
            }
            .navigationTitle(target.messageId == nil ? "Report \(target.userName)" : "Report message")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(done ? "Done" : "Cancel") { dismiss() }
                        .foregroundStyle(RB.accent)
                }
            }
        }
        .presentationDetents([.large])
    }

    private var form: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Reports are private — \(target.userName) won't know you reported them. We review every report within 24 hours and remove content or accounts that break our Terms.")
                    .font(.subheadline)
                    .foregroundStyle(RB.textMute)

                VStack(alignment: .leading, spacing: 8) {
                    RBLabel("WHAT'S WRONG?")
                    ForEach(ReportReason.allCases) { r in
                        Button { reason = r } label: {
                            HStack {
                                Text(r.label).foregroundStyle(.white)
                                Spacer()
                                Image(systemName: reason == r ? "largecircle.fill.circle" : "circle")
                                    .foregroundStyle(reason == r ? RB.accent : RB.textFaint)
                            }
                            .padding(14)
                            .rbCard()
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(reason == r ? .isSelected : [])
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    RBLabel("DETAILS (OPTIONAL)")
                    TextField("", text: $details, axis: .vertical)
                        .lineLimit(3...6)
                        .foregroundStyle(.white)
                        .rbField()
                        .accessibilityLabel("Details")
                }

                Toggle(isOn: $alsoBlock) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Also block \(target.userName)")
                            .foregroundStyle(.white)
                        Text("Removes them from your team. They can't message you or see your chat.")
                            .font(.caption)
                            .foregroundStyle(RB.textFaint)
                    }
                }
                .tint(RB.accent)
                .padding(14)
                .rbCard()

                if let error {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }

                Button(busy ? "Sending…" : "Submit report") {
                    Task { await submit() }
                }
                .buttonStyle(VoltButtonStyle())
                .disabled(busy || reason == nil)
            }
            .padding(20)
        }
    }

    private var confirmation: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.shield.fill")
                .font(.system(size: 56))
                .foregroundStyle(RB.accent)
                .accessibilityHidden(true)
            Text("Thanks for reporting")
                .font(.title3.bold())
                .foregroundStyle(.white)
            Text(alsoBlock
                 ? "\(target.userName) is blocked. We'll review your report within 24 hours."
                 : "We'll review your report within 24 hours. You can also block \(target.userName) from Settings → Coaches.")
                .font(.subheadline)
                .foregroundStyle(RB.textMute)
                .multilineTextAlignment(.center)
            Button("Done") { dismiss() }
                .buttonStyle(VoltButtonStyle())
                .padding(.top, 8)
        }
        .padding(32)
    }

    private func submit() async {
        guard let reason else { return }
        busy = true; error = nil
        defer { busy = false }
        do {
            if !reported {
                try await Moderation.report(reason: reason, messageId: target.messageId,
                                            userId: target.userId, details: details)
                reported = true
            }
            if alsoBlock {
                try await Moderation.block(userId: target.userId)
                await onBlocked?()
            }
            done = true
        } catch {
            self.error = "Couldn't send the report. Check your connection and try again, or email support@recbuddy.app."
        }
    }
}
