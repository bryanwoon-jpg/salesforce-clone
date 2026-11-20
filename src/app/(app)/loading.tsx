export default function Loading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <div className="card h-16 animate-pulse" />
      <div className="card h-80 animate-pulse" />
    </div>
  );
}
