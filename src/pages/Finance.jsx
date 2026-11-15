import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { Err, Skeleton } from '../ui'

// ---------- Форматирование ----------
const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const rub = (n) => nf.format(Math.round(n || 0)) + ' ₽'
const k = (n) => nf.format(Math.round((n || 0) / 1000))
const signedK = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + k(Math.abs(n))
const mln = (n) => (n / 1e6).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' млн ₽'
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const mlabel = (ym) => MONTHS[+ym.slice(5, 7) - 1]
const MONTHS_FULL = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
const SRC = Array.from({ length: 7 }, (_, i) => `var(--color-src-${i + 1})`)
const shortName = (s) => s.replace(/^ООО\s*/, '').replace(/[«»]/g, '')
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0)

export default function Finance() {
  const [snap, setSnap] = useState(undefined)
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.from('fin_snapshots').select('as_of, data, created_at').order('as_of', { ascending: false }).limit(1).maybeSingle()
      .then(({ data, error }) => {
        if (error) setErr(error.message)
        setSnap(data || null)
      })
  }, [])

  if (snap === undefined) {
    return (
      <>
        <div className="page-head"><h1>Финансы</h1></div>
        <div className="grid g3"><Skeleton h={140} /><Skeleton h={140} /><Skeleton h={140} /></div>
        <Skeleton h={320} />
      </>
    )
  }
  if (!snap) {
    return (
      <>
        <div className="page-head"><h1>Финансы</h1></div>
        <Err>{err}</Err>
        <section className="card">
          <h2>Снимка пока нет</h2>
          <p className="muted">Данные из Zenmoney появятся после первого ежедневного обновления.</p>
        </section>
      </>
    )
  }

  const d = snap.data
  const n = d.narrative || {}
  return (
    <>
      <div className="page-head">
        <h1>Финансы</h1>
        <span className="muted small">Данные Zenmoney на {new Date(d.as_of).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span>
      </div>
      <Err>{err}</Err>

      <Overview d={d} n={n} />
      <MonthGoal d={d} />
      <Budget d={d} />
      <IncomeMonths d={d} />
      <NetMonths d={d} />
      <Capital d={d} />
      <Invest inv={d.invest} />
      <PathToMillion d={d} />
      {(n.risks?.length > 0 || n.actions?.length > 0) && <RisksActions n={n} />}
    </>
  )
}

