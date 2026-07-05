import SwiftUI

/// Lets the athlete edit their race goal (name, distance, date, goal time).
/// Distance and time are WHEEL PICKERS (Timer-app style vertical drums) so
/// malformed input is impossible. Writes via the update_my_goal RPC.
struct GoalSettingsView: View {
    let profile: Profile
    let plan: Plan?
    @Environment(SessionStore.self) private var session
    @AppStorage("unit") private var unitRaw = "mi"
    private var unit: Unit { Unit(rawValue: unitRaw) ?? .mi }

    @State private var raceName: String
    @State private var goalDate: Date
    // Distance drums (display unit): whole 0–99 + tenths 0–9
    @State private var distWhole: Int
    @State private var distTenth: Int
    // Time drums: hours 0–9, minutes/seconds 0–59
    @State private var hours: Int
    @State private var minutes: Int
    @State private var seconds: Int

    @State private var busy = false
    @State private var saved = false
    @State private var error: String?
    // Drums are collapsed by default; the field shows the composed value and
    // tapping it expands the wheel belt beneath (iOS inline-picker pattern).
    @State private var showDistDrums = false
    @State private var showTimeDrums = false

    init(profile: Profile, plan: Plan?) {
        self.profile = profile
        self.plan = plan
        _raceName = State(initialValue: plan?.goalRace ?? "")
        _goalDate = State(initialValue: Self.parseDate(plan?.goalDate))
        let (w, t) = Self.parseDistance(plan?.goalDistance)
        _distWhole = State(initialValue: w)
        _distTenth = State(initialValue: t)
        let (h, m, s) = Self.parseTime(plan?.goalTime)
        _hours = State(initialValue: h)
        _minutes = State(initialValue: m)
        _seconds = State(initialValue: s)
    }

    // MARK: – Parsing (prefill from the stored plan)

    private static func parseDate(_ iso: String?) -> Date {
        guard let iso, let d = Week.parse(iso) else { return Date() }
        return d
    }

    /// "13.1 mi" → (13, 1); tolerant of unit suffix / missing decimals.
    private static func parseDistance(_ text: String?) -> (Int, Int) {
        guard let text else { return (0, 0) }
        let numeric = text.split(separator: " ").first.map(String.init) ?? text
        let parts = numeric.split(separator: ".")
        let whole = Int(parts.first ?? "") ?? 0
        let tenth = parts.count > 1 ? (Int(parts[1].prefix(1)) ?? 0) : 0
        return (min(whole, 99), tenth)
    }

    /// "1:48:00" → (1,48,0); "55:00" → (0,55,0).
    private static func parseTime(_ time: String?) -> (Int, Int, Int) {
        guard let time else { return (0, 0, 0) }
        let n = time.split(separator: ":").compactMap { Int($0) }
        switch n.count {
        case 3: return (min(n[0], 9), min(n[1], 59), min(n[2], 59))
        case 2: return (0, min(n[0], 59), min(n[1], 59))
        default: return (0, 0, 0)
        }
    }

    // MARK: – Derived output strings

    private var distanceString: String { "\(distWhole).\(distTenth) \(unit.rawValue)" }
    private var timeString: String {
        hours > 0
            ? "\(hours):" + String(format: "%02d:%02d", minutes, seconds)
            : "\(minutes):" + String(format: "%02d", seconds)
    }
    private var goalDateString: String { Week.format(goalDate) }

    /// Common race distances in the current display unit → drum values.
    private var quickPicks: [(String, Int, Int)] {
        unit == .km
            ? [("5K", 5, 0), ("10K", 10, 0), ("Half", 21, 1), ("Marathon", 42, 2)]
            : [("5K", 3, 1), ("10K", 6, 2), ("Half", 13, 1), ("Marathon", 26, 2)]
    }

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

