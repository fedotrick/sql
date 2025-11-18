# Полный курс SQL: От новичка до профессионала (Часть 7)

## Оглавление

### Раздел 8: Интеграция и дополнительные возможности (продолжение)
- Глава 70: Подготовка к собеседованиям по SQL

### Раздел 9: Практические проекты и кейсы (продолжение)
- Глава 71: Проект 1: Анализ продаж (продолжение)
- Глава 72: Проект 2: Финансовый отчет (начало)
- Глава 73: Проект 3: Аналитика пользователей
- Глава 74: Проект 4: Управление инвентарем
- Глава 75: Решение реальных бизнес-задач

# Раздел 8: Интеграция и дополнительные возможности (продолжение)

## Глава 70: Подготовка к собеседованиям по SQL

### Введение

Подготовка к собеседованию по SQL требует как теоретических знаний, так и практических навыков решения задач. В этой главе мы рассмотрим типичные вопросы на собеседованиях по SQL, примеры задач разного уровня сложности и подходы к их решению.

### Типичные вопросы на собеседованиях

#### 1. Основы SQL

**Вопрос 1: Чем отличаются WHERE и HAVING?**

**Ответ:**
- `WHERE` фильтрует строки до группировки (`GROUP BY`)
- `HAVING` фильтрует группы после группировки

```sql
-- Неправильное использование
SELECT город, COUNT(*) 
FROM клиенты 
WHERE COUNT(*) > 5  -- ОШИБКА: агрегатные функции нельзя использовать в WHERE

-- Правильное использование
SELECT город, COUNT(*) 
FROM клиенты 
GROUP BY город 
HAVING COUNT(*) > 5;  -- Правильно: HAVING используется для фильтрации групп
```

**Вопрос 2: В чем разница между INNER JOIN и LEFT JOIN?**

**Ответ:**
- `INNER JOIN` возвращает только строки с совпадениями в обеих таблицах
- `LEFT JOIN` возвращает все строки из левой таблицы и соответствующие из правой

```sql
-- INNER JOIN: только клиенты с заказами
SELECT к.фамилия, з.дата_заказа
FROM клиенты к
INNER JOIN заказы з ON к.id = з.id_клиента;

-- LEFT JOIN: все клиенты, включая тех без заказов
SELECT к.фамилия, з.дата_заказа
FROM клиенты к
LEFT JOIN заказы з ON к.id = з.id_клиента;
```

**Вопрос 3: Что такое нормализация и зачем она нужна?**

**Ответ:**
Нормализация — это процесс организации данных для уменьшения избыточности и улучшения целостности. Основные формы:
- 1НФ: каждая ячейка содержит атомарное значение
- 2НФ: 1НФ + все не ключевые атрибуты зависят от полного первичного ключа
- 3НФ: 2НФ + нет транзитивных зависимостей

#### 2. Продвинутые вопросы

**Вопрос 4: Как работают оконные функции?**

**Ответ:**
Оконные функции выполняют вычисления над набором строк, связанных с текущей строкой. Используются для:

```sql
-- Ранжирование
SELECT фамилия, имя, общая_сумма,
       RANK() OVER (ORDER BY общая_сумма DESC) AS ранг
FROM клиенты к
JOIN заказы з ON к.id = з.id_клиента;

-- Скользящие агрегаты
SELECT дата_заказа, общая_сумма,
       AVG(общая_сумма) OVER (
           ORDER BY дата_заказа
           ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
       ) AS среднее_за_3_дня
FROM заказы;
```

**Вопрос 5: Что такое CTE (Common Table Expression)?**

**Ответ:**
CTE — временные именованные результаты, которые можно использовать внутри одного запроса:

```sql
WITH клиенты_с_заказами AS (
    SELECT к.id, к.фамилия, к.имя, COUNT(з.id) AS кол_заказов
    FROM клиенты к
    LEFT JOIN заказы з ON к.id = з.id_клиента
    GROUP BY к.id, к.фамилия, к.имя
)
SELECT фамилия, имя, кол_заказов
FROM клиенты_с_заказами
WHERE кол_заказов > 3;
```

### Практические задачи для собеседований

#### Задача 1: Поиск дубликатов

