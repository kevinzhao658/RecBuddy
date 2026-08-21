import SwiftUI

/// Pending Health activities awaiting a decision. Each row: attach to one of
/// that day's workouts, keep as its own extra card, or dismiss (never
/// re-imported). Rows disappear as they're resolved; the sheet closes itself
/// when none remain.
struct ConfirmActivitySheet: View {
    @Environment(HealthSyncService.self) private var health
    let store: PlanStore
    let unit: Unit
    @Environment(\.dismiss) private var dismiss
    @State private var busyId: String?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack {
                RB.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if let error {
                            Text(error).font(.footnote).foregroundStyle(.red)
                        }
                        ForEach(health.state.pending) { p in
                            row(p)
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Confirm activities")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { dismiss() }.foregroundStyle(RB.accent)
                }
            }
            .onChange(of: health.state.pending.isEmpty) { _, empty in
                if empty { dismiss() }
            }
        }
    }

    private func row(_ p: PendingActivity) -> some View {
        let kind = p.sample.kind
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: kind.symbol)
                    .foregroundStyle(RB.accent)
                VStack(alignment: .leading, spacing: 2) {
                    Text(kind.noun.capitalized)
                        .font(.subheadline.weight(.bold)).foregroundStyle(.white)
                    Text("\(Week.fmtDayDate(HealthMatcher.localDay(of: p.sample.startDate))) · \(kind == .swimming ? SportMetrics.metersText(miles: p.sample.miles) : "\(Units.fmtDist(p.sample.miles, unit)) \(unit.rawValue)") · \(Pace.timeString(fromSeconds: p.sample.durationSeconds))")
                        .font(.caption).foregroundStyle(RB.textMute)
                }
                Spacer()
                if busyId == p.id { ProgressView() }
            }
            // Attach options (that day's candidate workouts)
            ForEach(p.candidates, id: \.id) { c in
                Button { resolve(p, .attach(workoutId: c.id)) } label: {
                    HStack {
                        TypeBadge(type: c.type)
                        Text("Log as \"\(c.title)\"").font(.footnote.weight(.semibold))
                        Spacer()
                        Image(systemName: "chevron.right").font(.caption2)
                    }
                    .foregroundStyle(.white)
                    .padding(10)
                    .background(RB.surface2)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
            }
            HStack(spacing: 10) {
                Button { resolve(p, .standalone) } label: {
                    Text("Keep as extra \(kind.noun)")
                        .font(.footnote.weight(.semibold)).frame(maxWidth: .infinity)
                }
                .buttonStyle(VoltButtonStyle())
                Button { resolve(p, .dismiss) } label: {
                    Text("Dismiss").font(.footnote.weight(.semibold))
                        .foregroundStyle(RB.textMute).padding(.horizontal, 14)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14)
        .rbCard()
        .disabled(busyId != nil)
    }

    private func resolve(_ p: PendingActivity, _ r: HealthSyncCoordinator.Resolution) {
        busyId = p.id; error = nil
        Task {
            do {
                try await health.resolve(p.id, r)
                await store.refresh()
            } catch {
                self.error = "Couldn't save — try again."
            }
            busyId = nil
        }
    }
}
