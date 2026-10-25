import SwiftUI

/// iMessage-style corner badge: each reaction kind once, plus the total when >1.
struct ReactionBadge: View {
    let kinds: [ReactionKind]
    let count: Int
    let mineHighlighted: Bool

    var body: some View {
        HStack(spacing: 1) {
            ForEach(kinds) { Text($0.emoji).font(.system(size: 12)) }
            if count > 1 {
                Text("\(count)").font(.system(size: 10, weight: .bold)).foregroundStyle(RB.textMute)
                    .padding(.leading, 2)
            }
        }
        .padding(.horizontal, 6).padding(.vertical, 2)
        .background(mineHighlighted ? RB.accent.opacity(0.25) : RB.surface2)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(RB.bg, lineWidth: 2))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(count) reaction\(count == 1 ? "" : "s"): \(kinds.map(\.label).joined(separator: ", "))")
        .accessibilityHint("Shows who reacted")
    }
}

/// Who reacted, grouped by kind.
struct ReactionsDetailSheet: View {
    let rows: [(name: String, kind: ReactionKind)]
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            List(Array(rows.enumerated()), id: \.offset) { _, r in
                HStack { Text(r.kind.emoji); Text(r.name).foregroundStyle(.white); Spacer() }
                    .listRowBackground(Color.clear)
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(RB.bg.ignoresSafeArea())
            .navigationTitle("Reactions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() }.foregroundStyle(RB.accent) } }
        }
        .presentationDetents([.medium])
    }
}