**Сценарий:** Найти дубликрующиеся email в таблице клиентов.

**Решение:**
```sql
-- Вариант 1: Показать только дубликаты
SELECT email, COUNT(*) as количество
FROM клиенты
GROUP BY email
HAVING COUNT(*) > 1;

-- Вариант 2: Показать все строки, включая дубликаты
SELECT *
FROM (
    SELECT *, 
           ROW_NUMBER() OVER (PARTITION BY email ORDER BY id) AS rn
    FROM клиенты
) ranked
WHERE rn > 1;

-- Вариант 3: Удалить дубликаты, оставив только один
DELETE FROM клиенты
WHERE id NOT IN (
    SELECT min_id FROM (
        SELECT MIN(id) as min_id
        FROM клиенты
        GROUP BY email
    ) AS unique_records
);
```

#### Задача 2: Решение задачи "Топ-N в каждой категории"

**Сценарий:** Найти топ-3 самых дорогих товаров в каждой категории.

**Решение:**
```sql
WITH ranked_products AS (
    SELECT 
        id,
        название,
        категория,
        цена,
        ROW_NUMBER() OVER (
            PARTITION BY категория 
            ORDER BY цена DESC
        ) AS rn
    FROM товары
)
SELECT id, название, категория, цена
FROM ranked_products
WHERE rn <= 3
ORDER BY категория, цена DESC;
```

#### Задача 3: Найти пропущенные ID

**Сценарий:** Найти пропущенные ID в последовательности.

**Решение:**
```sql
WITH sequence AS (
    SELECT generate_series(
        (SELECT MIN(id) FROM клиенты),
        (SELECT MAX(id) FROM клиенты)
    ) AS id
)
SELECT s.id
FROM sequence s
LEFT JOIN клиенты c ON s.id = c.id
WHERE c.id IS NULL
ORDER BY s.id;
```

#### Задача 4: Скользящий средний

**Сценарий:** Рассчитать 7-дневное скользящее среднее по сумме заказов.

**Решение:**
```sql
SELECT 
    дата_заказа,
    сумма_дня,
    AVG(сумма_дня) OVER (
        ORDER BY дата_заказа
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS скользящее_среднее_7_дней
FROM (
    SELECT 
        дата_заказа::date as дата_заказа,
        SUM(общая_сумма) as сумма_дня
    FROM заказы
    GROUP BY дата_заказа::date
) daily_totals
ORDER BY дата_заказа;
```

#### Задача 5: Сравнение с предыдущим периодом

**Сценарий:** Сравнить продажи текущего месяца с предыдущим.

**Решение:**
```sql
WITH monthly_sales AS (
    SELECT 
        EXTRACT(YEAR FROM дата_заказа) AS год,
        EXTRACT(MONTH FROM дата_заказа) AS месяц,
        SUM(общая_сумма) AS выручка
    FROM заказы
    GROUP BY 
        EXTRACT(YEAR FROM дата_заказа),
        EXTRACT(MONTH FROM дата_заказа)
)
SELECT 
    год,
    месяц,
    выручка AS текущая_выручка,
    LAG(выручка) OVER (ORDER BY год, месяц) AS предыдущая_выручка,
    ROUND(
        (выручка - LAG(выручка) OVER (ORDER BY год, месяц)) * 100.0 / 
        NULLIF(LAG(выручка) OVER (ORDER BY год, месяц), 0), 2
    ) AS рост_в_процентах
FROM monthly_sales
ORDER BY год DESC, месяц DESC;
```

### Задачи на аналитику

#### Задача 6: Cohort Analysis (анализ когорт)

**Сценарий:** Построить матрицу удержания клиентов.

**Решение:**
```sql
WITH client_cohorts AS (
    SELECT 
        id_клиента,
        DATE_TRUNC('month', дата_регистрации) AS cohort_month,
        COUNT(*) AS total_orders
    FROM клиенты
    GROUP BY id_клиента, DATE_TRUNC('month', дата_регистрации)
),
order_months AS (
    SELECT 
        id_клиента,
        DATE_TRUNC('month', дата_заказа) AS order_month,
        SUM(общая_сумма) AS monthly_revenue
    FROM заказы
    GROUP BY id_клиента, DATE_TRUNC('month', дата_заказа)
)
SELECT 
    cc.cohort_month,
    om.order_month,
    COUNT(*) AS retained_customers,
    SUM(om.monthly_revenue) AS revenue
FROM client_cohorts cc
JOIN order_months om ON cc.id_клиента = om.id_клиента
GROUP BY cc.cohort_month, om.order_month
ORDER BY cc.cohort_month, om.order_month;
```

