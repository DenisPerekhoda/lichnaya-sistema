#!/usr/bin/env python3
"""Собирает снимок финансов для раздела «Финансы».

Вход:
  report.json    — ответ Zenmoney get_monthly_report за 12 месяцев (последний — текущий)
  accounts.json  — ответ Zenmoney list_accounts
  invest.json    — (необязательно) строка invest_raw.data из Supabase (портфель Т-Инвестиций)
  narrative.json — (необязательно) {"headline","summary","risks":[{level,title,text}],"actions":[{title,text}]}
Выход: snapshot.json в stdout.

Запуск: python3 scripts/build_snapshot.py report.json accounts.json [invest.json] [narrative.json] > snapshot.json
"""
import json, sys, calendar, datetime as dt

# ---- Настройки группировки (правятся здесь) ----
INVEST = ['Корпоративные облигации', 'Инвесткопилка', 'ИИС']
LONG = ['Пенсионные накопления', 'Долгосрочные сбережения']
CUSHION = ['Финансовая подушка', 'Школьные выпускные дети']
BUSINESS_PREFIX = 'ИП '
# Доходы, которые не входят в «базу» (разовые, возвраты долгов, семья)
NON_BASE_INCOME = ['ООО «Ника»', 'Яна', 'Кэшбек', 'Корректировка']
INCOME_GOAL = 1_000_000
MONTH_NET_GOAL = 50_000
# Ключевая ставка ЦБ для оценки «упущенного дохода» свободных денег
KEY_RATE = {'value': 14.0, 'date': '2026-10-23'}


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def main():
    report = load(sys.argv[1])
    accounts = load(sys.argv[2])['data']
    invest = load(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] != '-' else None
    narrative = load(sys.argv[4]) if len(sys.argv) > 4 else {}

    cats = report['references']['categories']
    cname = lambda cid: (cats.get(cid) or {}).get('name') or 'Без категории'
    months = list(report['months'].keys())
    cur = months[-1]
    today = dt.date.today()
    y, m = map(int, cur.split('-'))
    days_total = calendar.monthrange(y, m)[1]
    day = today.day if (today.year, today.month) == (y, m) else days_total
    days_left = days_total - day

    def top_rows(rows, income):
        out = []
        for r in rows:
            t = r['rowId']['type']
            if r['rowId']['isIncome'] != income or t['type'] != 'Tag':
                continue
            if r.get('parentRowId', {}).get('type', {}).get('type') != 'TagTotal':
                continue
            out.append({'name': cname(t.get('categoryId')) if t.get('categoryId') else 'Без категории',
                        'fact': round(r['factWithRefund']), 'budget': round(r['budget']),
                        'planned': round(r['planned']), 'processed': round(r['processed'])})
        return out

    def total(rows, income):
        for r in rows:
            if r['rowId']['isIncome'] == income and r['rowId']['type']['type'] == 'TagTotal':
                return r
        return {'factWithRefund': 0, 'budget': 0, 'planned': 0, 'processed': 0}

    # ---- По месяцам ----
    by_month = []
    for mon in months:
        rows = report['months'][mon]
        inc, exp = total(rows, True), total(rows, False)
        by_month.append({
            'month': mon,
            'income': round(inc['factWithRefund']),
            'expense': round(exp['factWithRefund']),
            'net': round(inc['factWithRefund'] - exp['factWithRefund']),
            'sources': {x['name']: x['fact'] for x in top_rows(rows, True) if x['fact'] > 0},
            'expenses': {x['name']: x['fact'] for x in top_rows(rows, False) if x['fact'] > 0},
            'partial': mon == cur and days_left > 0,
        })

    # ---- Текущий месяц ----
    rows = report['months'][cur]
    inc, exp = total(rows, True), total(rows, False)
    exp_cats = sorted([c for c in top_rows(rows, False) if c['fact'] or c['budget'] or c['planned']],
                      key=lambda c: -max(c['fact'], c['budget']))
    inc_cats = sorted([c for c in top_rows(rows, True) if c['fact'] or c['budget'] or c['planned']], key=lambda c: -c['budget'])
    unscheduled = max(0, exp['factWithRefund'] - exp['processed'])
    pace = unscheduled / max(day, 1)
    f_exp = exp['factWithRefund'] + exp['planned'] + pace * days_left
    f_inc = inc['factWithRefund'] + inc['planned']
    for c in exp_cats:
        c['forecast'] = c['fact'] + c['planned']
        c['pct'] = round(100 * c['fact'] / c['budget']) if c['budget'] else None

    # ---- Капитал ----
    live = [a for a in accounts if not a.get('isArchived') and abs(a.get('balance') or 0) >= 1 and a.get('type') not in ('loan',)]
    def acc_name(a):
        inst = (a.get('institution') or {}).get('name')
        return f"{a['name']} ({inst})" if a['name'].startswith(BUSINESS_PREFIX) and inst else a['name']
    groups = {'free': [], 'business': [], 'invest': [], 'long': [], 'cushion': [], 'other': [], 'debts': []}
    for a in live:
        n, b = a['name'], round(a['balance'])
        if a.get('type') == 'debt':
            groups['debts'].append({'name': n, 'amount': b})
        elif n in INVEST:
            groups['invest'].append({'name': n, 'amount': b})
        elif n in LONG:
            groups['long'].append({'name': n, 'amount': b})
        elif n in CUSHION:
            groups['cushion'].append({'name': n, 'amount': b})
        elif n.startswith(BUSINESS_PREFIX):
            groups['business'].append({'name': acc_name(a), 'amount': b})
        elif a.get('isInBalance'):
            groups['free'].append({'name': n, 'amount': b})
        else:
            groups['other'].append({'name': n, 'amount': b})
    for g in groups.values():
        g.sort(key=lambda x: -x['amount'])
    gsum = {k: sum(x['amount'] for x in v) for k, v in groups.items()}
    capital = sum(gsum.values())

    # ---- База доходов (план текущего месяца без разовых) ----
    base = [{'name': c['name'], 'amount': c['budget']} for c in inc_cats if c['budget'] and c['name'] not in NON_BASE_INCOME]
    base_total = sum(x['amount'] for x in base)
    last12 = by_month[:-1] if by_month[-1]['partial'] else by_month
    avg_inc = round(sum(x['income'] for x in last12) / max(len(last12), 1))
    avg_exp = round(sum(x['expense'] for x in last12) / max(len(last12), 1))

    cushion_days = round(gsum['cushion'] / max(avg_exp / 30, 1)) if avg_exp else None

    snap = {
        'version': 1,
        'as_of': today.isoformat(),
        'month': cur,
        'day': day,
        'days_total': days_total,
        'capital': {'total': capital, 'groups': groups, 'sums': gsum},
        'current': {
            'income': round(inc['factWithRefund']), 'expense': round(exp['factWithRefund']),
            'net': round(inc['factWithRefund'] - exp['factWithRefund']),
            'income_planned': round(inc['planned']), 'expense_planned': round(exp['planned']),
            'budget': round(exp['budget']), 'income_budget': round(inc['budget']),
            'forecast_income': round(f_inc), 'forecast_expense': round(f_exp),
            'forecast_net': round(f_inc - f_exp), 'pace_per_day': round(pace),
            # По плану: факт + запланированное в Zenmoney, без экстраполяции темпа
            'forecast_net_plan': round(f_inc - (exp['factWithRefund'] + exp['planned'])),
            'goal_net': MONTH_NET_GOAL,
            'categories': exp_cats, 'income_categories': inc_cats,
        },
        'months': by_month,
        'income_base': {'items': base, 'total': base_total, 'goal': INCOME_GOAL},
        'averages': {'income': avg_inc, 'expense': avg_exp, 'net': avg_inc - avg_exp,
                     'expense_limit_for_goal': base_total - MONTH_NET_GOAL},
        'cushion_days': cushion_days,
        'key_rate': KEY_RATE,
        'invest': build_invest(invest, gsum['invest']),
        'narrative': narrative,
    }
    json.dump(snap, sys.stdout, ensure_ascii=False, indent=1)


