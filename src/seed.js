import { supabase } from './supabase'

// Стартовые данные — на основе того, что уже известно о проектах.
// Кнопка в разделе «Витрина и данные». Можно править и удалять в интерфейсе.
export async function seed(userId) {
  const projects = [
    { name: 'ЭкоФуд', model: 'фикс', fixed_income: 250000, goal: '3 внешних клиента хлебозавода к 06.2027', next_step: 'Самокат — цены по оставшимся SKU', status: 'в работе', sort: 1 },
    { name: 'Мясо для тебя', model: 'фикс + 6% с оборота', fixed_income: 100000, variable_income: 0, goal: 'оборот 20 млн ₽ в месяц', next_step: 'Меридиан — пробная партия', status: 'в работе', sort: 2 },
    { name: 'Ройал Реббит', model: 'фикс, временно', fixed_income: 80000, goal: '', next_step: '', status: 'временно', sort: 3 },
    { name: 'ВСТРЕЧА', model: 'доля 2%', goal: 'Перекрёсток, Азбука Вкуса', next_step: '', status: 'ожидание', sort: 4 },
    { name: 'Консалтинг / команда под ключ', model: 'проект + %', goal: 'первая сделка 300 000 ₽', next_step: 'список 10 клиентов из базы 10.85', status: 'старт', sort: 5 },
    { name: 'Аренда квартиры', model: 'пассивный', fixed_income: 43000, status: 'в работе', sort: 6 },
  ]
  const { data: p, error } = await supabase.from('projects').insert(projects.map((x) => ({ ...x, user_id: userId }))).select()
  if (error) throw error
  const id = (name) => p.find((x) => x.name === name)?.id

  await supabase.from('deals').insert([
    { title: 'Лента — СТМ стейки', stage: 'talks', project_id: id('Мясо для тебя') },
    { title: 'Global Foods — котлеты для бургеров', stage: 'pilot', project_id: id('Мясо для тебя') },
    { title: 'Меридиан — нарезка стейков', stage: 'pilot', project_id: id('Мясо для тебя') },
    { title: 'ВкусВилл — 3 SKU', stage: 'contract', project_id: id('Мясо для тебя') },
    { title: 'Самокат — заморозка', stage: 'pilot', project_id: id('ЭкоФуд') },
    { title: 'Яндекс Лавка — котлеты', stage: 'pilot', project_id: id('ЭкоФуд') },
    { title: 'Перекрёсток — су-вид', stage: 'talks', project_id: id('ВСТРЕЧА') },
    { title: '10 клиентов из базы 10.85', stage: 'contact', project_id: id('Консалтинг / команда под ключ') },
  ].map((x) => ({ ...x, user_id: userId })))

  const { data: g } = await supabase.from('goals').insert([
    { title: 'Доход из 2+ независимых источников', sort: 1 },
    { title: 'Профессиональная автономия и личный бренд', sort: 2 },
    { title: 'Капитал и внутренняя устойчивость', sort: 3 },
  ].map((x) => ({ ...x, user_id: userId }))).select()
  const gid = (n) => g.find((x) => x.sort === n)?.id
  await supabase.from('key_results').insert([
    { goal_id: gid(1), title: 'Доход в месяц, ₽', current: 520000, target: 600000 },
    { goal_id: gid(1), title: 'Новые контакты с ЛПР', current: 0, target: 10 },
    { goal_id: gid(1), title: 'Сделка на 300 000 ₽ (этап, %)', current: 10, target: 100 },
    { goal_id: gid(2), title: 'Одностраничник кейсов (%)', current: 0, target: 100 },
    { goal_id: gid(2), title: 'Сайт-визитка (%)', current: 0, target: 100 },
    { goal_id: gid(2), title: 'Посты в канале', current: 0, target: 6 },
    { goal_id: gid(3), title: 'Обзоров недели проведено', current: 0, target: 12 },
  ].map((x) => ({ ...x, user_id: userId })))

  const t = new Date().toISOString().slice(0, 10)
  await supabase.from('tasks').insert([
    { title: 'Внести все проекты и сделки в систему', due: t },
    { title: 'Записать, что значит 300 000 и к какой дате', due: t },
    { title: 'Список 10 клиентов и 5 первых сообщений', project_id: id('Консалтинг / команда под ключ') },
    { title: 'Черновик одностраничника кейсов' },
  ].map((x) => ({ ...x, user_id: userId })))

  await supabase.from('settings').update({ capital: 2000000, main_action: 'Структурировать работу: все проекты в одну систему' }).eq('user_id', userId)

  await supabase.from('profile').upsert({
    user_id: userId,
    name: 'Денис Перехода',
    headline: 'Запускаю и масштабирую пищевые проекты',
    about: 'Стратегия, коммерция, маркетинг и команда — одним комплексом.',
    contact: '',
    is_public: false,
  })
  await supabase.from('showcase_cases').insert([
    { value: '45 млн ₽ / мес', label: 'оборот, выстроенный с нуля', sort: 1 },
    { value: '18+ лет', label: 'в пищевом производстве и FMCG', sort: 2 },
    { value: '12 лет', label: 'генеральным директором', sort: 3 },
  ].map((x) => ({ ...x, user_id: userId })))
}