#### Задача 7: Решение задачи "Пропавшие диапазоны"

**Сценарий:** Найти пропущенные интервалы в данных.

```sql
-- Предположим, у нас есть таблица событий с датами
WITH date_ranges AS (
    SELECT 
        event_date,
        LEAD(event_date) OVER (ORDER BY event_date) AS next_date
    FROM (
        SELECT DISTINCT event_date 
        FROM events 
        WHERE event_date BETWEEN '2023-01-01' AND '2023-12-31'
    ) dates
)
SELECT 
    event_date + INTERVAL '1 day' AS gap_start,
    next_date - INTERVAL '1 day' AS gap_end,
    (next_date - event_date - 1) AS gap_days
FROM date_ranges
WHERE next_date - event_date > 1;
```

### Оптимизация запросов

#### Вопрос: Как оптимизировать запрос?

**Ответ:**
1. Используйте `EXPLAIN` и `EXPLAIN ANALYZE`
2. Создавайте подходящие индексы
3. Избегайте функций в `WHERE`
4. Используйте `LIMIT` когда возможно

```sql
-- Плохо: функция в WHERE
SELECT * FROM клиенты WHERE LOWER(email) = 'ivanov@test.com';

-- Хорошо: индекс на выражении
CREATE INDEX idx_lower_email ON клиенты(LOWER(email));
SELECT * FROM клиенты WHERE LOWER(email) = 'ivanov@test.com';

-- Плохо: нет индекса на JOIN
SELECT * FROM заказы z JOIN клиенты c ON z.id_клиента = c.id;

-- Хорошо: индекс на внешнем ключе
CREATE INDEX idx_заказы_клиент ON заказы(id_клиента);
SELECT * FROM заказы z JOIN клиенты c ON z.id_клиента = c.id;
```

### Типичные ошибки

#### 1. Забытые агрегации

```sql
-- ОШИБКА: столбец в SELECT не в GROUP BY
SELECT фамилия, COUNT(*) -- фамилия не в GROUP BY
FROM клиенты
GROUP BY id;

-- ПРАВИЛЬНО:
SELECT фамилия, COUNT(*) -- фамилия в GROUP BY
FROM клиенты
GROUP BY фамилия;
```

#### 2. Неправильное использование DISTINCT

```sql
-- DISTINCT может быть избыточным, если используешь JOIN
SELECT DISTINCT c.фамилия, c.имя -- DISTINCT может быть лишним
FROM клиенты c
JOIN заказы o ON c.id = o.id_клиента;

-- Лучше использовать EXISTS или IN
SELECT c.фамилия, c.имя
FROM клиенты c
WHERE EXISTS (
    SELECT 1 FROM заказы o 
    WHERE o.id_клиента = c.id
);
```

#### 3. Использование подзапросов там, где можно JOIN

```sql
-- Менее эффективно
SELECT фамилия, имя
FROM клиенты
WHERE id IN (
    SELECT id_клиента FROM заказы WHERE общая_сумма > 10000
);

-- Более эффективно
SELECT DISTINCT c.фамилия, c.имя
FROM клиенты c
JOIN заказы z ON c.id = z.id_клиента
WHERE z.общая_сумма > 10000;
```

### Практические советы

#### 1. Структурирование сложных запросов

```sql
-- Хорошо: понятная структура
WITH customer_stats AS (
    SELECT 
        id_клиента,
        COUNT(*) AS order_count,
        SUM(общая_сумма) AS total_spent
    FROM заказы
    GROUP BY id_клиента
),
ranked_customers AS (
    SELECT 
        c.id,
        c.фамилия,
        c.имя,
        cs.total_spent,
        NTILE(10) OVER (ORDER BY cs.total_spent DESC) AS decile
    FROM клиенты c
    JOIN customer_stats cs ON c.id = cs.id_клиента
)
SELECT *
FROM ranked_customers
WHERE decile <= 3; -- топ-30%
```

