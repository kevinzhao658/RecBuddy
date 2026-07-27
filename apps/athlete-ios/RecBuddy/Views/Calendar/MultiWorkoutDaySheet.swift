import SwiftUI

/// A day that holds several workouts, shown high-level: each workout's
/// prescription plus its logged progress at a glance. Tapping a row opens that
/// workout's full detail (and lets the athlete log it).
struct MultiWorkoutDaySheet: View {
    let date: String
    let workouts: [Workout]
    let store: PlanStore
    let unit: Unit
    @Environment(\.dismiss) private var dismiss
    @State private var selected: Workout?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                ForEach(workouts) { w in
                    Button { selected = w } label: { row(w) }
                        .buttonStyle(.plain)
                }
            }
            .padding(20)
        }
        .background(RB.bg.ignoresSafeArea())
        .sheet(item: $selected) { w in
            WorkoutDetailSheet(workout: w, store: store, unit: unit)
        }
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(Week.fmtDayDate(date))
                    .font(.caption)
                    .foregroundStyle(RB.textMute)
                Text("\(workouts.count) workouts")
                    .font(.title2.bold())
                    .foregroundStyle(.white)
            }
            Spacer()
            Button { dismiss() } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundStyle(RB.textFaint)
            }
            .buttonStyle(.plain)
        }
    }

    private func row(_ w: Workout) -> some View {
        let isDone = w.status == "done"
        let actual = store.actualsByWorkout[w.id]
        return HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(RB.surface2)
                    .frame(width: 44, height: 44)
                TypeBadge(type: w.type).font(.title3)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(w.title)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                if let dist = w.dist {
                    Text("\(Units.fmtDist(dist, unit)) \(unit.rawValue) · \(Units.fmtPace(w.pace, unit))")
                        .font(.caption)
                        .foregroundStyle(RB.textMute)
                }
                // Logged line when we have the athlete's actual for this workout.
                if isDone, let a = actual {
                    Text("Logged \(Units.fmtDist(a.dist, unit)) \(unit.rawValue) · \(a.time)")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(RB.accent)
                }
            }
            Spacer()
            statusPill(w.status)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .rbCard()
        .opacity(isDone ? 0.85 : 1)
    }

    @ViewBuilder
    private func statusPill(_ status: String) -> some View {
        switch status {
        case "done":
            Label("Done", systemImage: "checkmark.circle.fill")
                .labelStyle(.titleAndIcon)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(RB.accent)
        case "missed":
            Text("Missed")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.red)
        default:
            Text("Planned")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(RB.textFaint)
        }
    }
}