                    // Distance — quick picks + two vertical drums
                    VStack(alignment: .leading, spacing: 8) {
                        RBLabel("GOAL DISTANCE (\(unit.rawValue.uppercased()))")
                        HStack(spacing: 8) {
                            ForEach(quickPicks, id: \.0) { pick in
                                let active = distWhole == pick.1 && distTenth == pick.2
                                Button(pick.0) {
                                    distWhole = pick.1; distTenth = pick.2; saved = false
                                }
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 12).padding(.vertical, 7)
                                .foregroundStyle(active ? RB.onAccent : RB.textMute)
                                .background(active ? AnyShapeStyle(RB.accent) : AnyShapeStyle(RB.metalSurface2))
                                .clipShape(Capsule())
                                .overlay(Capsule().stroke(active ? .clear : RB.line, lineWidth: 1))
                            }
                        }
                        valueField(distanceString, expanded: showDistDrums, label: "Goal distance") {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { showDistDrums.toggle() }
                        }
                        if showDistDrums {
                            HStack(spacing: 0) {
                                drum(0...99, selection: $distWhole, label: "Distance whole number")
                                Text(".")
                                    .font(.title2.weight(.bold)).foregroundStyle(.white)
                                drum(0...9, selection: $distTenth, label: "Distance tenths")
                                Text(unit.rawValue)
                                    .font(.subheadline).foregroundStyle(RB.textMute)
                                    .padding(.leading, 8)
                                Spacer()
                            }
                            .frame(height: 110)
                            .rbCard()
                            .transition(.opacity.combined(with: .move(edge: .top)))
                        }
                    }

                    // Date
                    VStack(alignment: .leading, spacing: 8) {
                        RBLabel("RACE DATE")
                        DatePicker("", selection: $goalDate, in: Date()..., displayedComponents: .date)
                            .datePickerStyle(.compact)
                            .labelsHidden()
                            .colorScheme(.dark)
                            .tint(RB.accent)
                            .onChange(of: goalDate) { _, _ in saved = false }
                    }

                    // Goal time — collapsed value field; H : MM : SS drums on tap
                    VStack(alignment: .leading, spacing: 8) {
                        RBLabel("GOAL TIME")
                        valueField(timeString, expanded: showTimeDrums, label: "Goal time") {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { showTimeDrums.toggle() }
                        }
                        if showTimeDrums {
                            HStack(spacing: 0) {
                                drum(0...9, selection: $hours, label: "Goal hours")
                                colon
                                drum(0...59, selection: $minutes, pad: true, label: "Goal minutes")
                                colon
                                drum(0...59, selection: $seconds, pad: true, label: "Goal seconds")
                                Spacer()
                            }
                            .frame(height: 110)
                            .rbCard()
                            .transition(.opacity.combined(with: .move(edge: .top)))
                        }
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

    // MARK: – Pieces

    private var colon: some View {
        Text(":").font(.title3.weight(.bold)).foregroundStyle(RB.textMute)
    }

    /// Collapsed picker field: shows the composed value; tap to expand the drums.
    private func valueField(_ value: String, expanded: Bool, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Text(value)
                    .font(.body.monospacedDigit().weight(.semibold))
                    .foregroundStyle(.white)
                Spacer()
                Image(systemName: "chevron.down")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(RB.textMute)
                    .rotationEffect(.degrees(expanded ? 180 : 0))
            }
            .rbField()
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityValue(value)
        .accessibilityAddTraits(expanded ? .isSelected : [])
    }

    /// A compact vertical wheel ("belt") for one numeric field.
    private func drum(_ range: ClosedRange<Int>, selection: Binding<Int>, pad: Bool = false, label: String) -> some View {
        Picker(label, selection: Binding(
            get: { selection.wrappedValue },
            set: { selection.wrappedValue = $0; saved = false }
        )) {
            ForEach(Array(range), id: \.self) { n in
                Text(pad ? String(format: "%02d", n) : "\(n)")
                    .font(.title3.monospacedDigit())
                    .foregroundStyle(.white)
                    .tag(n)
            }
        }
        .pickerStyle(.wheel)
        .frame(width: 64)
        .clipped()
        .accessibilityLabel(label)
    }

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
                "p_goal_distance": distanceString,
                "p_goal_date":     goalDateString,
                "p_goal_time":     timeString
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
