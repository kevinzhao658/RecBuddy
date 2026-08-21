import SwiftUI

/// The completion flow: opened by "Mark as complete" on the detail sheet.
/// Distance + AVERAGE PACE prefill from the plan, so "Save run" with no typing
/// logs the prescribed values (total time derived). Workouts with no dist/pace
/// targets (e.g. cross-training) save as a plain mark-complete. A partial
/// entry (one field, not both) disables Save.
/// Pass `existing` to EDIT a logged run in place (fields prefill from the
/// actual, save updates the row) — no unmark-and-relog needed.
struct LogRunSheet: View {
    let workout: Workout
    let store: PlanStore
    let unit: Unit
    let existing: WorkoutActual?
    @Environment(\.dismiss) private var dismiss
    @State private var dist = ""
    @State private var paceDigits = ""   // raw typed digits, fills M:SS from the right
    @State private var hr = ""
    @State private var feel: Int? = nil   // optional; 1=easy 3=moderate 5=hard
    @State private var note = ""
    @State private var share = true
    @State private var busy = false
    @State private var error: String?
    /// Declared sport for CROSS workouts ('run'/'ride'/'swim') — the athlete
    /// picks what they actually did; non-cross workouts are always 'run'.
    @State private var activity: String
    /// Direct TOTAL TIME entry for bike/swim (no pace — pace is a running
    /// concept, so non-run cross logs take distance + time instead).
    @State private var timeText: String
    /// Average power for rides (watts, optional — needs a power meter).
    @State private var watts: String

