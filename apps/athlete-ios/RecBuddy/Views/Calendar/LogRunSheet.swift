import SwiftUI

/// The completion flow: opened by "Mark as complete" on the detail sheet.
/// Athlete enters distance + AVERAGE PACE (total time is derived), optional
/// HR + feel + a free-form comment — or skips straight to marking done.
struct LogRunSheet: View {
    let workout: Workout
    let store: PlanStore
    let unit: Unit
    @Environment(\.dismiss) private var dismiss
    @State private var dist = ""
    @State private var paceDigits = ""   // raw typed digits, fills M:SS from the right
    @State private var hr = ""
    @State private var feel = 3
    @State private var note = ""
    @State private var share = true
    @State private var busy = false
    @State private var error: String?

    init(workout: Workout, store: PlanStore, unit: Unit) {
        self.workout = workout
        self.store = store
        self.unit = unit
        // Prefill from the plan so most runs are a two-tap log.
        _dist = State(initialValue: workout.dist.map { Units.fmtDist($0, unit) } ?? "")
        _paceDigits = State(initialValue: Self.digits(fromPace: workout.pace, unit: unit))
    }

    /// "9:30/mi" (canonical) -> "930" display-unit digit buffer; "" if none.
    private static func digits(fromPace pace: String?, unit: Unit) -> String {
        guard var sec = Pace.toSeconds(pace) else { return "" }
        if unit == .km { sec = Int((Double(sec) / Units.kmPerMi).rounded()) }
        return "\(sec / 60)" + String(format: "%02d", sec % 60)
    }

    /// Typed pace digits -> display string ("930" -> "9:30", "45" -> "45").
    private var paceShown: String {
        paceDigits.count > 2
            ? "\(Int(paceDigits.dropLast(2)) ?? 0):\(paceDigits.suffix(2))"
            : paceDigits
    }
    /// Seconds per DISPLAY unit from the digit buffer; nil until a full M:SS.
    private var paceDispSeconds: Int? {
        guard paceDigits.count > 2 else { return nil }
        let m = Int(paceDigits.dropLast(2)) ?? 0
        let s = Int(paceDigits.suffix(2)) ?? 0
        let total = m * 60 + s
        return total > 0 ? total : nil
    }
    /// Canonical "M:SS/mi" pace from the buffer.
    private var canonicalPace: String? {
        guard let disp = paceDispSeconds else { return nil }
        return Pace.fromSeconds(unit == .km ? Int((Double(disp) * Units.kmPerMi).rounded()) : disp)
    }
    private var miles: Double? {
        guard let d = Double(dist), d > 0 else { return nil }
        return (Units.toMiles(d, unit) * 100).rounded() / 100
    }
    /// TOTAL TIME derived from distance x average pace.
    private var derivedTimeSeconds: Int? {
        guard let miles, let pace = canonicalPace, let secPerMi = Pace.toSeconds(pace) else { return nil }
        return Int((miles * Double(secPerMi)).rounded())
    }

    var body: some View {
        NavigationStack {
            ZStack {
                RB.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {

                        // Distance — digits + one decimal point only
                        fieldGroup(label: "DISTANCE (\(unit.rawValue.uppercased()))") {
                            TextField("4.5", text: $dist)
                                .keyboardType(.decimalPad)
                                .foregroundStyle(.white)
                                .rbField()
                                .onChange(of: dist) { _, new in
                                    var clean = new.filter { $0.isNumber || $0 == "." }
                                    if let first = clean.firstIndex(of: ".") {
                                        let after = clean.index(after: first)
                                        clean = String(clean[..<after]) + clean[after...].filter(\.isNumber)
                                    }
                                    dist = String(clean.prefix(5))
                                }
                        }

                        // Average pace — templated M:SS, digits fill from the right
                        fieldGroup(label: "AVG PACE (/\(unit.rawValue.uppercased()))") {
                            TextField(unit == .km ? "5:50" : "9:30",
                                      text: Binding(get: { paceShown },
                                                    set: { paceDigits = String($0.filter(\.isNumber).suffix(4)) }))
                                .keyboardType(.numberPad)
                                .foregroundStyle(.white)
                                .rbField()
                        }

                        // Derived total time (read-only)
                        if let t = derivedTimeSeconds {
                            VStack(alignment: .leading, spacing: 6) {
                                RBLabel("TOTAL TIME")
                                Text(Pace.timeString(fromSeconds: t))
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(RB.accent)
                            }
                        }

                        // Heart rate — digits only
                        fieldGroup(label: "AVG HEART RATE (OPTIONAL)") {
                            TextField("150", text: $hr)
                                .keyboardType(.numberPad)
                                .foregroundStyle(.white)
                                .rbField()
                                .onChange(of: hr) { _, new in
                                    hr = String(new.filter(\.isNumber).prefix(3))
                                }
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

                        // Free-form comment
                        fieldGroup(label: "HOW DID IT GO? (OPTIONAL)") {
                            TextField("Felt strong on the second half…", text: $note, axis: .vertical)
                                .lineLimit(2...4)
                                .foregroundStyle(.white)
                                .rbField()
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

                        // Save (full log) / skip (status only)
                        Button(busy ? "Saving…" : "Save run") { Task { await save() } }
                            .buttonStyle(VoltButtonStyle())
                            .disabled(busy || derivedTimeSeconds == nil)
                        Button("Just mark as complete") { Task { await skipAndComplete() } }
                            .buttonStyle(VoltButtonStyle(prominent: false))
                            .disabled(busy)
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 20)
                    .padding(.bottom, 32)
                }
            }
            .navigationTitle("Complete workout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(RB.accent)
                }
            }
        }
    }

    @ViewBuilder
    private func fieldGroup<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            RBLabel(label)
            content()
        }
    }

    private func save() async {
        guard let miles, let pace = canonicalPace, let secs = derivedTimeSeconds else { return }
        busy = true; error = nil; defer { busy = false }
        let time = Pace.timeString(fromSeconds: secs)
        let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            try await store.logRun(workout: workout, dist: miles, time: time,
                                   pace: pace, hr: Int(hr), feel: feel,
                                   note: trimmedNote.isEmpty ? nil : trimmedNote)
            if share {
                try? await ChatShare.shareRunCard(
                    athleteId: workout.athleteId, title: workout.title,
                    dist: "\(Units.fmtDist(miles, .mi)) mi", pace: pace, time: time,
                    hr: Int(hr), note: trimmedNote.isEmpty ? nil : trimmedNote)
            }
            dismiss()
        } catch {
            self.error = "Couldn't save the run — try again."
        }
    }

    /// Mark done without logging details.
    private func skipAndComplete() async {
        busy = true; error = nil; defer { busy = false }
        do {
            try await store.setStatus(workout, to: "done")
            dismiss()
        } catch {
            self.error = "Couldn't update — try again."
        }
    }
}
