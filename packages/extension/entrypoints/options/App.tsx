/**
 * Options / config page (opened from the toolbar icon).
 *
 * Per PROTOCOL.md §7 this is where granted origins are reviewed/revoked and denied
 * origins are reset. Placeholder UI for now.
 */
export function App() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 4 }}>openpicker</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Manage which sites are allowed to use the element picker.
      </p>
      <section
        style={{
          marginTop: 24,
          padding: 16,
          border: "1px solid #e2e2e2",
          borderRadius: 8,
          color: "#888",
        }}
      >
        Granted &amp; denied origins — coming soon.
      </section>
    </main>
  )
}
