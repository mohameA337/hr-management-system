/** Temporary screen for modules that are not built yet. */
export function PlaceholderPage({ title, phase }: { title: string; phase: number }) {
  return (
    <>
      <h1 className="page-title">{title}</h1>
      <div className="card">
        <p className="muted">Coming in phase {phase}.</p>
      </div>
    </>
  );
}
