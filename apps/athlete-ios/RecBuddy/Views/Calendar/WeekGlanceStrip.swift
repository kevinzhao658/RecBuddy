import SwiftUI

/// The glanceable week: seven day columns, each stacking icon + number pairs
/// for its activities (intensity-tinted type icons; distances in the
/// athlete's unit, time targets as 45'). Past columns fade; today's date is
/// accent; the selected column carries the ring and pilots the headliner.
/// Horizontal drag switches weeks.
struct WeekGlanceStrip: View {
    let dates: [String]                    // Mon..Sun ISO days
    let selected: String
    let today: String
    let pairsFor: (String) -> [GlancePair]
    let restFor: (String) -> Bool
    let onPick: (String) -> Void
    let onSwipeWeek: (Int) -> Void         // ±1

    var body: some View {
        // fixedSize(vertical) makes every swimlane adopt the tallest column's
        // height, so lanes read as one even row regardless of workload.
        HStack(alignment: .top, spacing: 5) {
            ForEach(Array(dates.enumerated()), id: \.element) { i, date in
                column(date: date, dow: Week.DOW[i].uppercased())
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .gesture(
            DragGesture(minimumDistance: 24)
                .onEnded { g in
                    guard abs(g.translation.width) > 60,
                          abs(g.translation.width) > abs(g.translation.height) else { return }
                    onSwipeWeek(g.translation.width < 0 ? 1 : -1)
                }
        )
    }

    /// One column = a fixed-size DATE BOX up top, then the day's icons floating
    /// free beneath it, all sitting on a faint full-height swimlane. The box is
    /// where selection state lives (accent ring, brighter fill); the lane only
    /// whispers the column boundary.
    private func column(date: String, dow: String) -> some View {
        let isSelected = date == selected
        let isToday = date == today
        let isPast = date < today                       // ISO strings sort correctly
        let pairs = pairsFor(date)
        return Button { onPick(date) } label: {
            VStack(spacing: 12) {                       // clear air: date box ↔ icons
                // Date header — its own box, identical size on every column.
                VStack(spacing: 1) {
                    Text(dow)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(RB.textFaint)
                    Text(String(Int(date.suffix(2)) ?? 0))
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(isToday ? RB.accent : isSelected ? .white : RB.textMute)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(isSelected ? RB.surface2 : RB.surface)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10)
                    .stroke(isSelected ? RB.accent : RB.line, lineWidth: isSelected ? 1.5 : 1))

                // Icons — outside the box, breathing on the lane. Capped at 5
                // pairs; anything beyond collapses to "+N".
                VStack(spacing: 9) {
                    if restFor(date) {
                        Image(systemName: TypeBadge.symbol(for: "rest"))
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(RB.textFaint)
                    } else {
                        let capped = WeekStripLogic.capped(pairs)
                        ForEach(Array(capped.shown.enumerated()), id: \.offset) { _, pair in
                            pairView(pair)
                        }
                        if capped.overflow > 0 {
                            Text("+\(capped.overflow)")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(RB.textFaint)
                        }
                    }
                }
                .opacity(isPast ? 0.45 : 1)

                Spacer(minLength: 0)                    // lanes stretch to one height
            }
            .padding(.top, 3)
            .padding(.bottom, 8)
            .padding(.horizontal, 3)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(RoundedRectangle(cornerRadius: 12)
                .fill(RB.surface.opacity(isSelected ? 0.6 : 0.35)))  // light swimlane
            .opacity(isPast ? 0.55 : 1)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(dow) \(Week.fmtShortDate(date))")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    @ViewBuilder
    private func pairView(_ pair: GlancePair) -> some View {
        VStack(spacing: 1) {
            switch pair.icon {
            case .type(let t):
                Image(systemName: TypeBadge.symbol(for: t))
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(TypeBadge.tint(for: t))
            case .sport(let s):
                Image(systemName: s == "ride" ? "bicycle"
                    : s == "swim" ? "figure.pool.swim" : "figure.run")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.green)
            }
            if let text = pair.text {
                Text(text)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(RB.textMute)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
    }
}
