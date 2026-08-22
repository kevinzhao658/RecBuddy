import SwiftUI

struct CalendarView: View {
    let profile: Profile
    @Environment(SessionStore.self) private var session
    @Environment(HealthSyncService.self) private var health
    @State private var store = PlanStore()
    @State private var selected: Workout?
    @State private var selectedExtra: WorkoutActual?
    @State private var accountOpen = false
    @State private var confirmOpen = false
    // Which volume the weekly mileage gauge shows (chip only appears when the
    // week has any cross volume).
    @State private var showCrossMileage = false
    // The week strip's selected day (today when the week contains it).
    @State private var selectedDate: String = Week.todayISO()
    // Drives the sync badge's arrow rotation while a pass runs.
    @State private var syncSpin = false
    @AppStorage("unit") private var unitRaw = "mi"
    private var unit: Unit { Unit(rawValue: unitRaw) ?? .mi }

    enum Mode { case month, week }
    @State private var mode: Mode = .week
    @State private var monthAnchor: String = Week.todayISO()

    // The headliner shows the SELECTED day (today by default) — the week
    // columns pilot it. selectedDate is always inside the displayed week.
    private var todayWorkouts: [Workout] {
        (store.workoutsByDate[selectedDate] ?? [])
            .filter { $0.type != "rest" && $0.status != "rest" }
    }

    private var todayExtras: [WorkoutActual] {
        store.standaloneByDate[selectedDate] ?? []
    }

    // Today's stack order: still-to-do workouts first (in plan order), completed
    // ones sink to the bottom.
    private var uncompletedToday: [Workout] { todayWorkouts.filter { $0.status != "done" } }
    private var orderedToday: [Workout] { uncompletedToday + todayWorkouts.filter { $0.status == "done" } }


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

