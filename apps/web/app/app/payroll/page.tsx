'use client';

import Link from 'next/link';

const cards = [
  {
    title: 'Payroll Periods',
    description: 'Aylık bordro dönemlerini hesaplayın, kilitleyin ve muhasebeleştirin.',
    href: '/app/payroll/periods' as const
  },
  {
    title: 'Worklogs',
    description: 'Saat bazlı kayıtları gözden geçirin ve dönem hesapları için veri hazırlayın.',
    href: '/app/payroll/worklogs' as const
  }
];

export default function PayrollPage() {
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Payroll Core</h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Bordro yönetimini sakin ve kontrollü bir akışla yürütün. Bu alan, dönem hesapları ve
          destekleyici çalışma kayıtları için giriş noktasıdır.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="space-y-2">
              <h2 className="text-lg font-medium text-slate-900">{card.title}</h2>
              <p className="text-sm leading-6 text-slate-600">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
