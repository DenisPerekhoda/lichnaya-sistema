// Забирает портфель облигаций из Т-Инвестиций (токен «только для чтения» в секрете TINVEST_TOKEN)
// и сохраняет его в таблицу invest_raw для владельца системы.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const HOSTS = ["https://invest-public-api.tbank.ru", "https://invest-public-api.tinkoff.ru"];
const PATH = "/rest/tinkoff.public.invest.api.contract.v1.";
let host = HOSTS[0];
const token = Deno.env.get("TINVEST_TOKEN");

type Q = { units?: string | number; nano?: number } | undefined;
const num = (q: Q) => (q ? Number(q.units || 0) + (q.nano || 0) / 1e9 : 0);

// API Т-Инвестиций подписан сертификатом Минцифры (Russian Trusted Root CA), которого нет
// в стандартном хранилище облака. Берём корневой и выпускающие сертификаты с официального сайта Госуслуг.
const CA_URLS = [
  "https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt",
  "https://gu-st.ru/content/lending/russian_trusted_sub_ca_pem.crt",
  "https://gu-st.ru/content/lending/russian_trusted_sub_ca_2024_pem.crt",
];
let client: any = null;
async function httpClient() {
  if (client) return client;
  const certs: string[] = [];
  for (const u of CA_URLS) {
    try {
      const r = await fetch(u);
      const t = await r.text();
      if (r.ok && t.includes("BEGIN CERTIFICATE")) certs.push(t);
    } catch (_) { /* следующий */ }
  }
  if (!certs.length) throw new Error("Не удалось скачать сертификаты Минцифры с gu-st.ru");
  // @ts-ignore: Deno.createHttpClient доступен в рантайме
  client = Deno.createHttpClient({ caCerts: certs });
  return client;
}

async function call(method: string, body: unknown): Promise<any> {
  let r: Response;
  try {
    r = await fetch(host + PATH + method, {
      // @ts-ignore: собственный HTTP-клиент с сертификатами Минцифры
      client: await httpClient(),
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (String(e).includes("Минцифры")) throw e;
    const next = HOSTS[HOSTS.indexOf(host) + 1];
    if (!next) throw e;
    host = next; // запасной адрес API
    return call(method, body);
  }
  if (!r.ok) throw new Error(`${method}: ${r.status} ${await r.text()}`);
  return r.json();
}
const RISK: Record<string, string> = {
  RISK_LEVEL_HIGH: "высокий", RISK_LEVEL_MODERATE: "средний", RISK_LEVEL_LOW: "низкий",
};

Deno.serve(async () => {
  try {
    if (!token) throw new Error("Нет секрета TINVEST_TOKEN");
    const { accounts } = await call("UsersService/GetAccounts", {});
    const open = (accounts || []).filter((a: any) => a.status === "ACCOUNT_STATUS_OPEN");

    const now = new Date();
    const from = new Date(now); from.setMonth(from.getMonth() - 12); from.setDate(1);
    const to = new Date(now); to.setMonth(to.getMonth() + 12);
    const bondsByFigi: Record<string, any> = {};
    let total = 0, cash = 0;
    const accountsOut: any[] = [];

    for (const a of open) {
      const p = await call("OperationsService/GetPortfolio", { accountId: a.id, currency: "RUB" });
      const accTotal = num(p.totalAmountPortfolio);
      total += accTotal;
      cash += num(p.totalAmountCurrencies);
      accountsOut.push({ id: a.id, name: a.name, type: a.type, total: accTotal });
      for (const pos of p.positions || []) {
        if (pos.instrumentType !== "bond") continue;
        const qty = num(pos.quantity);
        if (qty <= 0) continue;
        const price = num(pos.currentPrice); // ₽ за одну бумагу
        const nkd = num(pos.currentNkd);
        const b = bondsByFigi[pos.figi] || (bondsByFigi[pos.figi] = { figi: pos.figi, qty: 0, value: 0, price_rub: price });
        b.qty += qty;
        b.value += qty * (price + nkd);
      }
    }

    const months: Record<string, { amount: number; received: boolean }> = {};
    const bonds: any[] = [];
    for (const b of Object.values(bondsByFigi)) {
      const { instrument: i } = await call("InstrumentsService/BondBy", { idType: "INSTRUMENT_ID_TYPE_FIGI", id: b.figi });
      const nominal = num(i.nominal) || 1000;
      let events: any[] = [];
      try {
        events = (await call("InstrumentsService/GetBondCoupons", { figi: b.figi, from: from.toISOString(), to: to.toISOString() })).events || [];
      } catch (_) { /* у некоторых выпусков нет графика */ }
      let nextYear = 0, lastPay = 0;
      for (const e of events) {
        const d = new Date(e.couponDate);
        const pay = num(e.payOneBond) * b.qty;
        if (!pay) continue;
        const key = d.toISOString().slice(0, 7);
        const received = d <= now;
        months[key] = { amount: (months[key]?.amount || 0) + pay, received };
        if (!received && d <= new Date(now.getTime() + 365 * 864e5)) nextYear += pay;
        if (!received && !lastPay) lastPay = num(e.payOneBond);
      }
      const perYear = i.couponQuantityPerYear || 0;
      const maturity = i.maturityDate ? String(i.maturityDate).slice(0, 10) : null;
      bonds.push({
        figi: b.figi,
        isin: i.isin,
        name: i.name,
        qty: b.qty,
        value: Math.round(b.value),
        price: nominal ? Math.round((b.price_rub / nominal) * 1000) / 10 : null,
        nominal,
        nominal_total: Math.round(nominal * b.qty),
        coupon_rate: lastPay && perYear ? Math.round(((lastPay * perYear) / nominal) * 1000) / 10 : null,
        coupons_year: Math.round(nextYear),
        maturity,
        duration_years: maturity ? Math.max(0, (new Date(maturity).getTime() - now.getTime()) / (365.25 * 864e5)) : null,
        amortization: !!i.amortizationFlag,
        floating: !!i.floatingCouponFlag,
        risk: RISK[i.riskLevel] || null,
      });
    }

    const coupons_by_month = Object.entries(months).sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, amount: Math.round(v.amount), received: v.received }));

    const data = { fetched_at: now.toISOString(), total: Math.round(total), cash: Math.round(cash), accounts: accountsOut, bonds, coupons_by_month };

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: owner, error: e1 } = await sb.rpc("owner_id");
    if (e1) throw e1;
    const { error: e2 } = await sb.from("invest_raw").upsert({ user_id: owner, fetched_at: now.toISOString(), data });
    if (e2) throw e2;

    return Response.json({ ok: true, bonds: bonds.length, total: data.total, months: coupons_by_month.length });
  } catch (e) {
    return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
});
