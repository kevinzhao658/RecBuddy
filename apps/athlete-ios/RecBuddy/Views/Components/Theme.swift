import SwiftUI

/// Design tokens matching the reference mockups (_ui_ref/screenshots/handoff)
/// and the web app's theme.css: volt lime on near-black.
enum RB {
    static let accent    = Color(red: 0xAD/255, green: 0xFF/255, blue: 0x2F/255) // #ADFF2F
    static let accent2   = Color(red: 0x7C/255, green: 0xCB/255, blue: 0x00/255) // #7CCB00
    static let onAccent  = Color(red: 0x0A/255, green: 0x0C/255, blue: 0x08/255) // #0A0C08
    static let bg        = Color(red: 0x0A/255, green: 0x0C/255, blue: 0x08/255) // #0A0C08 (matches web --color-bg)
    static let surface   = Color(red: 0x15/255, green: 0x18/255, blue: 0x10/255) // cards
    static let surface2  = Color(red: 0x1D/255, green: 0x21/255, blue: 0x16/255) // fields / raised
    static let line      = Color.white.opacity(0.08)                              // hairlines
    static let textMute  = Color.white.opacity(0.55)
    static let textFaint = Color.white.opacity(0.35)

    // ── Brushed-metal treatment (mirrors theme.css --rb-surface/--rb-bevel) ──
    /// Diagonal dark-metal card gradient: #23271B → #181B12 → #0E100A at 157°.
    static let metalSurface = LinearGradient(
        stops: [
            .init(color: Color(red: 0x23/255, green: 0x27/255, blue: 0x1B/255), location: 0),
            .init(color: Color(red: 0x18/255, green: 0x1B/255, blue: 0x12/255), location: 0.46),
            .init(color: Color(red: 0x0E/255, green: 0x10/255, blue: 0x0A/255), location: 1),
        ],
        startPoint: .topLeading, endPoint: .bottomTrailing)
    /// Raised-field metal gradient: #262B1C → #181C11.
    static let metalSurface2 = LinearGradient(
        colors: [Color(red: 0x26/255, green: 0x2B/255, blue: 0x1C/255),
                 Color(red: 0x18/255, green: 0x1C/255, blue: 0x11/255)],
        startPoint: .topLeading, endPoint: .bottomTrailing)
    /// Ambient lime glow at the top of every screen (theme.css body radial).
    static let bgGlow = RadialGradient(
        colors: [accent.opacity(0.06), .clear],
        center: .top, startRadius: 0, endRadius: 480)

    // Two-tone metallic wordmark colors (theme.css .rb-metal-lime / -silver)
    static let metalLime        = Color(red: 0xC8/255, green: 0xFF/255, blue: 0x5C/255) // #C8FF5C
    static let metalLimeEdge    = Color(red: 0x7D/255, green: 0xC4/255, blue: 0x21/255) // #7DC421
    static let metalSilver      = Color(red: 0xFC/255, green: 0xFF/255, blue: 0xF6/255) // #FCFFF6
    static let metalSilverEdge  = Color(red: 0x97/255, green: 0xA7/255, blue: 0x84/255) // #97A784
}

/// Embossed-metal text (theme.css .rb-metal-*): white top edge, darker bottom
/// edge, deep drop shadows — apply to wordmark-scale type only.
struct MetalText: ViewModifier {
    let edge: Color
    func body(content: Content) -> some View {
        content
            .shadow(color: .white.opacity(0.45), radius: 0, y: -1) // top highlight edge
            .shadow(color: edge, radius: 0, y: 1)                  // machined bottom edge
            .shadow(color: .black.opacity(0.45), radius: 2, y: 2)
            .shadow(color: .black.opacity(0.4), radius: 7, y: 4)
    }
}
extension View {
    func metalLime() -> some View { modifier(MetalText(edge: RB.metalLimeEdge)) }
    func metalSilver() -> some View { modifier(MetalText(edge: RB.metalSilverEdge)) }
}

/// Uppercase letter-spaced section label ("EMAIL", "WEEKLY MILEAGE", "COACH'S NOTE").
/// Pass `color` to override the default textMute tint (e.g. RB.accent for plan-week header).
struct RBLabel: View {
    let text: String
    var color: Color? = nil
    /// Positional init so callers can write `RBLabel("TITLE")` or `RBLabel("TITLE", color: RB.accent)`.
    init(_ text: String, color: Color? = nil) {
        self.text = text
        self.color = color
    }
    var body: some View {
        Text(text.uppercased())
            .font(.caption2.weight(.semibold))
            .kerning(1.2)
            .foregroundStyle(color ?? RB.textMute)
    }
}

/// The volt pill CTA — glowing lime, italic heavy condensed uppercase (reference: LOG IN / MARK AS COMPLETE).
struct VoltButtonStyle: ButtonStyle {
    var prominent = true
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.heavy))
            .italic()
            .fontWidth(.condensed)
            .textCase(.uppercase)
            .kerning(0.5)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(prominent ? RB.accent : RB.surface2)
            .foregroundStyle(prominent ? RB.onAccent : .white)
            .clipShape(Capsule())
            .contentShape(Capsule()) // whole pill tappable
            .shadow(color: prominent ? RB.accent.opacity(configuration.isPressed ? 0.15 : 0.45) : .clear,
                    radius: 14, y: 2)
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}

/// Card container matching the mockups: brushed-metal gradient, beveled top
/// edge, hairline ring, deep drop shadow (theme.css .rb-card / --rb-bevel).
struct RBCard: ViewModifier {
    var highlighted = false
    func body(content: Content) -> some View {
        content
            .background(RB.metalSurface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay( // bevel: light machined edge fading from the top
                RoundedRectangle(cornerRadius: 16)
                    .stroke(LinearGradient(colors: [.white.opacity(0.14), .clear],
                                           startPoint: .top, endPoint: .center),
                            lineWidth: 1)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(highlighted ? Color.white.opacity(0.7) : RB.line,
                            lineWidth: highlighted ? 1.5 : 1)
            )
            .shadow(color: .black.opacity(0.5), radius: 1, y: 1)
            .shadow(color: .black.opacity(0.45), radius: 14, y: 8)
    }
}
extension View {
    func rbCard(highlighted: Bool = false) -> some View { modifier(RBCard(highlighted: highlighted)) }
}

/// Dark form-field background for TextFields.
struct RBField: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 14).padding(.vertical, 13)
            .background(RB.metalSurface2)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(RB.line, lineWidth: 1))
    }
}
extension View {
    func rbField() -> some View { modifier(RBField()) }
}


/// The RecBuddy wordmark — Saira Condensed ExtraBold (bundled), synthetic
/// italic, -0.03em tracking, two-tone embossed metal. Mirrors the coach web
/// Wordmark component exactly.
struct Wordmark: View {
    var size: CGFloat = 44
    var body: some View {
        HStack(spacing: 0) {
            Text("Rec").foregroundStyle(RB.metalLime).metalLime()
            Text("Buddy").foregroundStyle(RB.metalSilver).metalSilver()
        }
        .font(.custom("SairaCondensed-ExtraBold", size: size))
        .italic()
        .kerning(size * -0.03)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("RecBuddy")
    }
}