                    if !health.state.pending.isEmpty {
                        Button { confirmOpen = true } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "heart.text.square.fill").foregroundStyle(RB.accent)
                                Text("\(health.state.pending.count) \(health.state.pending.count == 1 ? "activity" : "activities") to confirm")
                                    .font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                                Spacer()
                                Image(systemName: "chevron.right").font(.caption).foregroundStyle(RB.textFaint)
                            }
                            .padding(14)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .rbCard(highlighted: true)
                    }

                    // Always present — an unplanned week just reads zero.
                    mileageBlock

                    // Headliner: the selected day's activities as a to-do
                    // list — one row per activity, key figure emphasized.
                    headlinerSection

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
        .sheet(item: $selected) { w in
            WorkoutDetailSheet(workout: w, store: store, unit: unit)
        }
        .sheet(item: $selectedExtra) { a in
            ExtraActivitySheet(actual: a, store: store, unit: unit)
        }
        .sheet(isPresented: $accountOpen) {
            AccountSheet(profile: profile, plan: store.plan)
        }
        .sheet(isPresented: $confirmOpen) {
            ConfirmActivitySheet(store: store, unit: unit)
        }
        .onChange(of: store.weekMonday) { _, _ in
            selectedDate = WeekStripLogic.defaultSelection(weekDates: store.weekDates,
                                                           today: Week.todayISO())
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
                // The screen title IS the selected day — it follows the
                // week strip / month grid selection.
                Text(Week.fmtWeekday(selectedDate))
                    .font(.largeTitle.bold())
                    .foregroundStyle(.white)
                Text(Week.fmtFullDate(selectedDate))
                    .font(.subheadline)
                    .foregroundStyle(RB.textMute)
            }
            Spacer()
            if health.state.connected {
                healthSyncBadge
            }
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

    /// Apple Health sync badge beside the profile icon. Synced = arrows with a
    /// checkmark in the open center. Tapping it (or pull-to-refresh — both run
    /// the same pass) hides the check and spins the arrows until the sync
    /// completes, which reveals the checkmark again. Hidden until Health is
    /// connected so non-Health users never see it.
    private var healthSyncBadge: some View {
        Button {
            Task {
                await health.syncNow(athleteId: profile.id)
                await store.refresh()
            }
        } label: {
            ZStack {
                Circle()
                    .fill(RB.surface2)
                    .frame(width: 40, height: 40)
                Image(systemName: "arrow.triangle.2.circlepath")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(health.isSyncing || health.state.lastSync != nil ? RB.accent : RB.textMute)
                    .rotationEffect(.degrees(syncSpin ? 360 : 0))
                // The check lives in the arrows' open center once synced;
                // it disappears while a pass runs and pops back on completion.
                if !health.isSyncing, health.state.lastSync != nil {
                    Image(systemName: "checkmark")
                        .font(.system(size: 8, weight: .heavy))
                        .foregroundStyle(RB.accent)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(health.isSyncing)
        .accessibilityLabel(syncBadgeLabel)
        .animation(.spring(response: 0.28, dampingFraction: 0.7), value: health.isSyncing)
        .onChange(of: health.isSyncing) { _, syncing in
            if syncing {
                withAnimation(.linear(duration: 0.8).repeatForever(autoreverses: false)) { syncSpin = true }
            } else {
                withAnimation(.easeOut(duration: 0.2)) { syncSpin = false }
            }
        }
    }

    /// "Apple Health synced 5 min. ago" — the badge's VoiceOver + long-press label.
    private var syncBadgeLabel: String {
        guard let last = health.state.lastSync else { return "Sync Apple Health" }
        let rel = RelativeDateTimeFormatter()
        rel.unitsStyle = .abbreviated
        return "Apple Health synced \(rel.localizedString(for: last, relativeTo: Date()))"
    }

    // MARK: - Weekly Mileage Block

    private var mileageBlock: some View {
        // Run and cross volumes never mix — the chip swaps which one the gauge
        // shows. Pure runners never see the chip (zero added chrome). Cross is
        // DONE-ONLY (no projected total — the athlete picks the sport): an
        // icon + total per sport, all in the standard accent, mirroring the
        // coach's cross mileage row. Swims read in meters.
        let cross = showCrossMileage && store.weekHasCrossVolume
        let planned = store.weekPlannedRunMiles
        let done = store.weekDoneRunMiles
        return VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                RBLabel("WEEKLY MILEAGE")
                if store.weekHasCrossVolume {
                    mileageModeToggle
                }
                Spacer()
                if !cross {
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(fmtMiles(done))
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(RB.accent)
                        Text("/ \(fmtMiles(planned)) mi")
                            .font(.subheadline)
                            .foregroundStyle(RB.textMute)
                    }
                }
            }
            if cross {
                let s = store.weekCrossDoneBySport
                if s.ride > 0 || s.swim > 0 || s.run > 0 {
                    HStack(spacing: 16) {
                        if s.ride > 0 { crossTotal("bicycle", "\(fmtMiles(s.ride)) mi") }
                        if s.swim > 0 { crossTotal("figure.pool.swim", SportMetrics.metersText(miles: s.swim)) }
                        if s.run > 0 { crossTotal("figure.run", "\(fmtMiles(s.run)) mi") }
                    }
                } else {
                    Text("No cross logged yet")
                        .font(.caption)
                        .foregroundStyle(RB.textFaint)
                }
            } else {
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(RB.surface2)
                        let frac = planned > 0 ? min(done / planned, 1.0) : 0.0
                        Capsule()
                            .fill(RB.accent)
                            .frame(width: proxy.size.width * CGFloat(frac))
                    }
                }
                .frame(height: 6)
                if planned > 0 {
                    Text("\(fmtMiles(max(planned - done, 0))) mi to go this week")
                        .font(.caption)
                        .foregroundStyle(RB.textFaint)
                } else {
                    // Done volume with nothing planned (e.g. off-plan extras only).
                    Text("No runs planned this week")
                        .font(.caption)
                        .foregroundStyle(RB.textFaint)
                }
            }
        }
    }

    /// Icon + distance for one cross sport — sized so all three fit one line.
    private func crossTotal(_ symbol: String, _ text: String) -> some View {
        HStack(spacing: 5) {
            Image(systemName: symbol)
                .font(.caption.weight(.semibold))
                .foregroundStyle(RB.accent)
            Text(text)
                .font(.footnote.weight(.bold))
                .foregroundStyle(.white)
                .lineLimit(1)
        }
        .fixedSize(horizontal: true, vertical: false)
    }

    /// Tiny Run/Cross swap beside the gauge label.
    private var mileageModeToggle: some View {
        HStack(spacing: 2) {
            mileageChip("Run", isCross: false)
            mileageChip("Cross", isCross: true)
        }
        .padding(2)
        .background(RB.surface2)
        .clipShape(Capsule())
    }

    private func mileageChip(_ label: String, isCross: Bool) -> some View {
        let selected = showCrossMileage == isCross
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { showCrossMileage = isCross }
        } label: {
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(selected ? RB.accent : RB.textFaint)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(selected ? RB.accent.opacity(0.12) : .clear)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(label) mileage")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    // MARK: - TODAY Headliner Stack

    /// The headliner deck (verbatim), overlaid with the Today chip when
    /// the athlete has navigated off today. An empty/rest selected day shows
    /// a quiet placeholder card instead of nothing.
    private var headlinerSection: some View {
        ZStack(alignment: .topTrailing) {
            if !orderedToday.isEmpty || !todayExtras.isEmpty {
                dayRowsPanel
            } else {
                emptyDayCard
            }
            if selectedDate != Week.todayISO() {
                todayChip
                    .offset(x: -6, y: -9)
                    .zIndex(10)
            }
        }
    }

    /// The selected day as a to-do list: one CARD per activity (to-dos first,
    /// completed sink and fade), extras appended — distinct items with air
    /// between them. Each row: type tile, title, a quiet key-figure subtitle
    /// (distance · pace for runs, total time for cross/other, logged actuals
    /// once done), and the bubble/checkmark status on the right. Tapping a
    /// row opens the detail sheet.
    private var dayRowsPanel: some View {
        VStack(spacing: 8) {
            ForEach(orderedToday, id: \.id) { w in
                workoutRow(w)
            }
            ForEach(todayExtras, id: \.id) { a in
                extraRow(a)
            }
        }
    }

    private func workoutRow(_ w: Workout) -> some View {
        let isDone = w.status == "done"
        return Button { selected = w } label: {
            HStack(spacing: 12) {
                iconTile(type: w.type, size: 38, cornerRadius: 10)
                VStack(alignment: .leading, spacing: 3) {
                    Text(w.title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    if let sub = rowSubtitle(w) {
                        Text(sub)
                            .font(.footnote)
                            .foregroundStyle(RB.textMute)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 8)
                statusMark(done: isDone)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 16)
            .background(RB.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            // Today's activities carry a white outline — other days' rows
            // stay on the quiet hairline. (White = today, accent = selection.)
            .overlay(RoundedRectangle(cornerRadius: 16)
                .stroke(selectedDate == Week.todayISO() ? Color.white.opacity(0.7) : RB.line,
                        lineWidth: selectedDate == Week.todayISO() ? 1.5 : 1))
            .contentShape(Rectangle())
            .opacity(isDone ? 0.6 : 1)
        }
        .buttonStyle(.plain)
    }

    /// The row's completion affordance: an empty bubble while pending; a
    /// filled accent checkmark once done. No labels — the bubble IS the state.
    private func statusMark(done: Bool) -> some View {
        Group {
            if done {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(RB.accent)
            } else {
                Circle()
                    .stroke(RB.textFaint, lineWidth: 1.5)
                    .frame(width: 19, height: 19)
            }
        }
        // Fixed width keeps every bubble on the same center line.
        .frame(width: 24)
        .accessibilityLabel(done ? "Completed" : "To do")
    }

    private func extraRow(_ a: WorkoutActual) -> some View {
        Button { selectedExtra = a } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(RB.surface2)
                        .frame(width: 38, height: 38)
                    Image(systemName: a.activitySymbol)
                        .font(.subheadline)
                        .foregroundStyle(RB.accent)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(a.extraTitle)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text("\(a.distDisplay(unit: unit)) · \(a.time)")
                        .font(.footnote)
                        .foregroundStyle(RB.textMute)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                statusMark(done: true)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 16)
            .background(RB.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            // Today's activities carry a white outline — other days' rows
            // stay on the quiet hairline. (White = today, accent = selection.)
            .overlay(RoundedRectangle(cornerRadius: 16)
                .stroke(selectedDate == Week.todayISO() ? Color.white.opacity(0.7) : RB.line,
                        lineWidth: selectedDate == Week.todayISO() ? 1.5 : 1))
            .contentShape(Rectangle())
            .opacity(0.6)
        }
        .buttonStyle(.plain)
    }

    /// The row's key figure. Logged results win (sport-aware: meters for
    /// swims, elapsed time when there's no pace); otherwise the prescription —
    /// distance · pace for runs, apostrophe minutes for time-based types.
    private func rowSubtitle(_ w: Workout) -> String? {
        if w.status == "done", let a = store.actualsByWorkout[w.id] {
            if let pace = a.pace {
                return "\(a.distDisplay(unit: unit)) · \(Units.fmtPace(pace, unit))"
            }
            return "\(a.distDisplay(unit: unit)) · \(a.time)"
        }
        if w.type == "cross" || w.type == "other" {
            let mins = EstMinutes.compute(type: w.type, estMinutes: w.estMinutes,
                                          dist: nil, pace: nil, dur: w.dur)
            return mins > 0 ? "\(mins)' total" : nil
        }
        if let d = w.dist {
            var sub = "\(Units.fmtDist(d, unit)) \(unit.rawValue)"
            if let p = w.pace, !p.isEmpty { sub += " · \(Units.fmtPace(p, unit))" }
            return sub
        }
        if let mins = w.estMinutes ?? w.dur { return "\(mins)' total" }
        return nil
    }

    /// Unified day selection — the headliner follows, the week navigates
    /// beneath when the picked day lives outside the loaded week, and the
    /// month grid re-centers when the pick crosses months. Shared by the week
    /// strip, the month grid, and the Today chip.
    private func pickDay(_ date: String) {
        if mode == .month, Week.firstOfMonth(date) != Week.firstOfMonth(monthAnchor) {
            monthAnchor = date
        }
        if store.weekDates.contains(date) {
            withAnimation(.spring(response: 0.34, dampingFraction: 0.82)) {
                selectedDate = date
            }
        } else {
            Task {
                store.weekMonday = Week.mondayOf(date)
                await store.refresh()
                selectedDate = date
            }
        }
    }

    private var todayChip: some View {
        Button {
            pickDay(Week.todayISO())
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "arrow.uturn.left")
                    .font(.system(size: 9, weight: .bold))
                Text("Today")
                    .font(.caption2.weight(.bold))
            }
            .foregroundStyle(RB.bg)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(RB.accent)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Back to today")
    }

    private var emptyDayCard: some View {
        let rest = WeekStripLogic.isRestOnly(workouts: store.workoutsByDate[selectedDate] ?? [],
                                             extras: todayExtras)
        return VStack(spacing: 6) {
            Image(systemName: rest ? TypeBadge.symbol(for: "rest") : "calendar")
                .foregroundStyle(RB.textFaint)
            Text(rest ? "Rest day" : "Nothing scheduled")
                .font(.footnote)
                .foregroundStyle(RB.textMute)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .background(RB.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(RB.line, lineWidth: 1))
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
        Button {
            // Month opens centered on the week view's selected day — the two
            // views share one selection.
            if m == .month { monthAnchor = selectedDate }
            mode = m
        } label: {
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

            let weekIsEmpty = store.weekDates.allSatisfy {
                (store.workoutsByDate[$0] ?? []).isEmpty && (store.standaloneByDate[$0] ?? []).isEmpty
            }

            if weekIsEmpty && store.phase == .loading {
                ForEach(0..<2, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 16)
                        .fill(RB.surface)
                        .frame(height: 64)
                        .redacted(reason: .placeholder)
                }
            } else {
                WeekGlanceStrip(
                    dates: store.weekDates,
                    selected: selectedDate,
                    today: Week.todayISO(),
                    pairsFor: { date in
                        WeekStripLogic.pairs(workouts: store.workoutsByDate[date] ?? [],
                                             extras: store.standaloneByDate[date] ?? [],
                                             unit: unit)
                    },
                    restFor: { date in
                        WeekStripLogic.isRestOnly(workouts: store.workoutsByDate[date] ?? [],
                                                  extras: store.standaloneByDate[date] ?? [])
                    },
                    onPick: { date in pickDay(date) },
                    onSwipeWeek: { offset in
                        Task { await store.goToWeek(offset: offset) }
                    }
                )
                if weekIsEmpty && store.phase == .idle {
                    Text("Your coach hasn't built your plan yet.")
                        .font(.footnote)
                        .foregroundStyle(RB.textMute)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 16)
                }
            }

            if case .error(let msg) = store.phase {
                Label(msg, systemImage: "wifi.exclamationmark")
                    .foregroundStyle(.red)
                    .font(.footnote)
            }
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
        let isSelected = date == selectedDate
        let workouts = store.monthWorkouts[date] ?? []
        let dayNum = String(Int(date.suffix(2)) ?? 0)

        return Button {
            // Selecting a month day pilots the headliner — same model as the
            // week strip (navigating the week under the hood when needed).
            pickDay(date)
        } label: {
            VStack(spacing: 3) {
                ZStack {
                    if isToday {
                        Circle()
                            .fill(Color.white)
                            .frame(width: 28, height: 28)
                    } else if isSelected {
                        Circle()
                            .stroke(RB.accent, lineWidth: 1.5)
                            .frame(width: 28, height: 28)
                    }
                    Text(dayNum)
                        .font(.caption.weight(isToday || isSelected ? .bold : .regular))
                        .foregroundStyle(
                            isToday ? Color.black :
                            isSelected ? RB.accent :
                            currentMonth ? Color.white : RB.textFaint
                        )
                }
                .frame(height: 28)

                // One dot per workout in accent (a checkmark once done),
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
