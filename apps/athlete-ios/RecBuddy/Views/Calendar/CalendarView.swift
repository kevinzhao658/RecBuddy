import SwiftUI

/// A day's worth of workouts, keyed by date — lets `.sheet(item:)` present the
/// multi-workout day sheet.
private struct DayWorkouts: Identifiable {
    let id: String   // the date, 'YYYY-MM-DD'
    let workouts: [Workout]
}

struct CalendarView: View {
    let profile: Profile
    @Environment(SessionStore.self) private var session
    @Environment(HealthSyncService.self) private var health
    @State private var store = PlanStore()
    @State private var selected: Workout?
    @State private var accountOpen = false
    // Which of today's workouts sits on top of the headliner stack. nil =
    // fall back to the first unfinished (the natural "up next").
    @State private var activeTodayId: String?
    // A month day with 2+ workouts opens this high-level sheet instead of a
    // single workout's detail.
    @State private var multiDay: DayWorkouts?
    @AppStorage("unit") private var unitRaw = "mi"
    private var unit: Unit { Unit(rawValue: unitRaw) ?? .mi }

    enum Mode { case month, week }
    @State private var mode: Mode = .week
    @State private var monthAnchor: String = Week.todayISO()

    // Today's workouts only when today falls in the currently displayed week.
    private var todayWorkouts: [Workout] {
        let today = Week.todayISO()
        guard store.weekDates.contains(today) else { return [] }
        return store.workoutsByDate[today] ?? []
    }

    // Today's stack order: still-to-do workouts first (in plan order), completed
    // ones sink to the bottom.
    private var uncompletedToday: [Workout] { todayWorkouts.filter { $0.status != "done" } }
    private var orderedToday: [Workout] { uncompletedToday + todayWorkouts.filter { $0.status == "done" } }

    // The workout shown full in the headliner: whichever the athlete floated up
    // (done or not), else the first unfinished, else the first. Only this top
    // card opens details — tabs just reorder the stack.
    private var activeToday: Workout? {
        todayWorkouts.first(where: { $0.id == activeTodayId })
            ?? uncompletedToday.first
            ?? orderedToday.first
    }

    // Drives the stack's reflow animation: changes when a card is floated up or a
    // workout is completed (which reorders + re-highlights).
    private var todayStackKey: String {
        (activeTodayId ?? "") + orderedToday.map { "\($0.id):\($0.status)" }.joined()
    }

    // Signature of today's completed workouts; grows when one is finished, which
    // drives the auto-advance in .onChange.
    private var doneTodayKey: String {
        todayWorkouts.filter { $0.status == "done" }.map(\.id).joined()
    }