    init(workout: Workout, store: PlanStore, unit: Unit, existing: WorkoutActual? = nil) {
        self.workout = workout
        self.store = store
        self.unit = unit
        self.existing = existing
        // Cross defaults to Bike (the common case); editing keeps the declared sport.
        _activity = State(initialValue: existing?.declaredActivity
            ?? (workout.type == "cross" ? "ride" : "run"))
        _timeText = State(initialValue: existing?.time ?? "")
        _watts = State(initialValue: existing?.avgWatts.map(String.init) ?? "")
        if let existing {
            // Edit: prefill from the logged actual; sharing an update is opt-in.
            // Swims prefill in meters — that's the unit the field takes.
            _dist = State(initialValue: existing.declaredActivity == "swim"
                ? String(SportMetrics.meters(fromMiles: existing.dist))
                : Units.fmtDist(existing.dist, unit))
            _paceDigits = State(initialValue: Self.digits(fromPace: existing.pace, unit: unit))
            _hr = State(initialValue: existing.hr.map(String.init) ?? "")
            _feel = State(initialValue: existing.feel)
            _note = State(initialValue: existing.note ?? "")
            _share = State(initialValue: false)
        } else {
            // Prefill from the plan so most runs are a two-tap log.
            _dist = State(initialValue: workout.dist.map { Units.fmtDist($0, unit) } ?? "")
            _paceDigits = State(initialValue: Self.digits(fromPace: workout.pace, unit: unit))
        }
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
    /// Swims enter distance in METERS; everything else in the athlete's unit.
    private var isSwim: Bool { workout.type == "cross" && activity == "swim" }
    private var miles: Double? {
        guard let d = Double(dist), d > 0 else { return nil }
        if isSwim { return SportMetrics.miles(fromMeters: d) }
        return (Units.toMiles(d, unit) * 100).rounded() / 100
    }
    /// TOTAL TIME derived from distance x average pace.
    private var derivedTimeSeconds: Int? {
        guard let miles, let pace = canonicalPace, let secPerMi = Pace.toSeconds(pace) else { return nil }
        return Int((miles * Double(secPerMi)).rounded())
    }
    /// Runs enter pace (time derives); bike/swim enter total time directly.
    private var paced: Bool { workout.type != "cross" || activity == "run" }
    /// Typed TOTAL TIME -> seconds; nil until valid (bike/swim entry).
    private var typedTimeSeconds: Int? {
        guard let s = Pace.timeToSeconds(timeText), s > 0 else { return nil }
        return s
    }
    private var canSave: Bool {
        if bothEmpty && existing == nil { return true } // plain mark-complete
        if paced { return derivedTimeSeconds != nil }
        return miles != nil && typedTimeSeconds != nil
    }

    var body: some View {
        NavigationStack {
            ZStack {
                RB.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {

                        // Cross workouts: declare the sport — it decides which
                        // volume bucket the miles land in (run vs cross).
                        if workout.type == "cross" {
                            VStack(alignment: .leading, spacing: 8) {
                                RBLabel("WHAT DID YOU DO?")
                                HStack(spacing: 10) {
                                    activityChip(label: "Run", symbol: "figure.run", value: "run")
                                    activityChip(label: "Bike", symbol: "bicycle", value: "ride")
                                    activityChip(label: "Swim", symbol: "figure.pool.swim", value: "swim")
                                }
                            }
                        }

                        // Distance — digits + one decimal point only (meters for swims)
                        fieldGroup(label: isSwim ? "DISTANCE (M)" : "DISTANCE (\(unit.rawValue.uppercased()))") {
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

                        if paced {
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
                        } else {
                            // Bike/swim: no run pace — total time is entered directly.
                            fieldGroup(label: "TOTAL TIME") {
                                TextField("45:00", text: $timeText)
                                    .foregroundStyle(.white)
                                    .rbField()
                            }

                            // Sport-native readout: rides in avg speed, swims /100m.
                            if let m = miles, let s = typedTimeSeconds,
                               let lens = activity == "swim"
                                   ? SportMetrics.swimPace100Text(miles: m, seconds: s)
                                   : SportMetrics.avgSpeedText(miles: m, seconds: s, unit: unit) {
                                VStack(alignment: .leading, spacing: 6) {
                                    RBLabel(activity == "swim" ? "PACE /100M" : "AVG SPEED")
                                    Text(lens)
                                        .font(.body.weight(.semibold))
                                        .foregroundStyle(RB.accent)
                                }
                            }

                            // Power — the ride metric worth recording (optional).
                            if activity == "ride" {
                                fieldGroup(label: "AVG POWER (W, OPTIONAL)") {
                                    TextField("210", text: $watts)
                                        .keyboardType(.numberPad)
                                        .foregroundStyle(.white)
                                        .rbField()
                                        .onChange(of: watts) { _, new in
                                            watts = String(new.filter(\.isNumber).prefix(4))
                                        }
                                }
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

                        // Feel — three effort icons, optional (tap again to clear)
                        VStack(alignment: .leading, spacing: 8) {
                            RBLabel("HOW DID IT FEEL? (OPTIONAL)")
                            HStack(spacing: 10) {
                                feelChip(label: "Easy", face: .laugh, value: 1)
                                feelChip(label: "Moderate", face: .smile, value: 3)
                                feelChip(label: "Hard", face: .frown, value: 5)
                            }
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

                        // One Save: full log when dist+pace present (prefilled or typed);
                        // plain mark-complete when both are empty (no-target workouts).
                        Button(busy ? "Saving…" : existing != nil ? "Save changes" : "Save run") { Task { await save() } }
                            .buttonStyle(VoltButtonStyle())
                            .disabled(busy || !canSave)
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 20)
                    .padding(.bottom, 32)
                }
            }
            .navigationTitle(existing != nil ? "Edit logged run" : "Complete workout")
            .onChange(of: activity) { old, new in
                // Switching a paced entry to bike/swim: carry the derived time
                // over so the athlete doesn't retype what the form already knew.
                if new != "run", timeText.isEmpty, let t = derivedTimeSeconds {
                    timeText = Pace.timeString(fromSeconds: t)
                }
                // The distance field changes units with the sport (meters for
                // swims) — convert the typed value instead of dropping it.
                if let d = Double(dist), d > 0 {
                    if new == "swim", old != "swim" {
                        dist = String(SportMetrics.meters(fromMiles: (Units.toMiles(d, unit) * 100).rounded() / 100))
                    } else if old == "swim", new != "swim" {
                        dist = Units.fmtDist(SportMetrics.miles(fromMeters: d), unit)
                    }
                }
            }
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

    /// Both entry fields empty -> Save just marks complete (no actual row).
    private var bothEmpty: Bool {
        dist.trimmingCharacters(in: .whitespaces).isEmpty
            && (paced ? paceDigits.isEmpty : timeText.trimmingCharacters(in: .whitespaces).isEmpty)
    }

    // Drawn line-art faces (FaceIcon) — icon-style, tintable; SF Symbols has no
    // open-mouth/frowning face so these are custom-drawn per user spec.
    private func feelChip(label: String, face: FaceIcon.Kind, value: Int) -> some View {
        let selected = feel == value
        return Button {
            feel = selected ? nil : value // tap again to clear
        } label: {
            VStack(spacing: 5) {
                FaceIcon(kind: face, size: 20)
                Text(label).font(.caption2.weight(.semibold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .foregroundStyle(selected ? RB.accent : RB.textMute)
            .background(selected ? RB.accent.opacity(0.12) : RB.surface2)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12)
                .stroke(selected ? RB.accent : RB.line, lineWidth: 1))
        }
        .accessibilityLabel("\(label) effort")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    /// Sport chip for cross workouts — same visual language as feelChip.
    private func activityChip(label: String, symbol: String, value: String) -> some View {
        let selected = activity == value
        return Button {
            activity = value
        } label: {
            VStack(spacing: 5) {
                Image(systemName: symbol).font(.system(size: 18, weight: .semibold))
                Text(label).font(.caption2.weight(.semibold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .foregroundStyle(selected ? RB.accent : RB.textMute)
            .background(selected ? RB.accent.opacity(0.12) : RB.surface2)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12)
                .stroke(selected ? RB.accent : RB.line, lineWidth: 1))
        }
        .accessibilityLabel("Logged as \(label.lowercased())")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func save() async {
        busy = true; error = nil; defer { busy = false }
        // No-target workout, nothing entered: plain mark-complete (new logs only).
        if bothEmpty && existing == nil {
            do { try await store.setStatus(workout, to: "done"); dismiss() }
            catch { self.error = "Couldn't update — try again." }
            return
        }
        guard let miles else { error = "Enter a distance."; return }
        let pace: String?, secs: Int
        if paced {
            guard let p = canonicalPace, let s = derivedTimeSeconds else {
                error = "Enter distance and pace."
                return
            }
            pace = p; secs = s
        } else {
            guard let s = typedTimeSeconds else {
                error = "Enter distance and total time."
                return
            }
            pace = nil; secs = s   // pace is a running concept — bike/swim store none
        }
        let time = Pace.timeString(fromSeconds: secs)
        let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
        let avgWatts = activity == "ride" ? Int(watts) : nil
        do {
            if let existing {
                // Edit in place — the workout stays done, the actual row updates.
                try await store.updateRun(actualId: existing.id, dist: miles, time: time,
                                          pace: pace, hr: Int(hr), feel: feel,
                                          note: trimmedNote.isEmpty ? nil : trimmedNote,
                                          activity: activity, avgWatts: avgWatts)
            } else {
                try await store.logRun(workout: workout, dist: miles, time: time,
                                       pace: pace, hr: Int(hr), feel: feel,
                                       note: trimmedNote.isEmpty ? nil : trimmedNote,
                                       activity: activity, avgWatts: avgWatts)
            }
            if share {
                try? await ChatShare.shareRunCard(
                    athleteId: workout.athleteId, workoutId: workout.id, date: workout.date,
                    type: workout.type, title: workout.title,
                    dist: "\(Units.fmtDist(miles, .mi)) mi", pace: pace ?? "—", time: time,
                    hr: Int(hr), note: trimmedNote.isEmpty ? nil : trimmedNote)
            }
            dismiss()
        } catch {
            self.error = "Couldn't save the run — try again."
        }
    }
}
