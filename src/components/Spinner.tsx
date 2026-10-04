/** Centered loading spinner. `size="sm"` is an inline variant for small spots (e.g. a count). */
export function Spinner({ size = "lg", className = "" }: { size?: "sm" | "lg"; className?: string }) {
  if (size === "sm") {
    return (
      <span role="status" className={`inline-flex align-middle ${className}`}>
        <span className="spinner spinner-sm" aria-hidden />
        <span className="sr-only">Loading</span>
      </span>
    );
  }
  return (
    <div role="status" className={`flex min-h-[45vh] w-full items-center justify-center ${className}`}>
      <span className="spinner" aria-hidden />
      <span className="sr-only">Loading</span>
    </div>
  );
}
