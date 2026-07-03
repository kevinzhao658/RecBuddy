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
            ZStack {
                RB.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {

                        // Distance
                        fieldGroup(label: "DISTANCE (\(unit.rawValue.uppercased()))") {
                            TextField("4.5", text: $dist)
                                .keyboardType(.decimalPad)
                                .foregroundStyle(.white)
                                .rbField()
                        }

                        // Time — auto-formatting number pad
                        fieldGroup(label: "TIME") {
                            TextField("45:00", text: $time)
                                .keyboardType(.numberPad)
                                .foregroundStyle(.white)
                                .rbField()
                                .onChange(of: time) { _, new in
                                    time = formatTimeInput(new)
                                }
                        }

                        // Derived pace (read-only display)
                        if let p = derivedPace {
                            VStack(alignment: .leading, spacing: 6) {
                                RBLabel("PACE")
                                Text(Units.fmtPace(p, unit))
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(.white)
                            }
                        }

                        // Heart rate
                        fieldGroup(label: "AVG HEART RATE (OPTIONAL)") {
                            TextField("150", text: $hr)
                                .keyboardType(.numberPad)
                                .foregroundStyle(.white)
                                .rbField()
                        }

                        // Feel picker
                        VStack(alignment: .leading, spacing: 8) {
                            RBLabel("HOW DID IT FEEL?")
                            Picker("", selection: $feel) {
                                ForEach(1...5, id: \.self) { i in
                                    Text(String(repeating: "★", count: i)).tag(i)
                                }
                            }
                            .pickerStyle(.segmented)
                        }

                        // Share toggle
                        HStack {
                            Text("Share to chat")
                                .font(.subheadline)
                                .foregroundStyle(.white)
                            Spacer()
                            Toggle("", isOn: $share).labelsHidden()
                        }
                        .padding(.vertical, 4)

                        if let error {
                            Text(error)
                                .foregroundStyle(.red)
                                .font(.footnote)
                        }

                        // Save button
                        Button(busy ? "Saving…" : "Save run") { Task { await save() } }
                            .buttonStyle(VoltButtonStyle())
                            .disabled(busy || derivedPace == nil)
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 20)
                    .padding(.bottom, 32)
                }
            }
            .navigationTitle("Log Run")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(RB.accent)
                }
            }
        }
    }

    /// Auto-formats digit-only input right-to-left into H:MM:SS / MM:SS.
    /// "4500" -> "45:00", "12514" -> "1:25:14".
    private func formatTimeInput(_ raw: String) -> String {
        let d = raw.filter(\.isNumber).suffix(6)
        guard !d.isEmpty else { return "" }
        let s = String(d)
        if s.count <= 2 { return s }                          // "45" (seconds so far)
        if s.count <= 4 {                                      // "4500" -> "45:00"
            return "\(s.dropLast(2)):\(s.suffix(2))"
        }
        // 5-6 digits: "12514" -> "1:25:14"
        return "\(s.dropLast(4)):\(s.dropLast(2).suffix(2)):\(s.suffix(2))"
    }

    @ViewBuilder
    private func fieldGroup<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            RBLabel(label)
            content()
        }
    }

    private func save() async {
        guard let d = Double(dist), let pace = derivedPace else { return }
        busy = true; error = nil; defer { busy = false }
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
    }
}
