import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'
import { getDashboardData } from '@/application/testimony/GetDashboardDataUseCase'
import { StatusCounter } from '@/components/StatusCounter'
import { TestimoniesTable } from '@/components/TestimoniesTable'

export default async function DashboardPage() {
  const repo = new DrizzleTestimonyRepository()
  const { counts, recent } = await getDashboardData(repo)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      <div className="mb-8 grid grid-cols-3 gap-4 max-w-lg">
        <StatusCounter label="new"        count={counts.new} />
        <StatusCounter label="summarized" count={counts.summarized} />
        <StatusCounter label="published"  count={counts.published} />
      </div>

      <h2 className="mb-3 text-lg font-semibold">Последние свидетельства</h2>
      <TestimoniesTable items={recent} />
    </div>
  )
}
