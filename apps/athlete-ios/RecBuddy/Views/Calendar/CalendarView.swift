import SwiftUI

struct CalendarView: View {
    let profile: Profile
    @State private var store = PlanStore()
    @State private var selected: Workout?
    @State private var accountOpen = false
    @AppStorage("unit") private var unitRaw = "mi"
    private var unit: Unit { Unit(rawValue: unitRaw) ?? .mi }

    enum Mode { case month, week }
    @State private var mode: Mode = .week
    @State private var monthAnchor: String = Week.todayISO()

    // Today's workout only when today falls in the currently displayed week.
    private var todayWorkout: Workout? {
        let today = Week.todayISO()
        guard store.weekDates.contains(today) else { return nil }
        return store.workoutsByDate[today]
    }

    var body: some View {
        ZStack {
            RB.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    headerRow
                        .padding(.top, 12)

                    if store.weekPlannedMiles > 0 {
                        mileageBlock
                    }

                    if let w = todayWorkout {
                        todayHeroCard(w)
                    }

                    modeToggle

                    if mode == .week {
                        weekSection
                    } else {
                        monthSection
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .refreshable { await store.refresh() }
        }
        .task { await store.refresh() }
        .task(id: monthAnchor) { await store.loadMonth(anchor: monthAnchor) }
        .sheet(item: $selected) { w in
            WorkoutDetailSheet(workout: w, store: store, unit: unit)
        }
        .sheet(isPresented: $accountOpen) {
            AccountSheet(profile: profile, plan: store.plan)
        }
    }

    // MARK: - Header

    private var headerRow: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                if let plan = store.plan {
                    RBLabel("WEEK \(plan.planWeek) OF \(plan.planWeeks)", color: RB.accent)
                }
                Text("Your Plan")
                    .font(.largeTitle.bold())
                    .foregroundStyle(.white)
            }
            Spacer()
            Button { accountOpen = true } label: {
                ZStack {
                    Circle()
                        .fill(RB.surface2)
                        .frame(width: 40, height: 40)
                    Text(profile.initials)
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(.white)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Account")
        }
    }

    // MARK: - Weekly Mileage Block