// ---------- 0. Сводка ----------
function Overview({ d, n }) {
  const c = d.capital
  const parts = [
    ['Свободные деньги', c.sums.free + c.sums.business],
    ['Облигации и копилка', c.sums.invest],
    ['Пенсионные и долгосрочные', c.sums.long],
    ['Подушка и цели', c.sums.cushion],
  ].filter((x) => x[1] > 0)
  return (
    <section className="card" aria-labelledby="ov-h">
      <div className="ledger">
        <div className="ledger-total">
          <h2 id="ov-h">{n.headline || 'Капитал'}</h2>
          <span className="figure-xl">{mln(c.total)}</span>
          <span className="muted small">чистый капитал{c.sums.debts < 0 ? `, долги ${rub(c.sums.debts)}` : ', долгов нет'}</span>
          {n.summary && <p className="small" style={{ color: 'var(--color-ink-2)', marginTop: 'var(--space-xs)' }}>{n.summary}</p>}
        </div>
        <div className="section">
          <div className="stack" role="img" aria-label="Состав капитала">
            {parts.map(([name, v], i) => <span key={name} style={{ flexGrow: v, background: SRC[i] }} title={name} />)}
          </div>
          <table className="src-table">
            <caption className="visually-hidden">Состав капитала</caption>
            <tbody>
              {parts.map(([name, v], i) => (
                <tr key={name}>
                  <td><span className="swatch" style={{ background: SRC[i] }} aria-hidden="true" />{name}</td>
                  <td className="num muted">{pct(v, c.total)}%</td>
                  <td className="num">{rub(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

// ---------- 1. Месяц относительно цели ----------
function MonthGoal({ d }) {
  const c = d.current
  const marks = [
    { key: 'fact', label: 'Сейчас', v: c.net },
    { key: 'plan', label: 'Прогноз по плану', v: c.forecast_net_plan ?? c.forecast_net },
    { key: 'pace', label: 'При текущем темпе', v: c.forecast_net },
    { key: 'goal', label: 'Цель', v: c.goal_net },
  ]
  const lim = Math.max(200000, ...marks.map((m) => Math.abs(m.v))) * 1.1
  const pos = (v) => 50 + (v / lim) * 50
  const ticks = [-lim, -lim / 2, 0, lim / 2, lim].map((t) => Math.round(t / 50000) * 50000)
  return (
    <section className="section" aria-labelledby="mg-h">
      <div className="section-head">
        <h2 id="mg-h">{cap(MONTHS_FULL[+d.month.slice(5) - 1])}: где месяц относительно цели {signedK(c.goal_net)} тыс.</h2>
        <span className="muted small">день {d.day} из {d.days_total}</span>
      </div>
      <div className="grid g4">
        <Kpi label="Сейчас, тыс. ₽" value={signedK(c.net)} tone={c.net >= 0 ? 'ok' : 'bad'} note={`доходы ${k(c.income)}, расходы ${k(c.expense)}`} />
        <Kpi label="Прогноз по плану" value={signedK(c.forecast_net_plan)} tone={c.forecast_net_plan >= c.goal_net ? 'ok' : 'bad'} note={`ждём доходов ${k(c.income_planned)}, платежей ${k(c.expense_planned)}`} />
        <Kpi label="При текущем темпе" value={signedK(c.forecast_net)} tone={c.forecast_net >= c.goal_net ? 'ok' : 'bad'} note={`гибкие траты ${k(c.pace_per_day)} тыс. в день`} />
        <Kpi label="Подушка" value={k(d.capital.sums.cushion)} note={d.cushion_days != null ? `около ${d.cushion_days} дн. средних расходов` : ''} />
      </div>
      <div className="card">
        <div className="scale" role="img" aria-label={marks.map((m) => `${m.label} ${signedK(m.v)} тыс.`).join(', ')}>
          <div className="scale-track">
            <span className="scale-zero" style={{ left: '50%' }} />
            {marks.map((m) => (
              <span key={m.key} className={`scale-mark ${m.key}${pos(m.v) < 15 ? ' edge-l' : pos(m.v) > 85 ? ' edge-r' : ''}`} style={{ left: `${pos(m.v)}%` }}>
                <span className="scale-label">{m.label}<b>{signedK(m.v)}</b></span>
              </span>
            ))}
          </div>
          <div className="scale-ticks">{ticks.map((t, i) => <span key={i}>{signedK(t)}</span>)}</div>
        </div>
        <p className="small muted">Тыс. ₽. «По плану»: факт и запланированные в Zenmoney операции. «При текущем темпе» добавляет к нему гибкие траты в нынешнем темпе до конца месяца.</p>
      </div>
    </section>
  )
}

// ---------- 2. Бюджет ----------
function Budget({ d }) {
  const c = d.current
  const monthPct = pct(d.day, d.days_total)
  const rows = c.categories.filter((x) => x.budget > 0 || x.fact >= 1000)
  const max = Math.max(...rows.map((x) => Math.max(x.budget, x.forecast, x.fact)), 1)
  return (
    <section className="section" aria-labelledby="bu-h">
      <div className="section-head">
        <h2 id="bu-h">Бюджет: потрачено {pct(c.expense, c.budget)}% при {monthPct}% месяца</h2>
      </div>
      <div className="grid g4">
        <Kpi label="Бюджет месяца" value={k(c.budget)} note="тыс. ₽" />
        <Kpi label="Потрачено" value={k(c.expense)} tone={pct(c.expense, c.budget) > monthPct ? 'bad' : 'ok'} note={`${pct(c.expense, c.budget)}% бюджета`} />
        <Kpi label="Впереди по плану" value={k(c.expense_planned)} note="запланированные платежи" />
        <Kpi label="Лимит для цели" value={k(d.averages.expense_limit_for_goal)} note={`расходы, при которых база даёт ${signedK(c.goal_net)}`} />
      </div>
      <div className="card">
        <div className="legend-row small muted" aria-hidden="true">
          <span><i className="lg fact" />потрачено</span><span><i className="lg plan" />запланировано</span><span><i className="lg tick" />бюджет</span>
        </div>
        <div className="budget-list">
          {rows.map((x) => {
            const over = x.budget > 0 && x.forecast > x.budget
            return (
              <div className="budget-row" key={x.name}>
                <span className="b-name">{x.name}</span>
                <div className="b-bar" role="img" aria-label={`${x.name}: потрачено ${k(x.fact)} из ${k(x.budget)} тыс.`}>
                  <span className={'b-fact' + (over ? ' over' : '')} style={{ width: `${(x.fact / max) * 100}%` }} />
                  {x.planned > 0 && <span className="b-plan" style={{ left: `${(x.fact / max) * 100}%`, width: `${(x.planned / max) * 100}%` }} />}
                  {x.budget > 0 && <span className="b-tick" style={{ left: `${(x.budget / max) * 100}%` }} />}
                </div>
                <span className="b-num num">{k(x.fact)}<span className="muted"> / {x.budget ? k(x.budget) : '—'}</span></span>
                <span className={'b-pct num' + (over ? ' bad' : '')}>{x.pct != null ? `${x.pct}%` : 'вне бюджета'}</span>
              </div>
            )
          })}
        </div>
        <p className="small muted">Тыс. ₽, с учётом возвратов. Красным отмечены категории, которые с запланированными платежами выйдут за бюджет.</p>
      </div>
    </section>
  )
}

// ---------- 3. Доходы по месяцам ----------
function IncomeMonths({ d }) {
  const months = d.months
  const totals = {}
  months.forEach((m) => Object.entries(m.sources).forEach(([s, v]) => { totals[s] = (totals[s] || 0) + v }))
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 6).map((x) => x[0])
  const keys = [...top, 'Прочее']
  const color = (key) => (key === 'Прочее' ? 'var(--color-rule)' : SRC[top.indexOf(key) % SRC.length])
  const max = Math.max(...months.map((m) => m.income), d.income_base.total) * 1.08
  const H = 220
  const y = (v) => H - (v / max) * H
  const base = d.income_base.total
  return (
    <section className="section" aria-labelledby="in-h">
      <div className="section-head">
        <h2 id="in-h">Доходы за год: {k(d.averages.income)} в среднем против новой базы {k(base)}</h2>
        <span className="muted small">тыс. ₽ в месяц</span>
      </div>
      <div className="card">
        <div className="legend-row small" aria-hidden="true">
          {keys.map((key) => <span key={key}><i className="lg" style={{ background: color(key) }} />{shortName(key)}</span>)}
          <span><i className="lg base" />новая база</span>
        </div>
        <div className="scroll">
          <svg className="chart" viewBox={`0 0 ${months.length * 64} ${H + 40}`} role="img" aria-label="Доходы по месяцам и источникам" style={{ minWidth: 560 }}>
            <line x1="0" x2={months.length * 64} y1={y(base)} y2={y(base)} className="ln-base" />
            {months.map((m, i) => {
              let acc = 0
              const parts = keys.map((key) => {
                const v = key === 'Прочее' ? Object.entries(m.sources).filter(([s]) => !top.includes(s)).reduce((a, [, x]) => a + x, 0) : (m.sources[key] || 0)
                const seg = { key, v, y0: acc }
                acc += v
                return seg
              }).filter((s) => s.v > 0)
              return (
                <g key={m.month} transform={`translate(${i * 64 + 12},0)`}>
                  {parts.map((s) => <rect key={s.key} x="0" width="40" y={y(s.y0 + s.v)} height={(s.v / max) * H} fill={color(s.key)} rx="2"><title>{`${shortName(s.key)}: ${k(s.v)} тыс.`}</title></rect>)}
                  <text x="20" y={y(m.income) - 6} className="t-val">{k(m.income)}</text>
                  <text x="20" y={H + 18} className="t-axis">{mlabel(m.month)}{m.partial ? '*' : ''}</text>
                </g>
              )
            })}
          </svg>
        </div>
        <p className="small muted">По категориям доходов Zenmoney. Звёздочка: месяц ещё идёт.</p>
      </div>
    </section>
  )
}

// ---------- 4. Чистая прибыль ----------
function NetMonths({ d }) {
  const months = d.months
  const goal = d.current.goal_net
  const lim = Math.max(...months.map((m) => Math.abs(m.net)), goal) * 1.15
  const H = 200
  const y = (v) => H / 2 - (v / lim) * (H / 2)
  const plus = months.filter((m) => !m.partial && m.net > 0).length
  const full = months.filter((m) => !m.partial).length
  return (
    <section className="section" aria-labelledby="net-h">
      <div className="section-head">
        <h2 id="net-h">Чистая прибыль: в плюсе {plus} месяцев из {full}</h2>
        <span className="muted small">доходы минус расходы, тыс. ₽</span>
      </div>
      <div className="card">
        <div className="scroll">
          <svg className="chart" viewBox={`0 0 ${months.length * 64} ${H + 52}`} role="img" aria-label="Чистая прибыль по месяцам" style={{ minWidth: 560 }}>
            <line x1="0" x2={months.length * 64} y1={y(0)} y2={y(0)} className="ln-zero" />
            <line x1="0" x2={months.length * 64} y1={y(goal)} y2={y(goal)} className="ln-goal" />
            <text x={months.length * 64 - 4} y={y(goal) - 6} className="t-goal" textAnchor="end">цель {signedK(goal)}</text>
            {months.map((m, i) => {
              const h = Math.abs(y(m.net) - y(0))
              return (
                <g key={m.month} transform={`translate(${i * 64 + 12},0)`}>
                  <rect x="0" width="40" y={m.net >= 0 ? y(m.net) : y(0)} height={Math.max(h, 1)} rx="2" className={m.net >= 0 ? 'b-pos' : 'b-neg'} opacity={m.partial ? 0.6 : 1}>
                    <title>{`${mlabel(m.month)}: доход ${k(m.income)}, расходы ${k(m.expense)}`}</title>
                  </rect>
                  <text x="20" y={m.net >= 0 ? y(m.net) - 6 : y(m.net) + 14} className="t-val">{signedK(m.net)}</text>
                  <text x="20" y={H + 18} className="t-axis">{mlabel(m.month)}{m.partial ? '*' : ''}</text>
                  <text x="20" y={H + 36} className="t-sub">{k(m.income)}/{k(m.expense)}</text>
                </g>
              )
            })}
          </svg>
        </div>
        <p className="small muted">Под месяцем: доход и расходы. В среднем за год {signedK(d.averages.net)} тыс. в месяц: доход {k(d.averages.income)}, расходы {k(d.averages.expense)}.</p>
      </div>
    </section>
  )
}

// ---------- 5. Капитал ----------
function Capital({ d }) {
  const g = d.capital.groups
  const block = (title, list) => (
    <div className="section">
      <div className="section-head"><h3>{title}</h3><span className="num">{rub(list.reduce((a, x) => a + x.amount, 0))}</span></div>
      <table className="src-table"><tbody>
        {list.map((x) => <tr key={x.name}><td>{x.name}</td><td className="num">{rub(x.amount)}</td></tr>)}
      </tbody></table>
    </div>
  )
  return (
    <section className="section" aria-labelledby="cap-h">
      <div className="section-head"><h2 id="cap-h">Из чего состоят {mln(d.capital.total)}</h2></div>
      <div className="card">
        <div className="grid g2">
          {block('Свободные деньги', [...g.free, ...g.business])}
          {block('Сбережения и инвестиции', [...g.invest, ...g.long, ...g.cushion, ...g.other])}
        </div>
        {g.debts.length > 0 && block('Долги', g.debts)}
      </div>
    </section>
  )
}

// ---------- 6. Инвестиции ----------
function Invest({ inv }) {
  if (!inv || !inv.connected) {
    return (
      <section className="section" aria-labelledby="inv-h">
        <div className="section-head"><h2 id="inv-h">Инвестиции</h2></div>
        <div className="card">
          <div className="row between">
            <div className="section" style={{ gap: 'var(--space-2xs)' }}>
              <span className="stat-label">Облигации, копилка, ИИС</span>
              <span className="figure">{rub(inv?.total)}</span>
            </div>
          </div>
          <p className="small muted">Купоны по месяцам, выпуски и сроки погашения появятся после подключения Т-Инвестиций: токен «только для чтения» добавляется в секреты Supabase под именем TINVEST_TOKEN.</p>
        </div>
      </section>
    )
  }
  const cm = inv.coupons_by_month || []
  const max = Math.max(...cm.map((x) => x.amount), 1) * 1.15
  const H = 160
  return (
    <section className="section" aria-labelledby="inv-h">
      <div className="section-head">
        <h2 id="inv-h">Облигации приносят {k(inv.coupons_month)} тыс. в месяц</h2>
        {inv.fetched_at && <span className="muted small">Т-Инвестиции на {new Date(inv.fetched_at).toLocaleDateString('ru-RU')}</span>}
      </div>
      <div className="grid g4">
        <Kpi label="В облигациях" value={k(inv.bonds_total)} note="тыс. ₽ по рыночной цене" />
        <Kpi label="Средний купон" value={inv.coupon_rate != null ? `${inv.coupon_rate.toLocaleString('ru-RU')}%` : '—'} note="без амортизируемых выпусков" />
        <Kpi label="Срок до погашения" value={inv.duration_years != null ? `${inv.duration_years.toLocaleString('ru-RU')} г.` : '—'} note="в среднем, взвешенно по сумме" />
        <Kpi label="Купоны за год" value={k(inv.coupons_year)} note={`после НДФЛ 13% ≈ ${k(inv.coupons_year * 0.87)} тыс.`} />
      </div>
      {cm.length > 0 && (
        <div className="card">
          <h3>Купоны по месяцам, тыс. ₽</h3>
          <div className="scroll">
            <svg className="chart" viewBox={`0 0 ${cm.length * 48} ${H + 30}`} role="img" aria-label="Купоны по месяцам" style={{ minWidth: 520 }}>
              {cm.map((x, i) => (
                <g key={x.month} transform={`translate(${i * 48 + 8},0)`}>
                  <rect x="0" width="32" y={H - (x.amount / max) * H} height={(x.amount / max) * H} rx="2" className="b-pos" />
                  <text x="16" y={H - (x.amount / max) * H - 6} className="t-val">{k(x.amount)}</text>
                  <text x="16" y={H + 18} className="t-axis">{mlabel(x.month)}</text>
                </g>
              ))}
            </svg>
          </div>
          <p className="small muted">Ожидается по текущему портфелю без реинвестиций. Падение к концу периода: выпуски гасятся.</p>
        </div>
      )}
      {inv.bonds?.length > 0 && (
        <div className="section">
          <h3>Выпуски в портфеле: {inv.bonds.length}</h3>
          <div className="scroll">
            <table className="table" style={{ minWidth: 760 }}>
              <thead><tr><th>Выпуск</th><th>Сумма, тыс.</th><th>Цена, %</th><th>Купон</th><th>Погашение</th><th>Купоны в год, тыс.</th><th>Риск</th></tr></thead>
              <tbody>
                {inv.bonds.map((b) => (
                  <tr key={b.figi || b.name}>
                    <td style={{ paddingLeft: 0 }}>{b.name}{b.amortization ? <span className="tag" style={{ marginLeft: 'var(--space-xs)' }}>аморт.</span> : null}{b.floating ? <span className="tag" style={{ marginLeft: 'var(--space-xs)' }}>флоатер</span> : null}</td>
                    <td className="num">{k(b.value)}</td>
                    <td className="num">{b.price?.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) ?? '—'}</td>
                    <td className="num">{b.coupon_rate != null ? `${b.coupon_rate.toLocaleString('ru-RU')}%` : '—'}</td>
                    <td className="num">{b.maturity ? new Date(b.maturity).toLocaleDateString('ru-RU', { month: '2-digit', year: '2-digit' }) : '—'}</td>
                    <td className="num">{b.coupons_year != null ? k(b.coupons_year) : '—'}</td>
                    <td>{b.risk ? <span className={'tag' + (b.risk === 'высокий' ? ' warn' : '')}>{b.risk}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {inv.zero_value?.length > 0 && (
        <p className="small muted">Не учтены бумаги с нулевой ценой: {inv.zero_value.map((z) => `${z.name}, ${z.qty} шт.`).join('; ')}.</p>
      )}
      {inv.maturities?.length > 0 && (
        <div className="card">
          <h3>Когда вернутся деньги</h3>
          <div className="budget-list">
            {inv.maturities.map((m) => {
              const mx = Math.max(...inv.maturities.map((x) => x.amount))
              return (
                <div className="budget-row" key={m.year}>
                  <span className="b-name">{m.year}</span>
                  <div className="b-bar"><span className="b-fact" style={{ width: `${(m.amount / mx) * 100}%` }} /></div>
                  <span className="b-num num">{k(m.amount)}</span><span />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

// ---------- 7. Путь к 1 млн ----------
function PathToMillion({ d }) {
  const b = d.income_base
  const gap = Math.max(0, b.goal - b.total)
  return (
    <section className="section" aria-labelledby="pm-h">
      <div className="section-head">
        <h2 id="pm-h">Цель 1 000 000 ₽ в месяц: {k(b.total)} из {k(b.goal)} тыс.</h2>
        <span className="muted small">{pct(b.total, b.goal)}%</span>
      </div>
      <div className="card">
        <div className="stack" style={{ height: 22 }} role="img" aria-label={`База ${k(b.total)} тыс., до цели не хватает ${k(gap)} тыс.`}>
          {b.items.map((x, i) => <span key={x.name} style={{ flexGrow: x.amount, background: SRC[i] }} title={x.name} />)}
          {gap > 0 && <span style={{ flexGrow: gap, background: 'transparent', border: '1px dashed var(--color-rule)' }} title="до цели" />}
        </div>
        <div className="legend-row small">
          {b.items.map((x, i) => <span key={x.name}><i className="lg" style={{ background: SRC[i] }} />{shortName(x.name)} {k(x.amount)}</span>)}
          {gap > 0 && <span><i className="lg gap" />до цели не хватает {k(gap)}</span>}
        </div>
        <p className="small muted">База: плановые доходы месяца в Zenmoney без разовых поступлений и возвратов долгов.</p>
      </div>
    </section>
  )
}

// ---------- 8. Риски и действия ----------
const LEVEL = { high: 'Высокий', medium: 'Средний', low: 'Низкий' }
function RisksActions({ n }) {
  return (
    <div className="cols">
      {n.risks?.length > 0 && (
        <section className="main" aria-labelledby="risk-h">
          <h2 id="risk-h">Что может ухудшить картину</h2>
          <div className="grid g2">
            {n.risks.map((r, i) => (
              <article className="card" key={i} style={{ gap: 'var(--space-xs)' }}>
                <span className={'tag ' + (r.level === 'high' ? 'bad' : r.level === 'medium' ? 'warn' : 'ok')} style={{ alignSelf: 'flex-start' }}>{LEVEL[r.level] || r.level}</span>
                <h3>{r.title}</h3>
                <p className="small" style={{ color: 'var(--color-ink-2)' }}>{r.text}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      {n.actions?.length > 0 && (
        <section className="side" aria-labelledby="act-h">
          <h2 id="act-h">Что сделать сейчас</h2>
          <ol className="card actions">
            {n.actions.map((a, i) => (
              <li key={i}>
                <h3>{a.title}</h3>
                <p className="small muted">{a.text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}

// ---------- Общие ----------
function Kpi({ label, value, note, tone }) {
  return (
    <div className="card kpi">
      <span className="stat-label">{label}</span>
      <span className={'figure' + (tone === 'bad' ? ' bad' : tone === 'ok' ? ' ok' : '')}>{value}</span>
      {note && <span className="small muted">{note}</span>}
    </div>
  )
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
