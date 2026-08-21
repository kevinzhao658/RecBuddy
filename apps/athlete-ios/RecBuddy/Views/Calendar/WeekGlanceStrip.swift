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
        HStack(alignment: .top, spacing: 5) {
            ForEach(Array(dates.enumerated()), id: \.element) { i, date in
                column(date: date, dow: Week.DOW[i].uppercased())
            }
        }
        .gesture(
            DragGesture(minimumDistance: 24)
                .onEnded { g in
                    guard abs(g.translation.width) > 60,
                          abs(g.translation.width) > abs(g.translation.height) else { return }
                    onSwipeWeek(g.translation.width < 0 ? 1 : -1)
                }
        )
    }

    private func column(date: String, dow: String) -> some View {
        let isSelected = date == selected
        let isToday = date == today
        let isPast = date < today                       // ISO strings sort correctly
        let pairs = pairsFor(date)
        return Button { onPick(date) } label: {
            VStack(spacing: 0) {
                Text(dow)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(RB.textFaint)
                Text(String(Int(date.suffix(2)) ?? 0))
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(isToday ? RB.accent : isSelected ? .white : RB.textMute)
                    .padding(.top, 1)
                if restFor(date) {
                    Image(systemName: TypeBadge.symbol(for: "rest"))
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(RB.textFaint)
                        .padding(.top, 10)
                } else {
                    ForEach(Array(pairs.enumerated()), id: \.offset) { _, pair in
                        pairView(pair)
                            .padding(.top, 9)   // air BETWEEN pairs; number hugs its icon
                            .opacity(isPast ? 0.45 : 1)
                    }
                }
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 2)
            .frame(maxWidth: .infinity, alignment: .top)
            .background(isSelected ? RB.surface2 : RB.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12)
                .stroke(isSelected ? RB.accent : RB.line, lineWidth: isSelected ? 1.5 : 1))
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
