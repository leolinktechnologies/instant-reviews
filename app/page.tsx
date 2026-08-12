import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-3xl font-bold mb-4">Review Funnel System 🚀</h1>
      <p className="text-slate-400 mb-6 max-w-md">
        Welcome! Your SaaS Review Management app is live and running.
      </p>

      <div className="flex gap-4">
        <Link
          href="/add-business"
          className="px-5 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition"
        >
          ➕ Add New Business
        </Link>
      </div>
    </main>
  );
}