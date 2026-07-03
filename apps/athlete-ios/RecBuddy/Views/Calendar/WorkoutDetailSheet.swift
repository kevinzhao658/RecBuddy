import SwiftUI

struct WorkoutDetailSheet: View {
    let workout: Workout
    let store: PlanStore
    let unit: Unit
    @Environment(\.dismiss) private var dismiss
    @State private var logOpen = false
    @State private var busy = false
    @State private var error: String?

    private var live: Workout { store.workoutsByDate[workout.date] ?? workout }
    private var actual: WorkoutActual? { store.actualsByWorkout[workout.id] }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 10) {
                        TypeBadge(type: live.type).font(.title3)
                        VStack(alignment: .leading) {
                            Text(live.title).font(.headline)
                            Text("\(Week.fmtShortDate(live.date)) · \(live.type.capitalized)")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    if let dist = live.dist {
                        LabeledContent("Distance", value: "\(Units.fmtDist(dist, unit)) \(unit.rawValue)")
                        LabeledContent("Pace", value: Units.fmtPace(live.pace, unit))
                    }
                    let est = EstMinutes.compute(type: live.type, estMinutes: live.estMinutes,
                                                 dist: live.dist, pace: live.pace, dur: live.dur)
                    if est > 0 { LabeledContent("Est. time", value: "\(est) min") }
                }
                if !live.sets.isEmpty {
                    Section("Workout structure") {
                        ForEach(Array(live.sets.enumerated()), id: \.offset) { _, pair in
                            LabeledContent(pair.first ?? "", value: pair.count > 1 ? pair[1] : "")
                        }
                    }
                }
                if let note = live.note, !note.isEmpty {
                    Section("Coach's note") { Text(note) }
                }
                if let a = actual {
                    Section("Your logged run") {
                        LabeledContent("Distance", value: "\(Units.fmtDist(a.dist, unit)) \(unit.rawValue)")
                        LabeledContent("Pace", value: Units.fmtPace(a.pace, unit))
                        LabeledContent("Time", value: a.time)
                        if let hr = a.hr { LabeledContent("Avg HR", value: "\(hr)") }
                    }
                }
                if let error { Text(error).foregroundStyle(.red).font(.footnote) }
                if live.type != "rest" {
                    Section {
                        if live.status == "done" {
                            Button("Mark as not done", role: .destructive) { Task { await set("planned") } }
                        } else {
                            Button("Log run…") { logOpen = true }
                            Button(busy ? "Marking…" : "Mark done") { Task { await set("done") } }
                        }
                    }
                    .disabled(busy)
                }
            }
            .navigationTitle("Workout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Close") { dismiss() } }
            .sheet(isPresented: $logOpen) {
                LogRunSheet(workout: live, store: store, unit: unit)
            }
        }
    }

    private func set(_ status: String) async {
        busy = true; error = nil
        do { try await store.setStatus(live, to: status) }
        catch { self.error = "Couldn't update — try again." }
        busy = false
    }
}
