// Local replacement for the space runtime's SafeAreaTopScrim (Cloudflare
// port, 2026-11-13): a fixed, non-interactive strip across the top of the
// viewport, painted in the page background color, covering the mobile
// safe-area inset (notch / status-bar zone) so scrolled content never
// shows through it. Purely cosmetic chrome; behavior matches the App's
// single usage <SafeAreaTopScrim backgroundColor="var(--bg)" />.

export function SafeAreaTopScrim({
  backgroundColor,
}: {
  backgroundColor?: string;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "env(safe-area-inset-top, 0px)",
        backgroundColor,
        zIndex: 80,
        pointerEvents: "none",
      }}
    />
  );
}