#### 2. Проверка производительности

```sql
-- Используйте EXPLAIN ANALYZE для анализа
EXPLAIN (ANALYZE, BUFFERS)
SELECT фамилия, COUNT(*) 
FROM клиенты c
JOIN заказы o ON c.id = o.id_клиента
WHERE o.дата_заказа > '2023-01-01'
GROUP BY c.фамилия;

-- Проверка индексов
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'заказы';
```

### Типичные задачи на собеседованиях

#### Задача "Зигзаг" (ZigZag)

Найти строки, где значение меняет направление (увеличение/уменьшение):

```sql
WITH ordered_data AS (
    SELECT 
        id,
        значение,
        LAG(значение) OVER (ORDER BY id) AS prev_value,
        LEAD(значение) OVER (ORDER BY id) AS next_value
    FROM your_data
),
directions AS (
    SELECT 
        id,
        значение,
        CASE 
            WHEN значение > prev_value THEN 'UP'
            WHEN значение < prev_value THEN 'DOWN'
            ELSE 'FLAT'
        END AS current_direction,
        CASE 
            WHEN next_value > значение THEN 'UP'
            WHEN next_value < значение THEN 'DOWN'
            ELSE 'FLAT'
        END AS next_direction
    FROM ordered_data
    WHERE prev_value IS NOT NULL AND next_value IS NOT NULL
)
SELECT id, значение
FROM directions
WHERE current_direction != next_direction
  AND current_direction != 'FLAT'
  AND next_direction != 'FLAT';
```

#### Задача "Накопительная сумма с сбросом"

Когда нужно сбрасывать накопительную сумму при условии:

```sql
-- Предположим, нужно считать накопительный доход, но сбрасывать при убытке
WITH ranked_data AS (
    SELECT 
        id,
        дата,
        доход,
        ROW_NUMBER() OVER (ORDER BY дата) AS rn
    FROM daily_income
),
cumulative_calc AS (
    SELECT 
        id,
        дата,
        доход,
        rn,
        SUM(доход) OVER (ORDER BY rn ROWS UNBOUNDED PRECEDING) AS cumulative_total
    FROM ranked_data
)
SELECT 
    id,
    дата,
    доход,
    CASE 
        WHEN cumulative_total < 0 THEN 0
        ELSE cumulative_total
    END AS adjusted_cumulative
FROM cumulative_calc;
```

### Заключение

Подготовка к собеседованию по SQL требует:

1. Понимания основных концепций
2. Практики решения задач разного уровня
3. Знания продвинутых функций (оконные функции, CTE и т.д.)
4. Понимания принципов оптимизации запросов
5. Навыков анализа EXPLAIN планов

Успешное решение SQL задач на собеседовании требует не только знания синтаксиса, но и умения мыслить логически и эффективно использовать все возможности SQL для решения поставленных задач.

---

# Раздел 9: Практические проекты и кейсы (продолжение)

## Глава 71: Проект 1: Анализ продаж (продолжение)

### Продвинутый анализ продаж

#### 1. ABC-XYZ анализ товаров

ABC-XYZ анализ помогает в управлении инвентарем и планировании закупок:

