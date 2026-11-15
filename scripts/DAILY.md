# Ежедневное обновление раздела «Финансы»

Каждое утро:

1. **06:45 МСК** — Supabase (pg_cron `tinvest-sync-daily`) вызывает функцию `tinvest-sync`. Она забирает портфель облигаций из Т-Инвестиций по секрету `TINVEST_TOKEN` и кладёт его в таблицу `invest_raw`.
2. **≈07:10 МСК** — задача Claude по расписанию:
   - берёт из Zenmoney `get_monthly_report` за последние 12 финансовых месяцев (включая текущий) и `list_accounts`, сохраняет как `report.json` и `accounts.json`;
   - забирает портфель: `POST /rest/v1/rpc/fin_export_invest {"p_key": KEY}` → `invest.json`;
   - пишет `narrative.json`: заголовок, сводку в 3–4 предложения, 4–6 рисков и 3–5 действий по свежим цифрам (только факты из данных, без выдуманных чисел);
   - собирает снимок: `python3 scripts/build_snapshot.py report.json accounts.json invest.json narrative.json > snapshot.json`;
   - сохраняет: `POST /rest/v1/rpc/fin_ingest_snapshot {"p_key": KEY, "p_data": <snapshot>}`.

Ключ `KEY` хранится только в таблице `private.config` и в тексте задачи, в репозиторий не попадает.

Настройки группировки счетов и разовых доходов — вверху `scripts/build_snapshot.py`.