    var body: some View {
        ZStack {
            RB.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    headerRow
                        .padding(.top, 12)

                    // Coachless (e.g. removed from a roster): the plan stays
                    // theirs — offer the re-attach path (Settings → Coaches).
                    if session.hasCoach == false {
                        noCoachBanner
                    }

                    if store.weekPlannedMiles > 0 {
                        mileageBlock
                    }

                    // Headliner: the active workout shows full; the day's other
                    // workouts tuck behind it as tappable slivers (icon + name).
                    todayStack

                    modeToggle

                    if mode == .week {
                        weekSection
                    } else {
                        monthSection
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 56) // clears the tab bar so the month legend is fully visible
            }
            .refreshable {
                await health.syncNow(athleteId: profile.id)
                await store.refresh()
            }
        }
        .task {
            health.startObservingIfNeeded(athleteId: profile.id)
            await health.syncNow(athleteId: profile.id)
            await store.refresh()
        }
        .task(id: monthAnchor) { await store.loadMonth(anchor: monthAnchor) }
        .onChange(of: doneTodayKey) { _, _ in
            // A workout was just completed — if it was the one on top, advance the
            // headliner to the next uncompleted by dropping the manual pick.
            if let id = activeTodayId, todayWorkouts.first(where: { $0.id == id })?.status == "done" {
                activeTodayId = nil
            }
        }
        .sheet(item: $selected) { w in
            WorkoutDetailSheet(workout: w, store: store, unit: unit)
        }
        .sheet(item: $multiDay) { day in
            MultiWorkoutDaySheet(date: day.id, workouts: day.workouts, store: store, unit: unit)
        }
        .sheet(isPresented: $accountOpen) {
            AccountSheet(profile: profile, plan: store.plan)
        }
    }

    // MARK: - Header

    /// WEEK x OF y derived from the training block (start -> race) and the week
    /// on screen; falls back to the stored counters when no start date is set.
    private func weekLabel(_ plan: Plan) -> String {
        if let start = plan.startDate, let goal = plan.goalDate {
            let total = Week.blockWeeks(start: start, goal: goal)
            let w = Week.blockWeek(monday: store.weekMonday, start: start)
            if w < 1 { return "STARTS \(Week.fmtShortDate(start).uppercased())" }
            return "WEEK \(min(w, total)) OF \(total)"
        }
        return "WEEK \(plan.planWeek) OF \(plan.planWeeks)"
    }

    /// Quiet banner shown when no coach is linked: the plan is theirs to keep;
    /// adding a coach (Settings → Coaches, invite code) restores adjustments.
    private var noCoachBanner: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "person.crop.circle.badge.questionmark")
                .font(.system(size: 18))
                .foregroundStyle(RB.accent)
            VStack(alignment: .leading, spacing: 4) {
                Text("You're not connected to a coach")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                Text("Your plan is yours to keep. Add a coach with an invite code to get adjustments again.")
                    .font(.caption)
                    .foregroundStyle(RB.textMute)
                Button("Add a coach") { accountOpen = true }
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(RB.accent)
                    .padding(.top, 2)
            }
            Spacer()
        }
        .padding(14)
        .rbCard()
    }

    private var headerRow: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                if let plan = store.plan {
                    RBLabel(weekLabel(plan), color: RB.accent)
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
                    // Profile photo when set (cache-busted URL), else initials
                    if let url = profile.avatarUrl.flatMap(URL.init(string:)) {
                        AsyncImage(url: url) { image in
                            image.resizable().scaledToFill()
                        } placeholder: {
                            Text(profile.initials)
                                .font(.callout.weight(.semibold))
                                .foregroundStyle(.white)
                        }
                        .frame(width: 40, height: 40)
                        .clipShape(Circle())
                    } else {
                        Text(profile.initials)
                            .font(.callout.weight(.semibold))
                            .foregroundStyle(.white)
                    }
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

    // MARK: - TODAY Headliner Stack

    /// A day with several workouts reads as a deck: the active one is the full
    /// hero card, the rest peek beneath as slivers you can tap to bring forward.
    /// A single-workout day is just the hero, unchanged.
    @ViewBuilder
    private var todayStack: some View {
        if let active = activeToday {
            let behind = orderedToday.filter { $0.id != active.id }
            VStack(spacing: 0) {
                todayHeroCard(active)
                    .zIndex(Double(behind.count + 1))
                // Each tab tucks a little further under the card above it (same
                // width — like the coach view), leaving just a strip showing.
                ForEach(Array(behind.enumerated()), id: \.element.id) { i, w in
                    todaySliver(w)
                        .padding(.top, i == 0 ? -12 : -16)
                        .zIndex(Double(behind.count - i))
                }
            }
            .animation(.spring(response: 0.34, dampingFraction: 0.82), value: todayStackKey)
        }
    }

    /// A tab behind the headliner — squared top (it slides under the card above)
    /// and a rounded bottom edge, so it reads as a drawer rather than a pill.
    /// Tapping any tab (done or not) floats it to the top; only the top card
    /// opens details. Completed tabs are faded and marked done.
    private func todaySliver(_ w: Workout) -> some View {
        let isDone = w.status == "done"
        // Flat top, rounded bottom = the "poking out from under the card" look.
        let tab = UnevenRoundedRectangle(topLeadingRadius: 0, bottomLeadingRadius: 16,
                                         bottomTrailingRadius: 16, topTrailingRadius: 0)
        return Button {
            withAnimation(.spring(response: 0.34, dampingFraction: 0.82)) { activeTodayId = w.id }
        } label: {
            HStack(spacing: 12) {
                iconTile(type: w.type, size: 30, cornerRadius: 8)
                Text(w.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Spacer()
                if isDone {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                        Text("Completed")
                    }
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(RB.accent)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                } else {
                    Text("To Do")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(RB.textMute)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 18) // content sits low, in the strip below the card
            .padding(.bottom, 11)
            .frame(maxWidth: .infinity)
            .background(RB.surface2, in: tab)
            .overlay(tab.stroke(RB.line, lineWidth: 1))
            .opacity(isDone ? 0.55 : 1)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - TODAY Hero Card

    private func todayHeroCard(_ w: Workout) -> some View {
        // A completed workout on top shows what was actually logged, not the plan.
        let actual = w.status == "done" ? store.actualsByWorkout[w.id] : nil
        return Button { selected = w } label: {
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

                // Bottom: stats + completion status (To Do / Completed). Once
                // logged, distance/pace reflect the actual run, not the plan.
                HStack(alignment: .top, spacing: 20) {
                    if let dist = actual?.dist ?? w.dist {
                        VStack(alignment: .leading, spacing: 4) {
                            RBLabel(actual != nil ? "LOGGED DIST" : "DISTANCE")
                            Text("\(Units.fmtDist(dist, unit)) \(unit.rawValue)")
                                .font(.body.weight(.bold))
                                .foregroundStyle(.white)
                        }
                    }
                    if let pace = actual?.pace ?? w.pace, !pace.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            RBLabel(actual != nil ? "AVG PACE" : "TARGET PACE")
                            Text(Units.fmtPace(pace, unit))
                                .font(.body.weight(.bold))
                                .foregroundStyle(.white)
                        }
                    }
                    Spacer()
                    if w.status == "done" {
                        Label("Completed", systemImage: "checkmark.circle.fill")
                            .labelStyle(.titleAndIcon)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(RB.accent)
                            .lineLimit(1)
                            .fixedSize(horizontal: true, vertical: false)
                    } else {
                        Text("To Do")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(RB.textMute)
                            .lineLimit(1)
                            .fixedSize(horizontal: true, vertical: false)
                    }
                }
                .padding(.top, 14)
            }
            .padding(16)
            .contentShape(Rectangle()) // whole card tappable, not just drawn pixels
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
                .contentShape(Rectangle()) // inactive segment (clear bg) stays tappable
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
                        .frame(width: 44, height: 44) // forgiving hit target
                        .contentShape(Rectangle())
                }
                Spacer()
                Text("\(Week.fmtShortDate(store.weekMonday)) – \(Week.fmtShortDate(Week.addDays(store.weekMonday, 6)))")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                Spacer()
                Button { Task { await store.goToWeek(offset: 1) } } label: {
                    Image(systemName: "chevron.right")
                        .foregroundStyle(RB.textMute)
                        .frame(width: 44, height: 44) // forgiving hit target
                        .contentShape(Rectangle())
                }
            }
            .buttonStyle(.plain)

            // Day cards — only days with workouts
            let workoutDays = store.weekDates.filter { !(store.workoutsByDate[$0] ?? []).isEmpty }

            if workoutDays.isEmpty && store.phase == .loading {
                // First-load skeleton rows
                ForEach(0..<4, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 16)
                        .fill(RB.surface)
                        .frame(height: 64)
                        .redacted(reason: .placeholder)
                }
            } else if workoutDays.isEmpty && store.phase == .idle {
                Text("Your coach hasn't built your plan yet.")
                    .font(.footnote)
                    .foregroundStyle(RB.textMute)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 32)
            } else {
                ForEach(workoutDays, id: \.self) { date in
                    // A day can hold several workouts — one card each.
                    ForEach(store.workoutsByDate[date] ?? [], id: \.id) { w in
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
        // Once logged, the card carries the actual run's distance/pace.
        let actual = isDone ? store.actualsByWorkout[w.id] : nil
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
                    if let dist = actual?.dist ?? w.dist {
                        Text("\(Units.fmtDist(dist, unit)) \(unit.rawValue) · \(Units.fmtPace(actual?.pace ?? w.pace, unit))")
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
                    Image(systemName: "chevron.left").foregroundStyle(RB.textMute).frame(width: 44, height: 44).contentShape(Rectangle())
                }
                Spacer()
                Text(Week.fmtMonthYear(monthAnchor))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                Spacer()
                Button {
                    monthAnchor = Week.addMonths(Week.firstOfMonth(monthAnchor), 1)
                } label: {
                    Image(systemName: "chevron.right").foregroundStyle(RB.textMute).frame(width: 44, height: 44).contentShape(Rectangle())
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
        let workouts = store.monthWorkouts[date] ?? []
        let dayNum = String(Int(date.suffix(2)) ?? 0)

        return Button {
            // 2+ workouts open the high-level day sheet; a lone one goes straight
            // to its detail.
            if workouts.count > 1 {
                multiDay = DayWorkouts(id: date, workouts: workouts)
            } else if let w = workouts.first {
                selected = w
            }
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

                // One dot per workout, tinted by type (a checkmark once done),
                // up to three, then "+N".
                if !workouts.isEmpty {
                    HStack(spacing: 3) {
                        ForEach(workouts.prefix(3)) { w in
                            if w.status == "done" {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 7, weight: .bold))
                                    .foregroundStyle(TypeBadge.tint(for: w.type))
                            } else {
                                Circle()
                                    .fill(TypeBadge.tint(for: w.type))
                                    .frame(width: 5, height: 5)
                            }
                        }
                        if workouts.count > 3 {
                            Text("+\(workouts.count - 3)")
                                .font(.system(size: 8))
                                .foregroundStyle(RB.textFaint)
                        }
                    }
                    .frame(height: 6)
                } else {
                    Color.clear.frame(width: 4, height: 4)
                }
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .disabled(workouts.isEmpty)
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