```sql
-- ABC-XYZ анализ товаров
WITH sales_analysis AS (
    SELECT 
        t.id,
        t.название,
        t.цена,
        t.категория,
        SUM(zt.количество * zt.цена_на_момент) AS total_revenue,
        COUNT(zt.id) AS order_frequency,
        STDDEV(SUM(zt.количество * zt.цена_на_момент)) OVER (PARTITION BY t.id) AS revenue_volatility,
        AVG(SUM(zt.количество * zt.цена_на_момент)) OVER (PARTITION BY t.id) AS avg_revenue
    FROM товары t
    LEFT JOIN позиции_заказа zt ON t.id = zt.id_товара
    LEFT JOIN заказы z ON zt.id_заказа = z.id
    WHERE z.дата_создания >= CURRENT_DATE - INTERVAL '1 year'
    GROUP BY t.id, t.название, t.цена, t.категория
),
abc_xyz AS (
    SELECT *,
        CASE 
            WHEN PERCENT_RANK() OVER (ORDER BY total_revenue DESC) <= 0.8 THEN 'A'
            WHEN PERCENT_RANK() OVER (ORDER BY total_revenue DESC) <= 0.95 THEN 'B'
            ELSE 'C'
        END AS abc_category,
        CASE 
            WHEN revenue_volatility/NULLIF(avg_revenue,0) <= 0.1 THEN 'X'  -- стабильный спрос
            WHEN revenue_volatility/NULLIF(avg_revenue,0) <= 0.25 THEN 'Y'  -- умеренно изменчивый
            ELSE 'Z'  -- высокая вариативность
        END AS xyz_category
    FROM sales_analysis
    WHERE total_revenue IS NOT NULL AND total_revenue > 0
)
SELECT 
    abc_category,
    xyz_category,
    COUNT(*) AS quantity,
    SUM(total_revenue) AS total_revenue,
    AVG(order_frequency) AS avg_frequency
FROM abc_xyz
GROUP BY abc_category, xyz_category
ORDER BY abc_category, xyz_category;

-- Рекомендации по управлению по категории
CREATE VIEW рекомендации_abc_xyz AS
SELECT 
    id,
    название,
    abc_category,
    xyz_category,
    CASE 
        WHEN abc_category = 'A' AND xyz_category = 'X' THEN 'Поддерживающее управление, точный контроль'
        WHEN abc_category = 'A' AND xyz_category = 'Y' THEN 'Частый контроль, точное прогнозирование'
        WHEN abc_category = 'A' AND xyz_category = 'Z' THEN 'Контроль на основе прогнозов, страховой запас'
        WHEN abc_category = 'B' AND xyz_category = 'X' THEN 'Периодический контроль'
        WHEN abc_category = 'B' AND xyz_category = 'Y' THEN 'Умеренный контроль'
        WHEN abc_category = 'B' AND xyz_category = 'Z' THEN 'Прогнозирование, средний страховой запас'
        WHEN abc_category = 'C' AND xyz_category = 'X' THEN 'Простое управление'
        WHEN abc_category = 'C' AND xyz_category = 'Y' THEN 'Регулярный контроль'
        ELSE 'Минимальный контроль'
    END AS рекомендация
FROM abc_xyz;
```

#### 2. Cohort retention analysis

```sql
-- Анализ удержания клиентов по когортам
WITH cohort_analysis AS (
    SELECT 
        c.id AS customer_id,
        DATE_TRUNC('month', c.дата_регистрации) AS cohort_month,
        DATE_TRUNC('month', o.дата_заказа) AS order_month,
        EXTRACT(YEAR FROM o.дата_заказа) - EXTRACT(YEAR FROM c.дата_регистрации) AS year_diff,
        (EXTRACT(MONTH FROM o.дата_заказа) - EXTRACT(MONTH FROM c.дата_регистрации))
        + (year_diff * 12) AS month_number
    FROM клиенты c
    JOIN заказы o ON c.id = o.id_клиента
    WHERE c.дата_регистрации >= '2022-01-01'
),
cohort_retention AS (
    SELECT 
        cohort_month,
        month_number,
        COUNT(DISTINCT customer_id) AS active_customers,
        FIRST_VALUE(COUNT(DISTINCT customer_id)) OVER (
            PARTITION BY cohort_month 
            ORDER BY month_number 
            ROWS UNBOUNDED PRECEDING
        ) AS initial_cohort_size
    FROM cohort_analysis
    GROUP BY cohort_month, month_number
)
SELECT 
    cohort_month::date AS cohort,
    month_number AS month_after_join,
    initial_cohort_size AS initial_size,
    active_customers,
    ROUND(active_customers * 100.0 / initial_cohort_size, 2) AS retention_rate
FROM cohort_retention
ORDER BY cohort_month, month_number;
```

#### 3. RFM анализ (Recency, Frequency, Monetary)

RFM анализ для сегментации клиентов:

