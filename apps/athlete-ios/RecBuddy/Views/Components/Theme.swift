import SwiftUI

/// Design tokens matching the reference mockups (_ui_ref/screenshots/handoff)
/// and the web app's theme.css: volt lime on near-black.
enum RB {
    static let accent    = Color(red: 0xAD/255, green: 0xFF/255, blue: 0x2F/255) // #ADFF2F
    static let accent2   = Color(red: 0x7C/255, green: 0xCB/255, blue: 0x00/255) // #7CCB00
    static let onAccent  = Color(red: 0x0A/255, green: 0x0C/255, blue: 0x08/255) // #0A0C08
    static let bg        = Color(red: 0x0B/255, green: 0x0D/255, blue: 0x08/255) // app background
    static let surface   = Color(red: 0x15/255, green: 0x18/255, blue: 0x10/255) // cards
    static let surface2  = Color(red: 0x1D/255, green: 0x21/255, blue: 0x16/255) // fields / raised
    static let line      = Color.white.opacity(0.08)                              // hairlines
    static let textMute  = Color.white.opacity(0.55)
    static let textFaint = Color.white.opacity(0.35)
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
            .shadow(color: prominent ? RB.accent.opacity(configuration.isPressed ? 0.15 : 0.45) : .clear,
                    radius: 14, y: 2)
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}

/// Card container matching the mockups (dark surface, hairline, 16pt radius).
struct RBCard: ViewModifier {
    var highlighted = false
    func body(content: Content) -> some View {
        content
            .background(RB.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(highlighted ? Color.white.opacity(0.7) : RB.line,
                            lineWidth: highlighted ? 1.5 : 1)
            )
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
            .background(RB.surface2)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(RB.line, lineWidth: 1))
    }
}
extension View {
    func rbField() -> some View { modifier(RBField()) }
}