    private var mileageBlock: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                RBLabel("WEEKLY MILEAGE")
                Spacer()
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(fmtMiles(store.weekDoneMiles))
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(RB.accent)
                    Text("/ \(fmtMiles(store.weekPlannedMiles)) mi")
                        .font(.subheadline)
                        .foregroundStyle(RB.textMute)
                }
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(RB.surface2)
                    let frac = store.weekPlannedMiles > 0
                        ? min(store.weekDoneMiles / store.weekPlannedMiles, 1.0)
                        : 0.0
                    Capsule()
                        .fill(RB.accent)
                        .frame(width: proxy.size.width * CGFloat(frac))
                }
            }
            .frame(height: 6)
            let remaining = max(store.weekPlannedMiles - store.weekDoneMiles, 0)
            Text("\(fmtMiles(remaining)) mi to go this week")
                .font(.caption)
                .foregroundStyle(RB.textFaint)
        }
    }

    // MARK: - TODAY Hero Card

    private func todayHeroCard(_ w: Workout) -> some View {
        Button { selected = w } label: {
            VStack(alignment: .leading, spacing: 0) {
                // Top row: TODAY badge + date
                HStack {
                    Text("TODAY")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(RB.surface2)
                        .clipShape(Capsule())
                    Spacer()
                    Text(Week.fmtDayDate(w.date))
                        .font(.caption)
                        .foregroundStyle(RB.textMute)
                }
                .padding(.bottom, 14)

                // Middle: icon tile + type label + title
                HStack(spacing: 12) {
                    iconTile(type: w.type, size: 44, cornerRadius: 10)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(w.type.capitalized)
                            .font(.caption)
                            .foregroundStyle(RB.textMute)
                        Text(w.title)
                            .font(.title3.weight(.bold))
                            .foregroundStyle(.white)
                    }
                    Spacer()
                }
                .padding(.bottom, 14)

                Divider()
                    .overlay(RB.line)

                // Bottom: stats + Details link
                HStack(alignment: .top, spacing: 20) {
                    if let dist = w.dist {
                        VStack(alignment: .leading, spacing: 4) {
                            RBLabel("DISTANCE")
                            Text("\(Units.fmtDist(dist, unit)) \(unit.rawValue)")
                                .font(.body.weight(.bold))
                                .foregroundStyle(.white)
                        }
                    }
                    if let pace = w.pace, !pace.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            RBLabel("TARGET PACE")
                            Text(Units.fmtPace(pace, unit))
                                .font(.body.weight(.bold))
                                .foregroundStyle(.white)
                        }
                    }
                    Spacer()
                    Text("Details ›")
                        .font(.body)
                        .foregroundStyle(RB.textMute)
                }
                .padding(.top, 14)
            }
            .padding(16)
        }
        .buttonStyle(.plain)
        .rbCard(highlighted: true)
    }

    // MARK: - Mode Toggle

    private var modeToggle: some View {
        HStack(spacing: 0) {
            modeButton("Month", .month)
            modeButton("Week", .week)
        }
        .background(RB.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func modeButton(_ label: String, _ m: Mode) -> some View {
        Button { mode = m } label: {
            Text(label)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(mode == m ? .white : RB.textMute)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(mode == m ? RB.surface2 : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .padding(3)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Week Section

    private var weekSection: some View {
        VStack(spacing: 10) {
            // Nav row
            HStack {
                Button { Task { await store.goToWeek(offset: -1) } } label: {
                    Image(systemName: "chevron.left")
                        .foregroundStyle(RB.textMute)
                }
                Spacer()
                Text("\(Week.fmtShortDate(store.weekMonday)) – \(Week.fmtShortDate(Week.addDays(store.weekMonday, 6)))")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                Spacer()
                Button { Task { await store.goToWeek(offset: 1) } } label: {
                    Image(systemName: "chevron.right")
                        .foregroundStyle(RB.textMute)
                }
            }
            .buttonStyle(.plain)

            // Day cards — only days with workouts
            let workoutDays = store.weekDates.filter { store.workoutsByDate[$0] != nil }

            if workoutDays.isEmpty && store.phase == .idle {
                Text("Your coach hasn't built your plan yet.")
                    .font(.footnote)
                    .foregroundStyle(RB.textMute)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 32)
            } else {
                ForEach(workoutDays, id: \.self) { date in
                    if let w = store.workoutsByDate[date] {
                        weekDayCard(date: date, workout: w)
                    }
                }
            }

            if case .error(let msg) = store.phase {
                Label(msg, systemImage: "wifi.exclamationmark")
                    .foregroundStyle(.red)
                    .font(.footnote)
            }
        }
    }

    private func weekDayCard(date: String, workout w: Workout) -> some View {
        let isToday = date == Week.todayISO()
        let isDone = w.status == "done"
        let dowIndex = store.weekDates.firstIndex(of: date) ?? 0
        let dow = Week.DOW[dowIndex].uppercased()
        let dayNum = String(Int(date.suffix(2)) ?? 0)

        return Button { selected = w } label: {
            HStack(spacing: 12) {
                // Day column
                VStack(spacing: 2) {
                    Text(dow)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(RB.textFaint)
                    Text(dayNum)
                        .font(.body.weight(.bold))
                        .foregroundStyle(isToday ? .white : RB.textMute)
                }
                .frame(width: 40)

                // Icon tile
                iconTile(type: w.type, size: 36, cornerRadius: 8)

                // Title + distance/pace
                VStack(alignment: .leading, spacing: 3) {
                    Text(w.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                    if let dist = w.dist {
                        Text("\(Units.fmtDist(dist, unit)) \(unit.rawValue) · \(Units.fmtPace(w.pace, unit))")
                            .font(.caption)
                            .foregroundStyle(RB.textMute)
                    }
                }

                Spacer()

                // Status indicator
                weekStatusIndicator(isDone: isDone)
            }
            .padding(12)
            .background(isDone ? RB.accent.opacity(0.10) : RB.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        isToday ? Color.white.opacity(0.7) : RB.line,
                        lineWidth: isToday ? 1.5 : 1
                    )
            )
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func weekStatusIndicator(isDone: Bool) -> some View {
        if isDone {
            ZStack {
                Circle()
                    .fill(RB.accent)
                    .frame(width: 22, height: 22)
                Image(systemName: "checkmark")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(RB.onAccent)
            }
        } else {
            Circle()
                .stroke(RB.line, lineWidth: 1.5)
                .frame(width: 22, height: 22)
        }
    }

    // MARK: - Month Section

    private var monthSection: some View {
        VStack(spacing: 12) {
            // Month nav row
            HStack {
                Button {
                    monthAnchor = Week.addMonths(Week.firstOfMonth(monthAnchor), -1)
                } label: {
                    Image(systemName: "chevron.left").foregroundStyle(RB.textMute)
                }
                Spacer()
                Text(Week.fmtMonthYear(monthAnchor))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                Spacer()
                Button {
                    monthAnchor = Week.addMonths(Week.firstOfMonth(monthAnchor), 1)
                } label: {
                    Image(systemName: "chevron.right").foregroundStyle(RB.textMute)
                }
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 4)

            // Calendar grid card
            VStack(spacing: 8) {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 4) {
                    // Weekday headers (Mon-first to match week math)
                    ForEach(0..<7, id: \.self) { i in
                        Text(["M", "T", "W", "T", "F", "S", "S"][i])
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(RB.textFaint)
                            .frame(maxWidth: .infinity)
                    }
                    // Day cells
                    ForEach(Week.monthGridDates(anchor: monthAnchor), id: \.self) { date in
                        monthDayCell(date: date)
                    }
                }
            }
            .padding(12)
            .rbCard()

            // Type legend
            typeLegend
        }
    }

    private func monthDayCell(date: String) -> some View {
        let currentMonth = Week.firstOfMonth(date) == Week.firstOfMonth(monthAnchor)
        let isToday = date == Week.todayISO()
        let workout = store.monthWorkouts[date]
        let dayNum = String(Int(date.suffix(2)) ?? 0)

        return Button {
            if let w = workout { selected = w }
        } label: {
            VStack(spacing: 3) {
                ZStack {
                    if isToday {
                        Circle()
                            .fill(Color.white)
                            .frame(width: 28, height: 28)
                    }
                    Text(dayNum)
                        .font(.caption.weight(isToday ? .bold : .regular))
                        .foregroundStyle(
                            isToday ? Color.black :
                            currentMonth ? Color.white : RB.textFaint
                        )
                }
                .frame(height: 28)

                // Workout type dot
                if let w = workout {
                    Circle()
                        .fill(TypeBadge.tint(for: w.type))
                        .frame(width: 4, height: 4)
                } else {
                    Color.clear.frame(width: 4, height: 4)
                }
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .disabled(workout == nil)
    }

    private var typeLegend: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 14) {
                legendItem("easy", "Easy")
                legendItem("long", "Long")
                legendItem("speed", "Intervals")
                legendItem("tempo", "Tempo")
            }
            HStack(spacing: 14) {
                legendItem("recovery", "Recovery")
                legendItem("cross", "Cross")
                legendItem("rest", "Rest")
            }
        }
    }

    private func legendItem(_ type: String, _ label: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: TypeBadge.symbol(for: type))
                .font(.caption2)
                .foregroundStyle(TypeBadge.tint(for: type))
            Text(label)
                .font(.caption)
                .foregroundStyle(RB.textMute)
        }
    }

    // MARK: - Shared Helpers

    private func iconTile(type: String, size: CGFloat, cornerRadius: CGFloat) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(RB.surface2)
                .frame(width: size, height: size)
            TypeBadge(type: type)
                .font(.body)
        }
    }

    /// Format mileage: always 1 decimal (e.g. "4.5", "28.0") to match reference.
    private func fmtMiles(_ v: Double) -> String {
        String(format: "%.1f", v)
    }
}
