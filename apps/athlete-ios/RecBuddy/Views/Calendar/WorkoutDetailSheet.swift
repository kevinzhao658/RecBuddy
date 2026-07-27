import SwiftUI

struct WorkoutDetailSheet: View {
    let workout: Workout
    let store: PlanStore
    let unit: Unit
    /// Pre-fetched actual for workouts outside the store's loaded week —
    /// the chat trace passes it so the logged-run section still renders.
    var fetchedActual: WorkoutActual? = nil
    @Environment(\.dismiss) private var dismiss
    @State private var logOpen = false
    @State private var busy = false
    @State private var error: String?

    private var live: Workout {
        store.workoutsByDate[workout.date]?.first { $0.id == workout.id } ?? workout
    }
    private var actual: WorkoutActual? { store.actualsByWorkout[workout.id] ?? fetchedActual }

    var body: some View {
        // NOTE: previously a ZStack with an ignoresSafeArea gradient overlay +
        // .presentationBackground — that combination drove an AttributeGraph
        // update cycle on iOS 17 (body re-evaluated forever; UI froze).
        // ScrollView + safeAreaInset is the idiomatic, cycle-free structure.
        ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Type chip + close button
                    HStack {
                        typeChip
                        Spacer()
                        closeButton
                    }

                    // Date + title
                    VStack(alignment: .leading, spacing: 6) {
                        Text(Week.fmtDayDate(live.date))
                            .font(.caption)
                            .foregroundStyle(RB.textMute)
                        Text(live.title)
                            .font(.largeTitle.bold())
                            .foregroundStyle(.white)
                    }

                    // Stat tiles
                    statTilesRow

                    // Workout structure
                    if !live.sets.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            RBLabel("WORKOUT STRUCTURE")
                            structureCard
                        }
                    }

                    // Coach's note (lighter option: text only with "Coach" caption)
                    if let note = live.note, !note.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            RBLabel("COACH'S NOTE")
                            noteCard(note)
                        }
                    }

                    // Logged run card
                    if let a = actual {
                        VStack(alignment: .leading, spacing: 8) {
                            RBLabel("YOUR LOGGED RUN")
                            loggedRunCard(a)
                        }
                    }

                    if let error {
                        Text(error).foregroundStyle(.red).font(.footnote)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 20)
        }
        .background(RB.bg.ignoresSafeArea())
        .safeAreaInset(edge: .bottom) {
            if live.type != "rest" {
                VStack(spacing: 10) {
                    if live.status == "done" {
                        // Edit in place — no unmark-and-relog needed to fix a note.
                        if actual != nil {
                            Button("Edit logged run") { logOpen = true }
                                .buttonStyle(VoltButtonStyle())
                                .disabled(busy)
                        }
                        Button("Mark as not done") { Task { await setStatus("planned") } }
                            .buttonStyle(VoltButtonStyle(prominent: false))
                            .disabled(busy)
                    } else if live.date <= Week.todayISO() {
                        // Completion goes THROUGH the log sheet — one clear entry
                        // point. Only today's and past workouts can be completed.
                        Button("✓ Mark as complete") { logOpen = true }
                            .buttonStyle(VoltButtonStyle())
                            .disabled(busy)
                    } else {
                        Text("Scheduled for \(Week.fmtDayDate(live.date)) — you can log it then.")
                            .font(.footnote)
                            .foregroundStyle(RB.textFaint)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 14)
                .background(RB.bg.opacity(0.96))
            }
        }
        .presentationDetents([.large])
        .sheet(isPresented: $logOpen) {
            // Done + actual present -> edit that log; otherwise a fresh completion.
            LogRunSheet(workout: live, store: store, unit: unit,
                        existing: live.status == "done" ? actual : nil)
        }
    }

    // MARK: - Type Chip

    private var typeChip: some View {
        HStack(spacing: 8) {
            Image(systemName: TypeBadge.symbol(for: live.type))
                .font(.caption.weight(.semibold))
                .foregroundStyle(TypeBadge.tint(for: live.type))
            Text(live.type.capitalized)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(RB.surface2)
        .clipShape(Capsule())
    }

    // MARK: - Close Button

    private var closeButton: some View {
        Button { dismiss() } label: {
            ZStack {
                Circle()
                    .fill(RB.surface2)
                    .frame(width: 32, height: 32)
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(RB.textMute)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Close")
    }

    // MARK: - Stat Tiles

    private var statTilesRow: some View {
        HStack(spacing: 10) {
            if let dist = live.dist {
                statTile(
                    label: "DISTANCE",
                    main: Units.fmtDist(dist, unit),
                    sub: unit.rawValue
                )
            }
            if let pace = live.pace, !pace.isEmpty {
                let formatted = Units.fmtPace(pace, unit)
                let (paceMain, paceSub) = splitPace(formatted)
                statTile(label: "TARGET PACE", main: paceMain, sub: paceSub)
            }
            let est = EstMinutes.compute(
                type: live.type, estMinutes: live.estMinutes,
                dist: live.dist, pace: live.pace, dur: live.dur)
            if est > 0 {
                statTile(label: "EST. TIME", main: "\(est)m", sub: "")
            }
        }
    }

    private func statTile(label: String, main: String, sub: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            RBLabel(label)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(main)
                    .font(.title.bold())
                    .foregroundStyle(.white)
                if !sub.isEmpty {
                    Text(sub)
                        .font(.footnote)
                        .foregroundStyle(RB.textMute)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .rbCard()
    }

    /// Split "7:30/mi" into ("7:30", "/mi").
    private func splitPace(_ formatted: String) -> (String, String) {
        if let slashIdx = formatted.firstIndex(of: "/") {
            return (String(formatted[..<slashIdx]),
                    "/" + String(formatted[formatted.index(after: slashIdx)...]))
        }
        return (formatted, "")
    }

    // MARK: - Workout Structure Card

    private var structureCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(live.sets.enumerated()), id: \.offset) { idx, pair in
                if idx > 0 {
                    Divider()
                        .overlay(RB.line)
                }
                HStack(spacing: 12) {
                    // Number chip
                    ZStack {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(RB.surface2)
                            .frame(width: 28, height: 28)
                        Text("\(idx + 1)")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.white)
                    }
                    VStack(alignment: .leading, spacing: 3) {
                        Text(pair.first ?? "")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white)
                        if pair.count > 1, !pair[1].isEmpty {
                            Text(pair[1])
                                .font(.caption)
                                .foregroundStyle(RB.textMute)
                        }
                    }
                }
                .padding(12)
            }
        }
        .rbCard()
    }

    // MARK: - Coach's Note Card

    private func noteCard(_ note: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Coach")
                .font(.caption.weight(.semibold))
                .foregroundStyle(RB.textMute)
            Text(note)
                .font(.body)
                .foregroundStyle(.white)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .rbCard()
    }

    // MARK: - Logged Run Card

    private func loggedRunCard(_ a: WorkoutActual) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 24) {
                loggedStat(label: "DISTANCE", value: "\(Units.fmtDist(a.dist, unit)) \(unit.rawValue)")
                loggedStat(label: "PACE", value: Units.fmtPace(a.pace, unit))
                loggedStat(label: "TIME", value: a.time)
                if let hr = a.hr {
                    loggedStat(label: "AVG HR", value: "\(hr)")
                }
            }
            if let note = a.note, !note.isEmpty {
                Text(note)
                    .font(.callout)
                    .foregroundStyle(RB.textMute)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .rbCard()
    }

    private func loggedStat(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            RBLabel(label)
            Text(value)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.white)
        }
    }

    // MARK: - Actions

    private func setStatus(_ status: String) async {
        busy = true; error = nil
        do { try await store.setStatus(live, to: status) }
        catch { self.error = "Couldn't update — try again." }
        busy = false
    }
}
