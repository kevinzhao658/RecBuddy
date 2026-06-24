/** The RecBuddy wordmark: Saira Condensed 800 italic, two-tone with a metallic
 *  bevel. Always italic, never background-clipped (it clips the glyphs). */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`select-none font-display font-extrabold italic leading-none tracking-[-0.03em] ${className}`}>
      <span className="rb-metal-lime">Rec</span>
      <span className="rb-metal-silver">Buddy</span>
    </span>
  )
}
