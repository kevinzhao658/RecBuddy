import WidgetKit
import SwiftUI

// Widget-local tokens (RB lives in the app target; keep the palette in sync).
private let accent = Color(red: 0.678, green: 1.0, blue: 0.184)   // #ADFF2F
private let mute = Color.white.opacity(0.56)
private let faint = Color.white.opacity(0.30)

/// Type -> SF Symbol, mirroring the app's TypeBadge (duplicated here because
/// TypeBadge depends on app-only theme types).
private func symbol(for type: String) -> String {
    switch type {
    case "easy": return "figure.run"
    case "long": return "arrow.right.to.line"
    case "speed": return "bolt.fill"
    case "tempo": return "gauge.with.needle"
    case "recovery": return "arrow.clockwise.heart"
    case "cross": return "bicycle"
    case "race": return "flag.checkered"
    default: return "figure.run"
    }
}

private func fmtDist(_ d: Double?) -> String {
    guard let d else { return "" }
    return d.truncatingRemainder(dividingBy: 1) == 0 ? " · \(Int(d)) mi" : String(format: " · %.1f mi", d)
}

struct TodayWidgetView: View {
    let entry: TodayEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            if let snap = entry.snapshot, !snap.isStale(today: entry.today) {
                switch family {
                case .accessoryRectangular: LockRect(snap: snap)
                case .systemMedium: HomeCard(snap: snap, maxRows: 4)
                default: HomeSmall(snap: snap)
                }
            } else {
                OpenAppPrompt(family: family)
            }
        }
        .widgetURL(URL(string: "recbuddy://today"))
    }
}

/// Lock screen: next to-do + count. Monochrome-safe (system tints it).
private struct LockRect: View {
    let snap: TodaySnapshot
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let next = snap.nextUp {
                Label("\(next.title)\(fmtDist(next.dist))", systemImage: symbol(for: next.type))
                    .font(.headline)
                    .lineLimit(1)
                if snap.remainingCount > 1 {
                    Text("+\(snap.remainingCount - 1) more today").font(.caption2)
                } else if snap.doneCount > 0 {
                    Text("\(snap.doneCount) done").font(.caption2)
                }
            } else if snap.doneCount > 0 {
                Label("All done today", systemImage: "checkmark.circle.fill").font(.headline)
            } else {
                Label("Rest day", systemImage: "moon.zzz").font(.headline)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct HomeCard: View {
    let snap: TodaySnapshot
    let maxRows: Int
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("TODAY")
                .font(.system(size: 10, weight: .bold))
                .kerning(1.4)
                .foregroundStyle(accent)
            if snap.entries.isEmpty {
                Spacer()
                Label("Rest day", systemImage: "moon.zzz").font(.subheadline).foregroundStyle(mute)
                Spacer()
            } else {
                ForEach(snap.entries.prefix(maxRows)) { e in
                    HStack(spacing: 6) {
                        Image(systemName: symbol(for: e.type)).font(.caption2).foregroundStyle(e.done ? faint : accent)
                        Text(e.title).font(.footnote.weight(.semibold))
                            .foregroundStyle(e.done ? faint : .white)
                            .strikethrough(e.done, color: faint)
                            .lineLimit(1)
                        Spacer(minLength: 4)
                        Text(e.done ? "✓" : fmtDist(e.dist).replacingOccurrences(of: " · ", with: ""))
                            .font(.caption2)
                            .foregroundStyle(e.done ? accent : mute)
                    }
                }
                if snap.entries.count > maxRows {
                    Text("+\(snap.entries.count - maxRows) more").font(.caption2).foregroundStyle(faint)
                }
                Spacer(minLength: 0)
            }
        }
    }
}

private struct HomeSmall: View {
    let snap: TodaySnapshot
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("TODAY").font(.system(size: 10, weight: .bold)).kerning(1.4).foregroundStyle(accent)
            Spacer(minLength: 0)
            if let next = snap.nextUp {
                Image(systemName: symbol(for: next.type)).font(.title3).foregroundStyle(accent)
                Text(next.title).font(.subheadline.weight(.bold)).foregroundStyle(.white).lineLimit(2)
                Text("\(snap.doneCount) of \(snap.entries.count) done").font(.caption2).foregroundStyle(mute)
            } else if snap.doneCount > 0 {
                Image(systemName: "checkmark.circle.fill").font(.title3).foregroundStyle(accent)
                Text("All done today").font(.subheadline.weight(.bold)).foregroundStyle(.white)
            } else {
                Image(systemName: "moon.zzz").font(.title3).foregroundStyle(mute)
                Text("Rest day").font(.subheadline.weight(.bold)).foregroundStyle(mute)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct OpenAppPrompt: View {
    let family: WidgetFamily
    var body: some View {
        if family == .accessoryRectangular {
            Label("Open RecBuddy for today's plan", systemImage: "arrow.up.forward.app")
                .font(.caption2)
        } else {
            VStack(spacing: 4) {
                Image(systemName: "arrow.up.forward.app").font(.title3).foregroundStyle(mute)
                Text("Open RecBuddy for today's plan")
                    .font(.caption).foregroundStyle(mute).multilineTextAlignment(.center)
            }
        }
    }
}
