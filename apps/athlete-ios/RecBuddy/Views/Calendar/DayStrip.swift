import SwiftUI

/// The horizontal 7-day strip: weekday + date pills with status marks under
/// the number (✓ all done, dots otherwise — lime done / grey planned).
/// Tapping a pill reveals that day's activities in the pager below.
struct DayStrip: View {
    let dates: [String]                    // the week's 7 ISO days, Mon..Sun
    let selected: String
    let marksFor: (String) -> DayMark
    let onPick: (String) -> Void

    var body: some View {
        HStack(spacing: 4) {
            ForEach(Array(dates.enumerated()), id: \.element) { i, date in
                pill(date: date, dow: Week.DOW[i].uppercased())
            }
        }
    }

    private func pill(date: String, dow: String) -> some View {
        let isSelected = date == selected
        let isToday = date == Week.todayISO()
        return Button { onPick(date) } label: {
            VStack(spacing: 2) {
                Text(dow)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(RB.textFaint)
                Text(String(Int(date.suffix(2)) ?? 0))
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(isSelected || isToday ? .white : RB.textMute)
                markRow(marksFor(date))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(isSelected ? RB.surface2 : RB.surface)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10)
                .stroke(isSelected ? RB.accent : RB.line, lineWidth: isSelected ? 1.5 : 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(dow) \(date)")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    @ViewBuilder
    private func markRow(_ mark: DayMark) -> some View {
        switch mark {
        case .none:
            Color.clear.frame(height: 4)
        case .allDone:
            Image(systemName: "checkmark")
                .font(.system(size: 6, weight: .bold))
                .foregroundStyle(RB.accent)
                .frame(height: 4)
        case .dots(let flags):
            HStack(spacing: 2) {
                ForEach(Array(flags.enumerated()), id: \.offset) { _, done in
                    Circle().fill(done ? RB.accent : RB.textFaint)
                        .frame(width: 4, height: 4)
                }
            }
            .frame(height: 4)
        }
    }
}