```sql
-- RFM анализ
WITH rfm_scores AS (
    SELECT 
        c.id AS customer_id,
        c.фамилия,
        c.имя,
        -- Recency: сколько дней назад был последний заказ
        EXTRACT(DAY FROM (CURRENT_DATE - MAX(o.дата_заказа))) AS recency,
        -- Frequency: сколько всего заказов
        COUNT(o.id) AS frequency,
        -- Monetary: сколько всего потрачено
        SUM(o.общая_сумма) AS monetary
    FROM клиенты c
    LEFT JOIN заказы o ON c.id = o.id_клиента
    GROUP BY c.id, c.фамилия, c.имя
),
quintiles AS (
    SELECT 
        *,
        NTILE(5) OVER (ORDER BY recency ASC) AS r_score,  -- недавние = высокий балл
        NTILE(5) OVER (ORDER BY frequency DESC) AS f_score,
        NTILE(5) OVER (ORDER BY monetary DESC) AS m_score
    FROM rfm_scores
),
customer_segments AS (
    SELECT *,
        CASE 
            WHEN r_score >= 4 AND f_score >= 4 AND m_score >= 4 THEN 'Лучшие клиенты'
            WHEN r_score >= 3 AND f_score >= 3 THEN 'Лояльные клиенты'
            WHEN r_score >= 4 AND m_score >= 3 THEN 'Потенциальные ценные клиенты'
            WHEN r_score <= 2 THEN 'Ушедшие клиенты'
            WHEN f_score <= 2 AND m_score <= 2 THEN 'Низкая ценность'
            WHEN r_score >= 3 AND f_score <= 2 THEN 'Перспективные'
            WHEN r_score <= 2 AND f_score >= 3 THEN 'Недавно ушедшие'
            ELSE 'Другое'
        END AS segment
    FROM quintiles
)
SELECT 
    segment,
    COUNT(*) AS customer_count,
    AVG(recency) AS avg_recency,
    AVG(frequency) AS avg_frequency,
    AVG(monetary) AS avg_monetary,
    SUM(monetary) AS total_monetary
FROM customer_segments
GROUP BY segment
ORDER BY total_monetary DESC;

-- Создание отдельного представления для сегментации
CREATE VIEW rfm_сегментация_клиентов AS
SELECT 
    customer_id,
    фамилия,
    имя,
    recency,
    frequency,
    monetary,
    r_score,
    f_score,
    m_score,
    segment,
    'RFM_' || r_score || f_score || m_score AS rfm_code
FROM customer_segments;
```

#### 4. Прогнозирование спроса

```sql
-- Прогнозирование спроса на основе исторических данных
WITH demand_history AS (
    SELECT 
        id_товара,
        DATE_TRUNC('month', дата_заказа) AS month,
        SUM(количество) AS monthly_demand
    FROM позиции_заказа p
    JOIN заказы o ON p.id_заказа = o.id
    WHERE o.дата_заказа >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY id_товара, DATE_TRUNC('month', дата_заказа)
),
demand_forecast AS (
    SELECT 
        id_товара,
        month,
        monthly_demand,
        -- Скользящее среднее за 3 месяца
        AVG(monthly_demand) OVER (
            PARTITION BY id_товара 
            ORDER BY month 
            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ) AS moving_avg_3m,
        -- Тренд (линейная регрессия за последние 6 месяцев)
        REGR_SLOPE(monthly_demand, EXTRACT(EPOCH FROM month)/86400) OVER (
            PARTITION BY id_товара 
            ORDER BY month 
            ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
        ) AS trend_slope
    FROM demand_history
),
predicted_demand AS (
    SELECT 
        id_товара,
        MAX(month) + INTERVAL '1 month' AS predicted_month,
        AVG(moving_avg_3m) + AVG(trend_slope) * 30 AS predicted_demand
    FROM demand_forecast
    GROUP BY id_товара
)
SELECT 
    t.название,
    p.predicted_month,
    ROUND(p.predicted_demand, 0) AS forecast_demand,
    t.количество_на_складе,
    CASE 
        WHEN t.количество_на_складе < ROUND(p.predicted_demand, 0) * 0.5 THEN 'Срочно заказать'
        WHEN t.количество_на_складе