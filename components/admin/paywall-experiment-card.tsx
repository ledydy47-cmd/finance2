type PaywallCohort = {
  opened: number
  paywallShown: number
  percent: number | null
}

function formatShare(cohort: PaywallCohort) {
  if (cohort.percent == null) return "пока нет открытий"
  const percent = Number.isInteger(cohort.percent)
    ? String(cohort.percent)
    : cohort.percent.toFixed(1).replace(".", ",")
  return `${percent}% · ${cohort.paywallShown} из ${cohort.opened}`
}

export function PaywallExperimentCard({
  experiment,
}: {
  experiment: {
    baselineDays: number
    before: PaywallCohort
    after: PaywallCohort
  }
}) {
  return (
    <section className="mt-4 rounded-block border border-primary/25 bg-primary/5 p-4">
      <h2 className="font-serif text-lg font-bold">Пейвол без онбординга</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Доля впервые открывших приложение, которые увидели пейвол. «До» — {experiment.baselineDays}{" "}
        дней до 26 сентября, 17:00. «После» — кто впервые открыл приложение, пока онбординг был
        выключен, до 27 сентября, 11:45.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-block-sm bg-card p-3">
          <p className="text-xs text-muted-foreground">До выключения</p>
          <p className="mt-1 font-serif text-2xl font-bold">{formatShare(experiment.before)}</p>
        </div>
        <div className="rounded-block-sm bg-card p-3">
          <p className="text-xs text-muted-foreground">После выключения</p>
          <p className="mt-1 font-serif text-2xl font-bold">{formatShare(experiment.after)}</p>
        </div>
      </div>
    </section>
  )
}
