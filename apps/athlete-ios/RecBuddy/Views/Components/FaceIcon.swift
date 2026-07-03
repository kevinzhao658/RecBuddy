import SwiftUI

/// Line-art effort faces (SF Symbols has no open-mouth/frowning face, so these
/// are drawn: circle + eye dots + a mouth arc). Tintable via foregroundStyle,
/// stroke-matched to the rest of the icon set.
struct FaceIcon: View {
    enum Kind { case laugh, smile, frown }
    let kind: Kind
    var size: CGFloat = 22

    var body: some View {
        Canvas { ctx, cg in
            let w = cg.width, line = w * 0.075
            let stroke = StrokeStyle(lineWidth: line, lineCap: .round)
            let center = CGPoint(x: w / 2, y: w / 2)

            // Head
            var head = Path()
            head.addEllipse(in: CGRect(x: line, y: line, width: w - 2 * line, height: w - 2 * line))
            ctx.stroke(head, with: .style(.primary), style: stroke)

            // Eyes
            for x in [0.36, 0.64] {
                var eye = Path()
                eye.addEllipse(in: CGRect(x: w * x - line * 0.7, y: w * 0.36 - line * 0.7,
                                          width: line * 1.4, height: line * 1.4))
                ctx.fill(eye, with: .style(.primary))
            }

            // Mouth
            var mouth = Path()
            switch kind {
            case .laugh: // open mouth: filled lower half-circle
                mouth.addArc(center: CGPoint(x: center.x, y: w * 0.55), radius: w * 0.22,
                             startAngle: .degrees(0), endAngle: .degrees(180), clockwise: false)
                mouth.closeSubpath()
                ctx.fill(mouth, with: .style(.primary))
            case .smile: // upward arc
                mouth.addArc(center: CGPoint(x: center.x, y: w * 0.52), radius: w * 0.2,
                             startAngle: .degrees(25), endAngle: .degrees(155), clockwise: false)
                ctx.stroke(mouth, with: .style(.primary), style: stroke)
            case .frown: // downward arc
                mouth.addArc(center: CGPoint(x: center.x, y: w * 0.78), radius: w * 0.2,
                             startAngle: .degrees(-155), endAngle: .degrees(-25), clockwise: false)
                ctx.stroke(mouth, with: .style(.primary), style: stroke)
            }
        }
        .frame(width: size, height: size)
    }
}
