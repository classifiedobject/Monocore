'use client';

import Link from 'next/link';
import { PayrollPageIntro } from './_components';

const sections = [
  {
    title: 'Employees',
    description: 'Çalışan ana kayıtlarını yönetin. Kimlik, doğum tarihi, banka bilgisi ve aktiflik durumu burada tutulur.',
    href: '/app/payroll/employees'
  },
  {
    title: 'Employment Records',
    description: 'Geliş, hakediş başlangıç ve SGK tarihleriyle istihdam dönemlerini yönetin.',
    href: '/app/payroll/employment'
  },
  {
    title: 'Compensation Profiles',
    description: 'Hakediş baz maaşı ve resmi net maaş geçmişini koruyarak ücret profillerini yönetin.',
    href: '/app/payroll/compensation'
  },
  {
    title: 'Compensation Matrix',
    description: 'Hakediş maaşı ile resmi net maaş arasındaki şirket politika eşleştirmelerini sakin bir listede yönetin.',
    href: '/app/payroll/matrix'
  },
  {
    title: 'Worklogs',
    description: 'Saat bazlı kayıtları takip edin ve mevcut iş akışınızla uyumlu şekilde devam edin.',
    href: '/app/payroll/worklogs'
  },
  {
    title: 'Payroll Periods',
    description: 'Dönemleri oluşturun, hesaplayın ve finans entegrasyonuna hazır şekilde yönetin.',
    href: '/app/payroll/periods'
  }
] as const;

export default function PayrollManagementPage() {
  return (
    <section className="space-y-8">
      <PayrollPageIntro
        title="Payroll Management"
        description="Payroll Core artık çalışan ana kaydı, istihdam geçmişi ve ücret profili temeli üzerine kuruluyor. Buradan ilgili alt sayfalara geçip kayıtları sakin ve düzenli bir akışta yönetebilirsiniz."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-5 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <h2 className="text-base font-semibold text-slate-950">{section.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{section.description}</p>
            <span className="mt-5 inline-flex text-sm font-medium text-slate-700">Aç</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
