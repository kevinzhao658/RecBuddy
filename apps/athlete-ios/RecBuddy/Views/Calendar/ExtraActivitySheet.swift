import SwiftUI

/// Detail for an off-plan extra run/ride/swim: shows the logged values, allows
/// the same edits as a logged run (distance + elapsed time; pace re-derives
/// for runs), and delete. Deleting also excludes the source id so sync never
/// re-imports the same activity.
struct ExtraActivitySheet: View {
    let actual: WorkoutActual
    let store: PlanStore
    let unit: Unit
    @Environment(HealthSyncService.self) private var health
    @Environment(\.dismiss) private var dismiss
    @State private var dist: String
    @State private var time: String
    @State private var busy = false
    @State private var confirmDelete = false
    @State private var error: String?

    private var isRun: Bool { actual.declaredActivity == "run" }

    init(actual: WorkoutActual, store: PlanStore, unit: Unit) {
        self.actual = actual
        self.store = store
        self.unit = unit
        _dist = State(initialValue: Units.fmtDist(actual.dist, unit))
        _time = State(initialValue: actual.time)
    }

    private var miles: Double? {
        guard let d = Double(dist), d > 0 else { return nil }
        return (Units.toMiles(d, unit) * 100).rounded() / 100
    }
    private var seconds: Int? {
        guard let s = Pace.timeToSeconds(time), s > 0 else { return nil }
        return s
    }

    var body: some View {
        NavigationStack {
            ZStack {
                RB.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        HStack(spacing: 10) {
                            Image(systemName: actual.activitySymbol).foregroundStyle(RB.accent)
                            Text(actual.extraTitle)
                                .font(.title3.weight(.bold)).foregroundStyle(.white)
                            Spacer()
                            Text("from Health").font(.caption).foregroundStyle(RB.textFaint)
                        }
                        if let ts = actual.recordedAt, let day = Week.localDay(fromTimestamp: ts) {
                            Text(Week.fmtDayDate(day)).font(.caption).foregroundStyle(RB.textMute)
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            RBLabel("DISTANCE (\(unit.rawValue.uppercased()))")
                            TextField("4.5", text: $dist).keyboardType(.decimalPad)
                                .foregroundStyle(.white).rbField()
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            RBLabel("TOTAL TIME")
                            TextField("45:00", text: $time)
                                .foregroundStyle(.white).rbField()
                        }
                        if let hr = actual.hr {
                            VStack(alignment: .leading, spacing: 8) {
                                RBLabel("AVG HEART RATE")
                                Text("\(hr) bpm").font(.body.weight(.semibold)).foregroundStyle(.white)
                            }
                        }
                        if let error { Text(error).font(.footnote).foregroundStyle(.red) }

                        Button(busy ? "Saving…" : "Save changes") { Task { await save() } }
                            .buttonStyle(VoltButtonStyle())
                            .disabled(busy || miles == nil || seconds == nil)

                        Button("Delete activity") { confirmDelete = true }
                            .font(.footnote.weight(.semibold)).foregroundStyle(.red)
                            .frame(maxWidth: .infinity)
                            .disabled(busy)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Extra activity")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { dismiss() }.foregroundStyle(RB.accent)
                }
            }
            .confirmationDialog("Delete this activity?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) { Task { await remove() } }
            }
        }
    }

    private func save() async {
        guard let miles, let seconds else { return }
        busy = true; error = nil; defer { busy = false }
        let pace = isRun ? Pace.derive(miles: miles, totalSeconds: seconds) : nil
        do {
            try await store.updateRun(actualId: actual.id, dist: miles,
                                      time: Pace.timeString(fromSeconds: seconds), pace: pace,
                                      hr: actual.hr, feel: actual.feel, note: actual.note)
            dismiss()
        } catch { self.error = "Couldn't save — try again." }
    }

    private func remove() async {
        busy = true; error = nil; defer { busy = false }
        do {
            if let sid = actual.sourceId { health.exclude(sourceId: sid) } // never re-import
            try await store.deleteActual(id: actual.id)
            dismiss()
        } catch { self.error = "Couldn't delete — try again." }
    }
}
