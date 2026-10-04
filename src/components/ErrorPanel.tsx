export function ErrorPanel({ error }: { error: string }) {
  const env = /MONGODB_URI|reach MongoDB/i.test(error);
  return (
    <div className="card p-6">
      <h1 className="display text-2xl">{env ? "MongoDB is not connected" : "Something went wrong"}</h1>
      {env ? (
        <p className="mt-3 max-w-xl text-sm text-muted">
          Put your Atlas URI (with the real password) in <code className="text-brass2">.env.local</code> as{" "}
          <code>MONGODB_URI</code>, make sure your IP is allowed in Atlas Network Access, then restart{" "}
          <code>npm run dev</code>.
        </p>
      ) : null}
      <p className="mt-3 text-sm text-warn">{error}</p>
    </div>
  );
}
