import SwiftUI

struct LogRunSheet: View {
    let workout: Workout
    let store: PlanStore
    let unit: Unit
    @Environment(\.dismiss) private var dismiss
    @State private var dist = ""
    @State private var time = ""
    @State private var hr = ""
    @State private var feel = 3
    @State private var share = true
    @State private var busy = false
    @State private var error: String?

    /// Canonical pace derived from the entered distance (display unit) + time.
    private var derivedPace: String? {
        guard let d = Double(dist), let secs = Pace.timeToSeconds(time) else { return nil }
        let miles = Units.toMiles(d, unit)
        return Pace.derive(miles: miles, totalSeconds: secs)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Your run") {
                    TextField("Distance (\(unit.rawValue))", text: $dist).keyboardType(.decimalPad)
                    TextField("Time (e.g. 45:00 or 1:25:14)", text: $time)
                    if let p = derivedPace {
                        LabeledContent("Pace", value: Units.fmtPace(p, unit))
                    }
                    TextField("Avg heart rate (optional)", text: $hr).keyboardType(.numberPad)
                    Picker("How did it feel?", selection: $feel) {
                        ForEach(1...5, id: \.self) { Text(String(repeating: "★", count: $0)).tag($0) }
                    }
                }
                Section {
                    Toggle("Share to chat", isOn: $share)
                }
                if let error { Text(error).foregroundStyle(.red).font(.footnote) }
                Button(busy ? "Saving…" : "Save run") { Task { await save() } }
                    .disabled(busy || derivedPace == nil)
            }
            .navigationTitle("Log run")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Cancel") { dismiss() } }
        }
    }

    private func save() async {
        guard let d = Double(dist), let pace = derivedPace else { return }
        busy = true; error = nil
        let miles = (Units.toMiles(d, unit) * 100).rounded() / 100
        do {
            try await store.logRun(workout: workout, dist: miles, time: time,
                                   pace: pace, hr: Int(hr), feel: feel)
            if share {
                try? await ChatShare.shareRunCard(
                    athleteId: workout.athleteId, title: workout.title,
                    dist: "\(Units.fmtDist(miles, .mi)) mi", pace: pace, time: time, hr: Int(hr))
            }
            dismiss()
        } catch {
            self.error = "Couldn't save the run — try again."
        }
        busy = false
    }
}
