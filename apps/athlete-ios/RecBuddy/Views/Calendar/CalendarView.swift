import SwiftUI

struct CalendarView: View {
    let profile: Profile
    @State private var store = PlanStore()
    @State private var selected: Workout?
    @State private var accountOpen = false
    @AppStorage("unit") private var unitRaw = "mi"
    private var unit: Unit { Unit(rawValue: unitRaw) ?? .mi }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    weekHeader
                }
                ForEach(store.weekDates, id: \.self) { date in
                    dayRow(date)
                }
                if store.phase == .idle && store.workoutsByDate.isEmpty {
                    Section {
                        Text("Your coach hasn't built your plan yet.")
                            .font(.footnote).foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                }
                if case .error(let msg) = store.phase {
                    Section { Label(msg, systemImage: "wifi.exclamationmark").foregroundStyle(.red) }
                }
            }
            .navigationTitle("This Week")
            .toolbar {
                Button { accountOpen = true } label: { Image(systemName: "person.crop.circle") }
                    .accessibilityLabel("Account")
            }
            .refreshable { await store.refresh() }
            .task { await store.refresh() }
            .sheet(item: $selected) { w in
                WorkoutDetailSheet(workout: w, store: store, unit: unit)
            }
            .sheet(isPresented: $accountOpen) {
                AccountSheet(profile: profile)
            }
        }
    }

    private var weekHeader: some View {
        HStack {
            Button { Task { await store.goToWeek(offset: -1) } } label: { Image(systemName: "chevron.left") }
                .accessibilityLabel("Previous week")
            Spacer()
            Text("\(Week.fmtShortDate(store.weekMonday)) – \(Week.fmtShortDate(Week.addDays(store.weekMonday, 6)))")
                .font(.subheadline.weight(.semibold))
            Spacer()
            Button { Task { await store.goToWeek(offset: 1) } } label: { Image(systemName: "chevron.right") }
                .accessibilityLabel("Next week")
        }
        .buttonStyle(.borderless)
    }

    @ViewBuilder
    private func dayRow(_ date: String) -> some View {
        let dow = Week.DOW[store.weekDates.firstIndex(of: date) ?? 0]
        let isToday = date == Week.todayISO()
        if let w = store.workoutsByDate[date] {
            Button { selected = w } label: {
                HStack(spacing: 12) {
                    dayLabel(dow: dow, date: date, isToday: isToday)
                    TypeBadge(type: w.type)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(w.title).font(.body.weight(.semibold))
                            .strikethrough(w.status == "done", color: .secondary)
                        if let dist = w.dist {
                            Text("\(Units.fmtDist(dist, unit)) \(unit.rawValue) · \(Units.fmtPace(w.pace, unit))")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    statusDot(w.status, isToday: isToday)
                }
            }
            .foregroundStyle(.primary)
        } else {
            HStack(spacing: 12) {
                dayLabel(dow: dow, date: date, isToday: isToday)
                Text("—").foregroundStyle(.tertiary)
            }
        }
    }

    private func dayLabel(dow: String, date: String, isToday: Bool) -> some View {
        VStack(spacing: 0) {
            Text(dow).font(.caption2.weight(.bold))
                .foregroundStyle(isToday ? Color.green : .secondary)
            Text(String(date.suffix(2))).font(.footnote.monospacedDigit())
        }
        .frame(width: 34)
    }

    @ViewBuilder
    private func statusDot(_ status: String, isToday: Bool) -> some View {
        switch status {
        case "done": Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
        case "missed": Image(systemName: "xmark.circle").foregroundStyle(.red)
        case "rest": EmptyView()
        default: Circle().fill(isToday ? Color.green : Color.secondary.opacity(0.35)).frame(width: 8, height: 8)
        }
    }
}