def build_invest(raw, zen_total):
    """raw — ответ функции tinvest-sync. Без него — только остатки из Zenmoney."""
    if not raw:
        return {'connected': False, 'total': zen_total}
    today = dt.date.today()
    cur_m = today.strftime('%Y-%m')
    all_bonds = raw.get('bonds', [])
    bonds = [b for b in all_bonds if b.get('value', 0) > 0]
    zero = [b for b in all_bonds if b.get('value', 0) <= 0]
    for b in bonds:
        # Для амортизируемых купон по одной выплате даёт неверную ставку
        if b.get('amortization'):
            b['coupon_rate'] = None
    total_bonds = sum(b['value'] for b in bonds)

    def w(key):
        xs = [b for b in bonds if b.get(key) is not None]
        tw = sum(b['value'] for b in xs)
        return sum(b[key] * b['value'] for b in xs) / tw if tw else None

    coupons_year = sum(b.get('coupons_year', 0) for b in bonds)
    by_year = {}
    for b in bonds:
        yy = (b.get('maturity') or '')[:4]
        if yy and yy >= str(today.year):
            by_year[yy] = by_year.get(yy, 0) + b.get('nominal_total', b['value'])
    # Только будущие месяцы: прошлые суммы по нынешнему количеству бумаг недостоверны
    future = [x for x in raw.get('coupons_by_month', []) if x['month'] >= cur_m][:12]
    risk_value = {}
    for b in bonds:
        r = b.get('risk') or 'нет данных'
        risk_value[r] = risk_value.get(r, 0) + b['value']
    return {
        'connected': True,
        'fetched_at': raw.get('fetched_at'),
        'total': raw.get('total', total_bonds),
        'bonds_total': round(total_bonds),
        'cash': round(raw.get('cash', 0)),
        'coupon_rate': round(w('coupon_rate'), 1) if w('coupon_rate') else None,
        'duration_years': round(w('duration_years'), 2) if w('duration_years') else None,
        'coupons_year': round(coupons_year),
        'coupons_month': round(coupons_year / 12),
        'coupons_by_month': [dict(x, received=False) for x in future],
        'maturities': [{'year': k, 'amount': round(v)} for k, v in sorted(by_year.items())],
        'bonds': sorted(bonds, key=lambda b: -b['value']),
        'zero_value': [{'name': b['name'], 'qty': b['qty'], 'isin': b.get('isin')} for b in zero],
        'risk_value': {k: round(v) for k, v in risk_value.items()},
    }


if __name__ == '__main__':
    main()
