import SwiftUI

/// Lets the athlete edit their race goal (name, distance, date, goal time).
/// Writes via the update_my_goal security-definer RPC.
struct GoalSettingsView: View {
    let profile: Profile
    let plan: Plan?
    @Environment(SessionStore.self) private var session

    @State private var raceName: String
    @State private var distance: String
    @State private var goalDate: Date
    @State private var timeDigits: String   // raw digits, fills H:MM:SS from right

    @State private var busy = false
    @State private var saved = false
    @State private var error: String?

    init(profile: Profile, plan: Plan?) {
        self.profile = profile
        self.plan = plan
        _raceName  = State(initialValue: plan?.goalRace ?? "")
        _distance  = State(initialValue: plan?.goalDistance ?? "")
        _goalDate  = State(initialValue: Self.parseDate(plan?.goalDate))
        _timeDigits = State(initialValue: Self.digitsFromTime(plan?.goalTime))
    }

    // MARK: – Helpers

    private static func parseDate(_ iso: String?) -> Date {
        guard let iso, let d = Week.parse(iso) else { return Date() }
        return d
    }

    /// "1:48:00" → "14800"
    private static func digitsFromTime(_ time: String?) -> String {
        guard let time, !time.isEmpty else { return "" }
        return time.split(separator: ":").map(String.init).joined()
    }

    /// Raw digit buffer → formatted "H:MM:SS" / "M:SS" display string
    private var timeShown: String {
        let d = timeDigits
        guard !d.isEmpty else { return "" }
        if d.count <= 2 { return d }
        if d.count <= 4 {
            let m = Int(d.dropLast(2)) ?? 0
            let ss = String(format: "%02d", Int(d.suffix(2)) ?? 0)
            return "\(m):\(ss)"
        }
        // 5–6 digits → H:MM:SS
        let h  = Int(d.prefix(d.count - 4)) ?? 0
        let mm = String(format: "%02d", Int(String(d.dropFirst(d.count - 4).prefix(2))) ?? 0)
        let ss = String(format: "%02d", Int(d.suffix(2)) ?? 0)
        return "\(h):\(mm):\(ss)"
    }

    /// Date → "YYYY-MM-DD" for the RPC
    private var goalDateString: String { Week.format(goalDate) }

    var body: some View {
        ZStack {
            RB.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {

                    // Race name
                    fieldGroup(label: "RACE NAME") {
                        TextField("e.g. Boston Marathon", text: $raceName)
                            .foregroundStyle(.white)
                            .rbField()
                            .onChange(of: raceName) { _, _ in saved = false }
                    }

                    // Distance
                    fieldGroup(label: "GOAL DISTANCE") {
                        TextField("e.g. 26.2 mi", text: $distance)
                            .foregroundStyle(.white)
                            .rbField()
                            .onChange(of: distance) { _, _ in saved = false }
                    }

                    // Date
                    VStack(alignment: .leading, spacing: 8) {
                        RBLabel("RACE DATE")
                        DatePicker(
                            "",
                            selection: $goalDate,
                            in: Date()...,
                            displayedComponents: .date
                        )
                        .datePickerStyle(.compact)
                        .labelsHidden()
                        .colorScheme(.dark)
                        .tint(RB.accent)
                        .onChange(of: goalDate) { _, _ in saved = false }
                    }

                    // Goal time — digit-buffered H:MM:SS
                    fieldGroup(label: "GOAL TIME (H:MM:SS)") {
                        TextField(
                            "1:48:00",
                            text: Binding(
                                get: { timeShown },
                                set: { timeDigits = String($0.filter(\.isNumber).suffix(6)) }
                            )
                        )
                        .keyboardType(.numberPad)
                        .foregroundStyle(.white)
                        .rbField()
                        .onChange(of: timeDigits) { _, _ in saved = false }
                    }

                    if let error {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }

                    Button(busy ? "Saving…" : saved ? "Saved ✓" : "Save goal") {
                        Task { await save() }
                    }
                    .buttonStyle(VoltButtonStyle())
                    .disabled(busy)
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 40)
            }
        }
        .navigationTitle("Race goal")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
    }

    // MARK: – Helpers

    @ViewBuilder
    private func fieldGroup<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            RBLabel(label)
            content()
        }
    }

    // MARK: – Action

    private func save() async {
        busy = true; error = nil; saved = false
        defer { busy = false }
        do {
            try await Supa.shared.rpc("update_my_goal", params: [
                "p_goal_race":     raceName.trimmingCharacters(in: .whitespaces),
                "p_goal_distance": distance.trimmingCharacters(in: .whitespaces),
                "p_goal_date":     goalDateString,
                "p_goal_time":     timeShown.isEmpty ? "" : timeShown
            ]).execute()
            await session.refreshProfile()
            saved = true
        } catch {
            let msg = error.localizedDescription
            if msg.lowercased().contains("no plan yet") {
                self.error = "No plan yet — your coach creates the plan first."
            } else {
                self.error = "Couldn't save — try again."
            }
        }
    }
}
