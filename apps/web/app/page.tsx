import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 p-8">
      <h1 className="text-5xl font-bold">Monocore</h1>
      <p className="max-w-2xl text-slate-700">
        Foundation repository initialized. Use platform and app routes for control plane and tenant plane.
      </p>
      <div className="flex gap-4">
        <Link className="rounded bg-mono-500 px-4 py-2 text-white" href="/platform/dashboard">
          Platform Admin
        </Link>
        <Link className="rounded border border-slate-300 bg-white px-4 py-2" href="/app/company">
          Customer App
        </Link>
      </div>
    </main>
  );
}
