# Полный курс SQL: От новичка до профессионала (Часть 8)

## Оглавление

### Раздел 9: Практические проекты и кейсы (продолжение)
- Глава 71: Проект 1: Анализ продаж (продолжение)
- Глава 72: Проект 2: Финансовый отчет (начало)
- Глава 73: Проект 3: Аналитика пользователей
- Глава 74: Проект 4: Управление инвентарем
- Глава 75: Решение реальных бизнес-задач

# Раздел 9: Практические проекты и кейсы (продолжение)

## Глава 71: Проект 1: Анализ продаж (продолжение)

#### 4. Прогнозирование спроса (продолжение)

```sql
-- Прогнозирование спроса на основе исторических данных (продолжение)
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
        COALESCE(AVG(moving_avg_3m), 0) + COALESCE(AVG(trend_slope) * 30, 0) AS predicted_demand
    FROM demand_forecast
    GROUP BY id_товара
)
SELECT 
    t.id AS id_товара,
    t.название,
    pd.predicted_month,
    ROUND(pd.predicted_demand, 0) AS прогнозный_спрос,
    t.количество_на_складе AS текущий_остаток,
    t.цена,
    CASE 
        WHEN t.количество_на_складе < GREATEST(ROUND(pd.predicted_demand, 0) * 0.5, 1) THEN 'Срочно заказать'
        WHEN t.количество_на_складе < GREATEST(ROUND(pd.predicted_demand, 0) * 0.8, 1) THEN 'Заказать'
        WHEN t.количество_на_складе < GREATEST(ROUND(pd.predicted_demand, 0) * 1.2, 1) THEN 'Наблюдать'
        ELSE 'Достаточно'
    END AS рекомендация,
    GREATEST(ROUND(pd.predicted_demand, 0) - t.количество_на_складе, 0) AS необх_для_покрытия
FROM predicted_demand pd
JOIN товары t ON pd.id_товара = t.id
WHERE t.активен = TRUE
    AND pd.predicted_demand > 0
ORDER BY рекомендация, необх_для_покрытия DESC;
```

#### 5. Анализ каналов продаж

```sql
-- Анализ эффективности каналов продаж
CREATE TABLE каналы_продаж (
    id SERIAL PRIMARY KEY,
    название VARCHAR(100) NOT NULL,
    тип_канала VARCHAR(50) CHECK (тип_канала IN ('онлайн', 'оффлайн', 'партнерский', 'телефонный', 'другое')),
    регион VARCHAR(50),
    менеджер VARCHAR(100),
    дата_запуска DATE,
    активен BOOLEAN DEFAULT TRUE
);

-- Создадим временную таблицу с каналами для примера
INSERT INTO каналы_продаж (название, тип_канала, регион) VALUES
('Веб-сайт', 'онлайн', 'Москва'),
('Розничный магазин', 'оффлайн', 'СПб'),
('Партнерская программа', 'партнерский', 'Москва'),
('Телефонные продажи', 'телефонный', 'Россия');

-- Анализ по каналам (предположим, что мы добавили id_канала в заказы)
ALTER TABLE заказы ADD COLUMN IF NOT EXISTS id_канала INTEGER REFERENCES каналы_продаж(id);

WITH channel_performance AS (
    SELECT 
        k.название AS канал,
        k.тип_канала,
        COUNT(o.id) AS количество_заказов,
        SUM(o.общая_сумма) AS общая_выручка,
        AVG(o.общая_сумма) AS средний_чек,
        COUNT(DISTINCT o.id_клиента) AS уникальных_клиентов,
        SUM(o.сумма_доставки) AS доход_от_доставки,
        SUM(o.общая_сумма) / COUNT(o.id) AS стоимость_привлечения_заказа,
        COUNT(o.id) * 100.0 / SUM(COUNT(o.id)) OVER() AS доля_канала
    FROM заказы o
    LEFT JOIN каналы_продаж k ON o.id_канала = k.id
    WHERE o.дата_создания >= CURRENT_DATE - INTERVAL '6 months'
    GROUP BY k.id, k.название, k.тип_канала
)
SELECT 
    канал,
    тип_канала,
    количество_заказов,
    ROUND(общая_выручка, 2) AS выручка,
    ROUND(средний_чек, 2) AS средний_чек,
    уникальных_клиентов,
    ROUND(доход_от_доставки, 2) AS доставка,
    ROUND(стоимость_привлечения_заказа, 2) AS CPA,
    ROUND(доля_канала, 2) AS доля_в_процентах,
    CASE 
        WHEN общая_выручка > 1000000 THEN 'Высокая эффективность'
        WHEN общая_выручка > 500000 THEN 'Средняя эффективность'
        WHEN общая_выручка > 100000 THEN 'Низкая эффективность'
        ELSE 'Неэффективный'
    END AS классификация_эффективности
FROM channel_performance
ORDER BY общая_выручка DESC;
```

#### 6. Анализ возвратов

```sql
-- Таблица для отслеживания возвратов
CREATE TABLE возвраты (
    id SERIAL PRIMARY KEY,
    id_заказа INTEGER NOT NULL REFERENCES заказы(id),
    id_позиции INTEGER NOT NULL REFERENCES позиции_заказа(id),
    дата_возврата DATE DEFAULT CURRENT_DATE,
    причина_возврата VARCHAR(200),
    стоимость_возврата NUMERIC(10,2),
    комиссия_возврата NUMERIC(10,2) DEFAULT 0,
    статус_возврата VARCHAR(20) DEFAULT 'в_обработке' CHECK (статус_возврата IN ('в_обработке', 'одобрен', 'отклонен', 'завершен')),
    комментарий TEXT
);

-- Анализ возвратов
WITH return_analysis AS (
    SELECT 
        t.категория,
        t.название AS товар,
        COUNT(r.id) AS количество_возвратов,
        SUM(r.стоимость_возврата) AS общая_стоимость_возвратов,
        AVG(r.стоимость_возврата) AS средняя_стоимость_возврата,
        COUNT(CASE WHEN r.причина_возврата = 'Брак' THEN 1 END) AS брак,
        COUNT(CASE WHEN r.причина_возврата = 'Не подошел' THEN 1 END) AS не_подошел,
        COUNT(CASE WHEN r.причина_возврата = 'Не понравился' THEN 1 END) AS не_понравился,
        COUNT(CASE WHEN r.причина_возврата = 'Клиент передумал' THEN 1 END) AS передумал,
        (COUNT(r.id) * 100.0 / NULLIF(COUNT(zt.id), 0)) AS процент_возврата
    FROM возвраты r
    JOIN позиции_заказа zt ON r.id_позиции = zt.id
    JOIN товары t ON zt.id_товара = t.id
    JOIN заказы z ON zt.id_заказа = z.id
    LEFT JOIN позиции_заказа zt_all ON z.id = zt_all.id_заказа
    WHERE r.дата_возврата >= CURRENT_DATE - INTERVAL '3 months'
    GROUP BY t.id, t.категория, t.название
)
SELECT 
    категория,
    товар,
    количество_возвратов,
    ROUND(общая_стоимость_возвратов, 2) AS общая_сумма,
    ROUND(средняя_стоимость_возврата, 2) AS средний_возврат,
    брак,
    не_подошел,
    не_понравился,
    передумал,
    ROUND(процент_возврата, 2) AS процент_возврата,
    CASE 
        WHEN процент_возврата > 10 THEN 'Высокий риск'
        WHEN процент_возврата > 5 THEN 'Средний риск'
        WHEN процент_возврата > 2 THEN 'Низкий риск'
        ELSE 'Нормальный уровень'
    END AS уровень_риска
FROM return_analysis
WHERE количество_возвратов > 0
ORDER BY процент_возврата DESC, общая_стоимость_возвратов DESC;
```

#### 7. Формирование отчета по продажам

```sql
-- Комплексный отчет по продажам
CREATE VIEW отчет_по_продажам AS
SELECT 
    d.дата,
    d.месяц,
    d.квартал,
    d.год,
    d.день_недели,
    d.название_дня,
    COUNT(DISTINCT d.id_заказа) AS заказов_в_день,
    COUNT(DISTINCT d.id_клиента) AS уникальных_клиентов,
    SUM(d.сумма_заказа) AS выручка,
    AVG(d.сумма_заказа) AS средний_чек,
    SUM(d.количество_товаров) AS товаров_продано,
    COUNT(*) AS позиций_заказа,
    SUM(d.сумма_заказа) / NULLIF(COUNT(DISTINCT d.id_клиента), 0) AS ARPC (средний доход на клиента),
    SUM(d.сумма_заказа) / NULLIF(COUNT(DISTINCT d.id_заказа), 0) AS ARPO (средний доход на заказ)
FROM (
    SELECT 
        o.дата_создания::date AS дата,
        EXTRACT(YEAR FROM o.дата_создания) AS год,
        EXTRACT(MONTH FROM o.дата_создания) AS месяц,
        EXTRACT(QUARTER FROM o.дата_создания) AS квартал,
        EXTRACT(DOW FROM o.дата_создания) AS день_недели,
        TO_CHAR(o.дата_создания, 'Day') AS название_дня,
        o.id AS id_заказа,
        o.id_клиента AS id_клиента,
        o.общая_сумма AS сумма_заказа,
        SUM(zt.количество) AS количество_товаров
    FROM заказы o
    LEFT JOIN позиции_заказа zt ON o.id = zt.id_заказа
    WHERE o.дата_создания >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY o.дата_создания::date, o.id, o.id_клиента, o.общая_сумма
) d
GROUP BY d.дата, d.месяц, d.квартал, d.год, d.день_недели, d.название_дня
ORDER BY d.дата DESC;

-- Использование отчета
SELECT 
    месяц,
    год,
    SUM(заказов_в_день) AS всего_заказов,
    SUM(выручка) AS месячная_выручка,
    AVG(средний_чек) AS среднемесячный_чек,
    AVG(уникальных_клиентов) AS среднее_число_клиентов_в_день
FROM отчет_по_продажам
WHERE дата >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY месяц, год
ORDER BY год DESC, месяц DESC;
```

### Заключение проекта 1

Проект анализа продаж демонстрирует применение множества продвинутых SQL-технологий:

1. Оконные функции для анализа временных рядов
2. CTE для построения сложных аналитических запросов
3. Агрегация для создания сводных данных
4. Условные выражения для сегментации
5. Комплексные JOIN'ы для интеграции данных из разных таблиц
6. Математические функции для вычисления метрик
7. Регулярные выражения и строковые функции для обработки данных

Этот проект показывает, как SQL может использоваться для решения реальных бизнес-задач в области анализа продаж.

---

## Глава 72: Проект 2: Финансовый отчет (начало)

### Введение

Финансовый отчет - это критически важный инструмент для управления бизнесом. В этой главе мы создадим систему для генерации финансовых отчетов, расчета ключевых финансовых показателей и анализа финансового состояния компании.

### 1. Создание структуры для финансовых данных

```sql
-- Таблица финансовых транзакций
CREATE TABLE финансовые_операции (
    id SERIAL PRIMARY KEY,
    дата_операции DATE NOT NULL DEFAULT CURRENT_DATE,
    тип_операции VARCHAR(30) NOT NULL CHECK (тип_операции IN ('доход', 'расход', 'перевод')),
    категория VARCHAR(50) NOT NULL,
    подкатегория VARCHAR(100),
    сумма NUMERIC(12,2) NOT NULL,
    валюта VARCHAR(3) DEFAULT 'RUB',
    id_заказа INTEGER REFERENCES заказы(id),
    id_контрагента INTEGER,
    краткое_описание TEXT,
    подробное_описание TEXT,
    статус VARCHAR(20) DEFAULT 'проведен' CHECK (статус IN ('черновик', 'проведен', 'отменен')),
    дата_создания TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    создал_пользователь VARCHAR(100),
    провел_пользователь VARCHAR(100),
    дата_проведения TIMESTAMP
);

-- Таблица плана счетов
CREATE TABLE план_счетов (
    id SERIAL PRIMARY KEY,
    код_счета VARCHAR(10) NOT NULL UNIQUE,
    название_счета VARCHAR(200) NOT NULL,
    тип_счета VARCHAR(20) NOT NULL CHECK (тип_счета IN ('актив', 'пассив', 'актив-пассив', 'доход', 'расход')),
    категория_счета VARCHAR(50),
    родительский_счет INTEGER REFERENCES план_счетов(id),
    активен BOOLEAN DEFAULT TRUE
);

-- Таблица для связи транзакций с счетами
CREATE TABLE проводки (
    id SERIAL PRIMARY KEY,
    id_операции INTEGER NOT NULL REFERENCES финансовые_операции(id) ON DELETE CASCADE,
    id_счета_дт INTEGER NOT NULL REFERENCES план_счетов(id),
    id_счета_кт INTEGER NOT NULL REFERENCES план_счетов(id),
    сумма NUMERIC(12,2) NOT NULL,
    валюта VARCHAR(3) DEFAULT 'RUB',
    комментарий TEXT
);

-- Таблица для аналитических разрезов
CREATE TABLE аналитики (
    id SERIAL PRIMARY KEY,
    тип_аналитики VARCHAR(50) NOT NULL,  -- отдел, проект, клиент и т.д.
    код_аналитики VARCHAR(50) NOT NULL,
    название_аналитики VARCHAR(200) NOT NULL,
    описание TEXT,
    родительская_аналитика INTEGER REFERENCES аналитики(id),
    активна BOOLEAN DEFAULT TRUE
);

-- Таблица для связи проводок с аналитиками
CREATE TABLE аналитические_проводки (
    id SERIAL PRIMARY KEY,
    id_проводки INTEGER NOT NULL REFERENCES проводки(id) ON DELETE CASCADE,
    id_аналитики INTEGER NOT NULL REFERENCES аналитики(id),
    сумма NUMERIC(12,2) NOT NULL,
    UNIQUE(id_проводки, id_аналитики)
);

-- Заполним примерами плана счетов
INSERT INTO план_счетов (код_счета, название_счета, тип_счета, категория_счета) VALUES
('62.01', 'Расчетный счет', 'актив', 'денежные средства'),
('60.01', 'Поставщики', 'пассив', 'кредиторская задолженность'),
('62.02', 'Покупатели', 'актив', 'дебиторская задолженность'),
('90.01', 'Выручка от продаж', 'доход', 'операционная деятельность'),
('90.02', 'Себестоимость', 'расход', 'операционная деятельность'),
('91.01', 'Прочие доходы', 'доход', 'внереализационная деятельность'),
('91.02', 'Прочие расходы', 'расход', 'внереализационная деятельность'),
('44.01', 'Коммерческие расходы', 'расход', 'операционная деятельность'),
('44.02', 'Управленческие расходы', 'расход', 'операционная деятельность');
```

### 2. Типичные финансовые отчеты

#### 2.1. Отчет о прибылях и убытках (P&L)

```sql
CREATE VIEW отчет_о_прибылях_и_убытках AS
WITH monthly_pl AS (
    SELECT 
        EXTRACT(YEAR FROM fo.дата_операции) AS год,
        EXTRACT(MONTH FROM fo.дата_операции) AS месяц,
        pc.категория_счета,
        pc.название_счета,
        SUM(
            CASE 
                WHEN pc.тип_счета = 'доход' THEN fo.сумма
                WHEN pc.тип_счета = 'расход' THEN -fo.сумма
                ELSE 0
            END
        ) AS сумма
    FROM финансовые_операции fo
    JOIN проводки p ON fo.id = p.id_операции
    JOIN план_счетов pc ON p.id_счета_дт = pc.id OR p.id_счета_кт = pc.id
    WHERE fo.дата_операции >= CURRENT_DATE - INTERVAL '24 months'
        AND pc.категория_счета IN ('операционная деятельность', 'внереализационная деятельность')
    GROUP BY 
        EXTRACT(YEAR FROM fo.дата_операции),
        EXTRACT(MONTH FROM fo.дата_операции),
        pc.категория_счета,
        pc.название_счета
),
pnl_summary AS (
    SELECT 
        год,
        месяц,
        SUM(CASE WHEN категория_счета = 'операционная деятельность' AND сумма > 0 THEN сумма ELSE 0 END) AS операционные_доходы,
        SUM(CASE WHEN категория_счета = 'операционная деятельность' AND сумма < 0 THEN -сумма ELSE 0 END) AS операционные_расходы,
        SUM(CASE WHEN категория_счета = 'внереализационная деятельность' AND сумма > 0 THEN сумма ELSE 0 END) AS внереализационные_доходы,
        SUM(CASE WHEN категория_счета = 'внереализационная деятельность' AND сумма < 0 THEN -сумма ELSE 0 END) AS внереализационные_расходы
    FROM monthly_pl
    GROUP BY год, месяц
)
SELECT 
    год,
    месяц,
    операционные_доходы,
    операционные_расходы,
    (операционные_доходы - операционные_расходы) AS операционная_прибыль,
    внереализационные_доходы,
    внереализационные_расходы,
    (внереализационные_доходы - внереализационные_расходы) AS внереализационный_результат,
    (операционные_доходы - операционные_расходы + внереализационные_доходы - внереализационные_расходы) AS чистая_прибыль
FROM pnl_summary
ORDER BY год DESC, месяц DESC;

-- Использование отчета
SELECT 
    год,
    месяц,
    чистая_прибыль,
    CASE 
        WHEN чистая_прибыль > 0 THEN 'Прибыль'
        WHEN чистая_прибыль < 0 THEN 'Убыток'
        ELSE 'Нулевой результат'
    END AS результат,
    ROUND((чистая_прибыль / NULLIF(операционные_доходы, 0)) * 100, 2) AS рентабельность_по_доходам
FROM отчет_о_прибылях_и_убытках
WHERE операционные_доходы > 0
ORDER BY год DESC, месяц DESC;
```

#### 2.2. Анализ себестоимости

```sql
CREATE VIEW анализ_себестоимости AS
WITH cost_analysis AS (
    SELECT 
        fo.дата_операции,
        t.название AS товар,
        t.категория,
        SUM(CASE WHEN pc.код_счета = '90.02' THEN fo.сумма ELSE 0 END) AS себестоимость,
        SUM(CASE WHEN pc.код_счета = '90.01' THEN fo.сумма ELSE 0 END) AS выручка,
        SUM(fo.количество) AS количество_продано  -- если есть такая информация
    FROM финансовые_операции fo
    JOIN проводки p ON fo.id = p.id_операции
    JOIN план_счетов pc ON (p.id_счета_дт = pc.id OR p.id_счета_кт = pc.id)
    JOIN позиции_заказа pz ON fo.id_заказа = pz.id_заказа
    JOIN товары t ON pz.id_товара = t.id
    WHERE fo.дата_операции >= CURRENT_DATE - INTERVAL '6 months'
        AND pc.код_счета IN ('90.01', '90.02')  -- выручка и себестоимость
    GROUP BY fo.дата_операции, t.id, t.название, t.категория
)
SELECT 
    товар,
    категория,
    SUM(выручка) AS общая_выручка,
    SUM(себестоимость) AS общая_себестоимость,
    SUM(выручка) - SUM(себестоимость) AS валовая_прибыль,
    ROUND((SUM(выручка) - SUM(себестоимость)) * 100.0 / NULLIF(SUM(выручка), 0), 2) AS маржа_в_процентах,
    SUM(количество_продано) AS всего_продано
FROM cost_analysis
GROUP BY товар, категория
HAVING SUM(выручка) > 0
ORDER BY маржа_в_процентах DESC;
```

#### 2.3. Движение денежных средств

```sql
CREATE VIEW движение_денежных_средств AS
WITH cash_flows AS (
    SELECT 
        fo.дата_операции,
        pc.код_счета,
        pc.название_счета,
        CASE 
            WHEN pc.код_счета LIKE '62.%' THEN fo.сумма  -- денежные средства
            ELSE 0
        END AS денежная_операция,
        CASE 
            WHEN pc.категория_счета = 'операционная деятельность' THEN fo.сумма
            ELSE 0
        END AS операционная_деятельность,
        CASE 
            WHEN pc.категория_счета IN ('инвестиционная деятельность') THEN fo.сумма
            ELSE 0
        END AS инвестиционная_деятельность,
        CASE 
            WHEN pc.категория_счета IN ('финансовая деятельность') THEN fo.сумма
            ELSE 0
        END AS финансовая_деятельность
    FROM финансовые_операции fo
    JOIN проводки p ON fo.id = p.id_операции
    JOIN план_счетов pc ON p.id_счета_дт = pc.id
    WHERE fo.дата_операции >= CURRENT_DATE - INTERVAL '12 months'
        AND pc.код_счета LIKE '62.%'  -- только денежные счета
)
SELECT 
    дата_операции,
    SUM(денежная_операция) AS изменение_денежных_средств,
    SUM(операционная_деятельность) AS от_операционной_деятельности,
    SUM(инвестиционная_деятельность) AS от_инвестиционной_деятельности,
    SUM(финансовая_деятельность) AS от_финансовой_деятельности,
    SUM(SUM(денежная_операция)) OVER (
        ORDER BY дата_операции 
        ROWS UNBOUNDED PRECEDING
    ) AS накопленный_итог
FROM cash_flows
GROUP BY дата_операции
ORDER BY дата_операции;
```

### 3. Рассчет ключевых финансовых показателей (KPI)

```sql
CREATE VIEW ключевые_финансовые_kpi AS
WITH financial_data AS (
    SELECT 
        EXTRACT(YEAR FROM fo.дата_операции) AS год,
        EXTRACT(MONTH FROM fo.дата_операции) AS месяц,
        SUM(CASE WHEN pc.код_счета = '90.01' THEN fo.сумма ELSE 0 END) AS выручка,
        SUM(CASE WHEN pc.код_счета = '90.02' THEN fo.сумма ELSE 0 END) AS себестоимость,
        SUM(CASE WHEN pc.код_счета IN ('44.01', '44.02') THEN fo.сумма ELSE 0 END) AS операционные_расходы,
        SUM(CASE WHEN pc.код_счета LIKE '62.%' THEN fo.сумма ELSE 0 END) AS денежные_средства
    FROM финансовые_операции fo
    JOIN проводки p ON fo.id = p.id_операции
    JOIN план_счетов pc ON (p.id_счета_дт = pc.id OR p.id_счета_кт = pc.id)
    WHERE fo.дата_операции >= CURRENT_DATE - INTERVAL '24 months'
    GROUP BY EXTRACT(YEAR FROM fo.дата_операции), EXTRACT(MONTH FROM fo.дата_операции)
)
SELECT 
    год,
    месяц,
    выручка,
    себестоимость,
    операционные_расходы,
    (выручка - себестоимость) AS валовая_прибыль,
    (выручка - себестоимость - операционные_расходы) AS EBITDA,
    ROUND((выручка - себестоимость) * 100.0 / NULLIF(выручка, 0), 2) AS валовая_маржа,
    ROUND((выручка - себестоимость - операционные_расходы) * 100.0 / NULLIF(выручка, 0), 2) AS EBITDA_маржа,
    CASE 
        WHEN (выручка - себестоимость - операционные_расходы) > 0 THEN 'Прибыльная'
        ELSE 'Убыточная'
    END AS операционная_эффективность
FROM financial_data
WHERE выручка > 0
ORDER BY год DESC, месяц DESC;
```

### 4. Финансовые отчеты для управления

#### 4.1. Отчет по проектам/направлениям деятельности

```sql
-- Предположим, у нас есть аналитика по проектам
INSERT INTO аналитики (тип_аналитики, код_аналитики, название_аналитики) VALUES
('проект', 'PROJ001', 'Онлайн-магазин'),
('проект', 'PROJ002', 'Офлайн-магазин'),
('проект', 'PROJ003', 'Оптовая продажа');

CREATE VIEW финансовый_отчет_по_проектам AS
WITH project_financials AS (
    SELECT 
        a.название_аналитики AS проект,
        fo.дата_операции,
        pc.категория_счета,
        SUM(fo.сумма) AS сумма
    FROM финансовые_операции fo
    JOIN проводки p ON fo.id = p.id_операции
    JOIN аналитические_проводки ap ON p.id = ap.id_проводки
    JOIN аналитики a ON ap.id_аналитики = a.id
    JOIN план_счетов pc ON (p.id_счета_дт = pc.id OR p.id_счета_кт = pc.id)
    WHERE a.тип_аналитики = 'проект'
        AND fo.дата_операции >= CURRENT_DATE - INTERVAL '6 months'
    GROUP BY a.название_аналитики, fo.дата_операции, pc.категория_счета
)
SELECT 
    проект,
    SUM(CASE WHEN категория_счета = 'операционная деятельность' AND сумма > 0 THEN сумма ELSE 0 END) AS доход_по_проекту,
    SUM(CASE WHEN категория_счета = 'операционная деятельность' AND сумма < 0 THEN -сумма ELSE 0 END) AS расход_по_проекту,
    SUM(CASE WHEN категория_счета = 'операционная деятельность' THEN сумма ELSE 0 END) AS прибыль_убыток_по_проекту,
    COUNT(*) AS количество_операций
FROM project_financials
GROUP BY проект
ORDER BY прибыль_убыток_по_проекту DESC;
```

#### 4.2. Анализ дебиторской задолженности

```sql
CREATE VIEW анализ_дебиторской_задолженности AS
WITH debtors AS (
    SELECT 
        o.id_клиента,
        к.фамилия,
        к.имя,
        o.id AS id_заказа,
        o.дата_создания AS дата_заказа,
        o.общая_сумма AS сумма_заказа,
        o.дата_доставки,
        CURRENT_DATE - o.дата_заказа AS дней_с_заказа,
        CASE 
            WHEN CURRENT_DATE - o.дата_заказа > 90 THEN 'Старше 90 дней'
            WHEN CURRENT_DATE - o.дата_заказа > 60 THEN '61-90 дней'
            WHEN CURRENT_DATE - o.дата_заказа > 30 THEN '31-60 дней'
            ELSE 'До 30 дней'
        END AS возраст_долга
    FROM заказы o
    JOIN клиенты к ON o.id_клиента = к.id
    WHERE o.статус_заказа IN ('в_доставке', 'доставлен')  -- предполагаем, что это неоплаченные
        AND o.дата_заказа < CURRENT_DATE - INTERVAL '7 days'  -- старше недели
)
SELECT 
    возраст_долга,
    COUNT(*) AS количество_заказов,
    SUM(сумма_заказа) AS общая_сумма_долга,
    AVG(сумма_заказа) AS средняя_сумма_долга,
    AVG(дней_с_заказа) AS средний_возраст_долга
FROM debtors
GROUP BY возраст_долга
ORDER BY 
    CASE возраст_долга 
        WHEN 'Старше 90 дней' THEN 1
        WHEN '61-90 дней' THEN 2
        WHEN '31-60 дней' THEN 3
        ELSE 4
    END;
```

### 5. Формирование сводных отчетов

#### 5.1. Ежемесячный финансовый отчет

```sql
CREATE VIEW ежемесячный_финансовый_отчет AS
WITH monthly_summary AS (
    SELECT 
        EXTRACT(YEAR FROM fo.дата_операции) AS год,
        EXTRACT(MONTH FROM fo.дата_операции) AS месяц,
        SUM(CASE WHEN pc.код_счета = '90.01' THEN fo.сумма ELSE 0 END) AS выручка,
        SUM(CASE WHEN pc.код_счета = '90.02' THEN fo.сумма ELSE 0 END) AS себестоимость,
        SUM(CASE WHEN pc.код_счета = '44.01' THEN fo.сумма ELSE 0 END) AS коммерческие_расходы,
        SUM(CASE WHEN pc.код_счета = '44.02' THEN fo.сумма ELSE 0 END) AS управленческие_расходы,
        SUM(CASE WHEN pc.код_счета LIKE '62.%' THEN fo.сумма ELSE 0 END) AS денежные_средства
    FROM финансовые_операции fo
    JOIN проводки p ON fo.id = p.id_операции
    JOIN план_счетов pc ON (p.id_счета_дт = pc.id OR p.id_счета_кт = pc.id)
    WHERE fo.дата_операции >= CURRENT_DATE - INTERVAL '24 months'
    GROUP BY EXTRACT(YEAR FROM fo.дата_операции), EXTRACT(MONTH FROM fo.дата_операции)
),
enriched_data AS (
    SELECT 
        *,
        LAG(выручка) OVER (PARTITION BY месяц ORDER BY год) AS выручка_пред_год,
        LAG(себестоимость) OVER (PARTITION BY месяц ORDER BY год) AS себестоимость_пред_год
    FROM monthly_summary
)
SELECT 
    год,
    месяц,
    выручка,
    себестоимость,
    (LAG(выручка) OVER (ORDER BY год, месяц) - выручка) AS изменение_выручки_мес,
    ROUND(((выручка - LAG(выручка) OVER (ORDER BY год, месяц)) * 100.0 / NULLIF(LAG(выручка) OVER (ORDER BY год, месяц), 0)), 2) AS рост_выручки_в_процентах_мес,
    ROUND(((выручка - выручка_пред_год) * 100.0 / NULLIF(выручка_пред_год, 0)), 2) AS рост_выручки_в_процентах_год_к_году,
    (выручка - себестоимость) AS валовая_прибыль,
    ROUND((выручка - себестоимость) * 100.0 / NULLIF(выручка, 0), 2) AS валовая_маржа,
    (выручка - себестоимость - коммерческие_расходы - управленческие_расходы) AS чистая_прибыль,
    ROUND((выручка - себестоимость - коммерческие_расходы - управленческие_расходы) * 100.0 / NULLIF(выручка, 0), 2) AS рентабельность_продаж
FROM enriched_data
WHERE выручка > 0
ORDER BY год DESC, месяц DESC;
```

#### 5.2. KPI дашборд

```sql
CREATE VIEW финансовый_kpi_дашборд AS
WITH latest_month AS (
    SELECT MAX(EXTRACT(YEAR FROM дата_операции)) AS max_year,
           MAX(CASE WHEN EXTRACT(YEAR FROM дата_операции) = MAX(EXTRACT(YEAR FROM дата_операции)) 
                   THEN EXTRACT(MONTH FROM дата_операции) END) AS max_month
    FROM финансовые_операции
    WHERE дата_операции >= CURRENT_DATE - INTERVAL '12 months'
),
current_data AS (
    SELECT 
        SUM(CASE WHEN pc.код_счета = '90.01' THEN fo.сумма ELSE 0 END) AS текущая_выручка,
        SUM(CASE WHEN pc.код_счета = '90.02' THEN fo.сумма ELSE 0 END) AS текущая_себестоимость,
        SUM(CASE WHEN pc.код_счета IN ('44.01', '44.02') THEN fo.сумма ELSE 0 END) AS текущие_расходы
    FROM финансовые_операции fo
    JOIN проводки p ON fo.id = p.id_операции
    JOIN план_счетов pc ON (p.id_счета_дт = pc.id OR p.id_счета_кт = pc.id)
    WHERE EXTRACT(YEAR FROM fo.дата_операции) = (SELECT max_year FROM latest_month)
        AND EXTRACT(MONTH FROM fo.дата_операции) = (SELECT max_month FROM latest_month)
),
previous_data AS (
    SELECT 
        SUM(CASE WHEN pc.код_счета = '90.01' THEN fo.сумма ELSE 0 END) AS предыдущая_выручка,
        SUM(CASE WHEN pc.код_счета = '90.02' THEN fo.сумма ELSE 0 END) AS предыдущая_себестоимость,
        SUM(CASE WHEN pc.код_счета IN ('44.01', '44.02') THEN fo.сумма ELSE 0 END) AS предыдущие_расходы
    FROM финансовые_операции fo
    JOIN проводки p ON fo.id = p.id_операции
    JOIN план_счетов pc ON (p.id_счета_дт = pc.id OR p.id_счета_кт = pc.id)
    WHERE EXTRACT(YEAR FROM fo.дата_операции) = (SELECT max_year FROM latest_month)
        AND EXTRACT(MONTH FROM fo.дата_операции) = (SELECT max_month FROM latest_month) - 1
)
SELECT 
    'Ключевые финансовые показатели' AS метрика,
    cd.текущая_выручка AS значение,
    (cd.текущая_выручка - pd.предыдущая_выручка) AS изменение,
    ROUND(((cd.текущая_выручка - pd.предыдущая_выручка) * 100.0 / NULLIF(pd.предыдущая_выручка, 0)), 2) AS рост_в_процентах,
    'Основные финансовые показатели за текущий месяц' AS описание
FROM current_data cd
CROSS JOIN previous_data pd;
```

### Заключение проекта 2 (начало)

Проект финансового отчета показывает, как SQL может использоваться для:

1. Создания сложных финансовых отчетов
2. Расчета ключевых финансовых показателей
3. Анализа денежных потоков
4. Сегментации данных по различным аналитическим разрезам
5. Построения KPI дашбордов
6. Обеспечения прозрачности финансовой деятельности

Этот проект продолжится в следующих главах, где мы углубимся в специфические аспекты финансового анализа и отчетности.

---

## Глава 73: Проект 3: Аналитика пользователей

### Введение

Аналитика пользователей важна для понимания поведения клиентов, оптимизации продуктов и повышения вовлеченности. В этой главе мы создадим систему аналитики пользователей, включая поведенческие метрики, сегментацию и прогнозирование.

### 1. Создание структуры для аналитики пользователей

```sql
-- Таблица событий пользователей
CREATE TABLE события_пользователей (
    id SERIAL PRIMARY KEY,
    id_пользователя INTEGER NOT NULL,
    тип_события VARCHAR(50) NOT NULL,  -- 'page_view', 'click', 'purchase', 'sign_up' и т.д.
    параметры JSONB,  -- дополнительные параметры события
    url VARCHAR(500),  -- URL страницы
    реферер VARCHAR(500),  -- откуда пришел пользователь
    ip_адрес INET,  -- IP-адрес
    user_agent TEXT,  -- User Agent
    дата_события TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    сессия_id VARCHAR(100),  -- ID сессии
    устройство VARCHAR(50),  -- desktop, mobile, tablet
    браузер VARCHAR(50),
    операционная_система VARCHAR(50),
    геолокация JSONB  -- {"country": "RU", "city": "Moscow", "lat": 55.7558, "lng": 37.6176}
);

-- Таблица сессий пользователей
CREATE TABLE сессии_пользователей (
    id SERIAL PRIMARY KEY,
    id_пользователя INTEGER NOT NULL,
    id_сессии VARCHAR(100) NOT NULL,
    дата_начала TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    дата_окончания TIMESTAMP,
    продолжительность INTEGER,  -- в секундах
    страниц_просмотрено INTEGER DEFAULT 0,
    событий_совершено INTEGER DEFAULT 0,
    исходный_канал VARCHAR(50),  -- organic, direct, referral, social
    кампания VARCHAR(100),
    содержание_кампании VARCHAR(100),
    термин_поиска VARCHAR(100),
    источник_трафика VARCHAR(50),
    тип_трафика VARCHAR(50)
);

-- Таблица для хранения поведенческих метрик
CREATE TABLE поведенческие_метрики (
    id SERIAL PRIMARY KEY,
    id_пользователя INTEGER NOT NULL,
    период DATE NOT NULL,  -- дата начала периода (например, дата)
    сессий INTEGER DEFAULT 0,
    просмотров_страниц INTEGER DEFAULT 0,
    уникальных_страниц INTEGER DEFAULT 0,
    времени_проведено INTEGER DEFAULT 0,  -- в секундах
    коэффициент_отказа NUMERIC(5,2) DEFAULT 0,  -- в процентах
    глубина_просмотра NUMERIC(5,2) DEFAULT 0,
    конверсия_покупки NUMERIC(5,2) DEFAULT 0,  -- в процентах
    дата_обновления TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для производительности
CREATE INDEX idx_события_пользователя ON события_пользователей(id_пользователя);
CREATE INDEX idx_события_дата ON события_пользователей(дата_события DESC);
CREATE INDEX idx_события_тип ON события_пользователей(тип_события);
CREATE INDEX idx_сессии_пользователя ON сессии_пользователей(id_пользователя);
CREATE INDEX idx_метрики_период ON поведенческие_метрики(период);

-- Заполним тестовыми данными
INSERT INTO события_пользователей (id_пользователя, тип_события, параметры, url, устройство, дата_события) VALUES
(1, 'view_product', '{"product_id": 123}', '/products/123', 'desktop', '2023-12-01 10:00:00'),
(1, 'add_to_cart', '{"product_id": 123}', '/cart', 'desktop', '2023-12-01 10:02:00'),
(1, 'checkout', '{}', '/checkout', 'desktop', '2023-12-01 10:05:00'),
(1, 'purchase', '{"order_id": 1001, "amount": 15000}', '/thank-you', 'desktop', '2023-12-01 10:08:00'),
(2, 'view_product', '{"product_id": 456}', '/products/456', 'mobile', '2023-12-01 11:00:00'),
(2, 'view_product', '{"product_id": 789}', '/products/789', 'mobile', '2023-12-01 11:01:00'),
(2, 'leave', '{}', '/products/789', 'mobile', '2023-12-01 11:02:00');
```

### 2. Анализ поведения пользователей

#### 2.1. Поведенческие метрики

```sql
-- Расчет поведенческих метрик для пользователей
CREATE VIEW поведенческий_анализ AS
WITH user_behavior AS (
    SELECT 
        id_пользователя,
        DATE_TRUNC('day', дата_события) AS день,
        COUNT(*) AS событий_в_день,
        COUNT(DISTINCT сессия_id) AS сессий_в_день,
        COUNT(CASE WHEN тип_события = 'page_view' THEN 1 END) AS просмотров_страниц,
        COUNT(CASE WHEN тип_события = 'purchase' THEN 1 END) AS покупок,
        COUNT(CASE WHEN тип_события = 'add_to_cart' THEN 1 END) AS добавлений_в_корзину,
        COUNT(DISTINCT url) AS уникальных_страниц,
        MIN(дата_события) AS первое_событие,
        MAX(дата_события) AS последнее_событие
    FROM события_пользователей
    WHERE дата_события >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY id_пользователя, DATE_TRUNC('day', дата_события)
),
extended_metrics AS (
    SELECT 
        id_пользователя,
        день,
        событий_в_день,
        сессий_в_день,
        просмотров_страниц,
        покупок,
        добавлений_в_корзину,
        уникальных_страниц,
        EXTRACT(EPOCH FROM (последнее_событие - первое_событие)) AS время_в_секундах,
        CASE 
            WHEN просмотров_страниц = 1 THEN 100.0
            ELSE 0.0
        END AS потенциальный_коэффициент_отказа  -- упрощение
    FROM user_behavior
)
SELECT 
    id_пользователя,
    день,
    событий_в_день,
    сессий_в_день,
    просмотров_страниц,
    покупок,
    добавлений_в_корзину,
    уникальных_страниц,
    ROUND(время_в_секундах, 2) AS проведено_времени_в_сек,
    ROUND(уникальных_страниц::NUMERIC / NULLIF(сессий_в_день, 0), 2) AS глубина_просмотра,
    ROUND(покупок::NUMERIC / NULLIF(просмотров_страниц, 0) * 100, 2) AS конверсия_из_просмотра,
    ROUND(добавлений_в_корзину::NUMERIC / NULLIF(просмотров_страниц, 0) * 100, 2) AS добавление_в_корзину_из_просмотра
FROM extended_metrics
ORDER BY id_пользователя, день DESC;
```

#### 2.2. Анализ воронки конверсии

```sql
CREATE VIEW воронка_конверсии AS
WITH funnel_stages AS (
    SELECT 
        id_пользователя,
        сессия_id,
        BOOL_OR(тип_события = 'view_product') AS stage_view_product,
        BOOL_OR(тип_события = 'add_to_cart') AS stage_add_to_cart,
        BOOL_OR(тип_события = 'checkout') AS stage_checkout,
        BOOL_OR(тип_события = 'purchase') AS stage_purchase
    FROM события_пользователей
    WHERE дата_события >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY id_пользователя, сессия_id
),
funnel_counts AS (
    SELECT 
        COUNT(*) AS total_users,
        COUNT(CASE WHEN stage_view_product THEN 1 END) AS viewed_product,
        COUNT(CASE WHEN stage_add_to_cart THEN 1 END) AS added_to_cart,
        COUNT(CASE WHEN stage_checkout THEN 1 END) AS proceeded_to_checkout,
        COUNT(CASE WHEN stage_purchase THEN 1 END) AS completed_purchase
    FROM funnel_stages
)
SELECT 
    'Просмотр товара' AS этап,
    viewed_product AS уникальных,
    ROUND(viewed_product * 100.0 / total_users, 2) AS процент_от_всех
FROM funnel_counts

UNION ALL

SELECT 
    'Добавление в корзину' AS этап,
    added_to_cart AS уникальных,
    ROUND(added_to_cart * 100.0 / total_users, 2) AS процент_от_всех
FROM funnel_counts

UNION ALL

SELECT 
    'Оформление заказа' AS этап,
    proceeded_to_checkout AS уникальных,
    ROUND(proceeded_to_checkout * 100.0 / total_users, 2) AS процент_от_всех
FROM funnel_counts

UNION ALL

SELECT 
    'Покупка завершена' AS этап,
    completed_purchase AS уникальных,
    ROUND(completed_purchase * 100.0 / total_users, 2) AS процент_от_всех
FROM funnel_counts;
```

#### 2.3. Сегментация пользователей

```sql
CREATE VIEW сегментация_пользователей AS
WITH user_metrics AS (
    SELECT 
        id_пользователя,
        COUNT(DISTINCT DATE_TRUNC('day', дата_события)) AS активных_дней,
        COUNT(DISTINCT сессия_id) AS всего_сессий,
        COUNT(*) AS всего_событий,
        COUNT(CASE WHEN тип_события = 'purchase' THEN 1 END) AS покупок,
        SUM(CASE WHEN тип_события = 'purchase' THEN (параметры->>'amount')::NUMERIC ELSE 0 END) AS общая_сумма_покупок,
        MAX(дата_события) AS последнее_взаимодействие,
        MIN(дата_события) AS первое_взаимодействие
    FROM события_пользователей
    GROUP BY id_пользователя
),
user_segments AS (
    SELECT *,
        CASE 
            WHEN последнее_взаимодействие >= CURRENT_DATE - INTERVAL '1 day' THEN 'daily_active'
            WHEN последнее_взаимодействие >= CURRENT_DATE - INTERVAL '7 days' THEN 'weekly_active'
            WHEN последнее_взаимодействие >= CURRENT_DATE - INTERVAL '30 days' THEN 'monthly_active'
            ELSE 'inactive'
        END AS активность,
        CASE 
            WHEN покупок >= 5 AND общая_сумма_покупок >= 100000 THEN 'champions'
            WHEN покупок >= 3 AND общая_сумма_покупок >= 50000 THEN 'loyal_customers'
            WHEN покупок >= 1 AND общая_сумма_покупок >= 10000 THEN 'potential_loyalists'
            WHEN (CURRENT_DATE - последнее_взаимодействие) > INTERVAL '30 days' AND покупок = 0 THEN 'slipping_away'
            WHEN (CURRENT_DATE - последнее_взаимодействие) > INTERVAL '60 days' THEN 'hibernating'
            ELSE 'new_visitors'
        END AS сегмент_rfm,
        CASE 
            WHEN активных_дней > 10 THEN 'high_engagement'
            WHEN активных_дней > 5 THEN 'medium_engagement'
            WHEN активных_дней > 1 THEN 'low_engagement'
            ELSE 'one_time_visitor'
        END AS уровень_вовлеченности
    FROM user_metrics
)
SELECT 
    id_пользователя,
    активных_дней,
    всего_сессий,
    всего_событий,
    покупок,
    общая_сумма_покупок,
    активность,
    сегмент_rfm,
    уровень_вовлеченности,
    CASE 
        WHEN общая_сумма_покупок > 100000 THEN 'VIP'
        WHEN общая_сумма_покупок > 50000 THEN 'Премиум'
        WHEN общая_сумма_покупок > 10000 THEN 'Стандарт'
        ELSE 'Новый'
    END AS уровень_ценности
FROM user_segments
ORDER BY общая_сумма_покупок DESC;
```

### 3. Аналитика сессий

#### 3.1. Анализ сессий пользователей

```sql
CREATE VIEW анализ_сессий AS
WITH session_details AS (
    SELECT 
        sv.id_пользователя,
        sv.сессия_id,
        MIN(sv.дата_события) AS время_начала,
        MAX(sv.дата_события) AS время_окончания,
        COUNT(*) AS событий_в_сессии,
        COUNT(DISTINCT sv.url) AS страниц_просмотрено,
        STRING_AGG(DISTINCT sv.устройство, ', ') AS устройства,
        STRING_AGG(DISTINCT sv.браузер, ', ') AS браузеры,
        BOOL_OR(sv.тип_события = 'purchase') AS была_покупка
    FROM события_пользователей sv
    WHERE sv.дата_события >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY sv.id_пользователя, sv.сессия_id
)
SELECT 
    id_пользователя,
    сессия_id,
    время_начала,
    время_окончания,
    событий_в_сессии,
    страниц_просмотрено,
    EXTRACT(EPOCH FROM (время_окончания - время_начала)) AS продолжительность_сессии_сек,
    ROUND(EXTRACT(EPOCH FROM (время_окончание - время_начала))/NULLIF(страниц_просмотрено, 0), 2) AS время_на_странице_сек,
    устройства,
    браузеры,
    была_покупка,
    CASE 
        WHEN событий_в_сессии > 10 THEN 'длинная_сессия'
        WHEN событий_в_сессии > 5 THEN 'средняя_сессия'
        ELSE 'короткая_сессия'
    END AS тип_сессии
FROM session_details
ORDER BY время_начала DESC;
```

#### 3.2. Путь пользователя (User Journey)

```sql
CREATE VIEW путь_пользователя AS
WITH user_journey AS (
    SELECT 
        id_пользователя,
        сессия_id,
        дата_события,
        тип_события,
        url,
        ROW_NUMBER() OVER (
            PARTITION BY id_пользователя, сессия_id 
            ORDER BY дата_события
        ) AS шаг_в_сессии,
        LAG(url) OVER (
            PARTITION BY id_пользователя, сессия_id 
            ORDER BY дата_события
        ) AS предыдущая_страница,
        параметры
    FROM события_пользователей
    WHERE дата_события >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT 
    id_пользователя,
    сессия_id,
    шаг_в_сессии,
    дата_события,
    тип_события,
    предыдущая_страница,
    url AS текущая_страница,
    параметры,
    CASE 
        WHEN предыдущая_страница IS NULL THEN 'начало_сеанса'
        WHEN предыдущая_страница = url THEN 'рефреш'
        ELSE 'переход_с_' || предыдущая_страница
    END AS тип_перехода
FROM user_journey
WHERE сессия_id IS NOT NULL
ORDER BY id_пользователя, сессия_id, шаг_в_сессии;
```

### 4. А/В тестирование

#### 4.1. Анализ экспериментов

```sql
-- Добавим поле для экспериментов в события
ALTER TABLE события_пользователей ADD COLUMN IF NOT EXISTS эксперимент VARCHAR(100);
ALTER TABLE события_пользователей ADD COLUMN IF NOT EXISTS вариант_теста VARCHAR(50);

-- Пример анализа A/B теста
CREATE VIEW анализ_ab_теста AS
WITH test_results AS (
    SELECT 
        эксперимент,
        вариант_теста,
        COUNT(DISTINCT id_пользователя) AS уникальных_пользователей,
        COUNT(*) AS всего_событий,
        COUNT(CASE WHEN тип_события = 'purchase' THEN 1 END) AS конверсии,
        SUM(CASE WHEN тип_события = 'purchase' THEN (параметры->>'amount')::NUMERIC ELSE 0 END) AS доход,
        COUNT(CASE WHEN тип_события = 'add_to_cart' THEN 1 END) AS добавления_в_корзину
    FROM события_пользователей
    WHERE эксперимент IS NOT NULL
        AND дата_события >= CURRENT_DATE - INTERVAL '14 days'
    GROUP BY эксперимент, вариант_теста
)
SELECT 
    эксперимент,
    вариант_теста,
    уникальных_пользователей,
    всего_событий,
    конверсии,
    добавления_в_корзину,
    ROUND(конверсии * 100.0 / NULLIF(уникальных_пользователей, 0), 4) AS конверсия_в_процентах,
    ROUND(доход, 2) AS доход,
    ROUND(доход / NULLIF(уникальных_пользователей, 0), 2) AS ARPU,
    ROUND(доход / NULLIF(конверсии, 0), 2) AS AOV (средний чек)
FROM test_results
ORDER BY эксперимент, вариант_теста;
```

### 5. Прогнозирование оттока

```sql
CREATE VIEW прогноз_оттока_пользователей AS
WITH user_features AS (
    SELECT 
        id_пользователя,
        COUNT(DISTINCT DATE_TRUNC('day', дата_события)) AS активных_дней_30д,
        COUNT(DISTINCT сессия_id) AS сессий_30д,
        COUNT(*) AS событий_30д,
        COUNT(CASE WHEN тип_события = 'purchase' THEN 1 END) AS покупок_30д,
        SUM(CASE WHEN тип_события = 'purchase' THEN (параметры->>'amount')::NUMERIC ELSE 0 END) AS доход_30д,
        MAX(дата_события) AS последнее_взаимодействие,
        DATE_PART('days', CURRENT_DATE - MAX(дата_события)) AS дней_без_взаимодействия
    FROM события_пользователей
    WHERE дата_события >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY id_пользователя
)
SELECT 
    id_пользователя,
    активных_дней_30д,
    сессий_30д,
    событий_30д,
    покупок_30д,
    доход_30д,
    дней_без_взаимодействия,
    CASE 
        WHEN дней_без_взаимодействия > 30 AND покупок_30д = 0 THEN 'высокий_риск_оттока'
        WHEN дней_без_взаимодействия > 21 AND покупок_30д < 2 THEN 'средний_риск_оттока'
        WHEN дней_без_взаимодействия > 14 AND активных_дней_30д < 3 THEN 'низкий_риск_оттока'
        ELSE 'активный_пользователь'
    END AS прогноз_статуса,
    CASE 
        WHEN доход_30д > 50000 THEN 'ценный_пользователь'
        WHEN доход_30д > 10000 THEN 'перспективный_пользователь'
        ELSE 'новый_пользователь'
    END AS уровень_ценности
FROM user_features
ORDER BY дней_без_взаимодействия DESC, доход_30д DESC;
```

### 6. Отчеты и дашборды

#### 6.1. Ежедневная аналитика

```sql
CREATE VIEW ежедневная_аналитика_пользователей AS
SELECT 
    DATE_TRUNC('day', дата_события) AS дата,
    COUNT(DISTINCT id_пользователя) AS уникальных_пользователей,
    COUNT(DISTINCT сессия_id) AS сессий,
    COUNT(*) AS событий_всего,
    COUNT(CASE WHEN тип_события = 'purchase' THEN 1 END) AS покупок,
    SUM(CASE WHEN тип_события = 'purchase' THEN (параметры->>'amount')::NUMERIC ELSE 0 END) AS выручка,
    COUNT(CASE WHEN тип_события = 'sign_up' THEN 1 END) AS регистраций,
    ROUND(COUNT(CASE WHEN тип_события = 'purchase' THEN 1 END) * 100.0 / NULLIF(COUNT(DISTINCT id_пользователя), 0), 4) AS конверсия,
    ROUND(SUM(CASE WHEN тип_события = 'purchase' THEN (параметры->>'amount')::NUMERIC ELSE 0 END) / NULLIF(COUNT(CASE WHEN тип_события = 'purchase' THEN 1 END), 0), 2) AS AOV,
    COUNT(DISTINCT CASE WHEN параметры ? 'product_id' THEN (параметры->>'product_id')::INTEGER END) AS просмотров_товаров
FROM события_пользователей
WHERE дата_события >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', дата_события)
ORDER BY дата DESC;
```

#### 6.2. Сравнительная аналитика

```sql
CREATE VIEW сравнительная_аналитика AS
WITH current_period AS (
    SELECT 
        COUNT(DISTINCT id_пользователя) AS активные_пользователи,
        COUNT(*) AS событий,
        COUNT(CASE WHEN тип_события = 'purchase' THEN 1 END) AS покупок,
        SUM(CASE WHEN тип_события = 'purchase' THEN (параметры->>'amount')::NUMERIC ELSE 0 END) AS выручка
    FROM события_пользователей
    WHERE дата_события >= CURRENT_DATE - INTERVAL '7 days'
),
previous_period AS (
    SELECT 
        COUNT(DISTINCT id_пользователя) AS активные_пользователи,
        COUNT(*) AS событий,
        COUNT(CASE WHEN тип_события = 'purchase' THEN 1 END) AS покупок,
        SUM(CASE WHEN тип_события = 'purchase' THEN (параметры->>'amount')::NUMERIC ELSE 0 END) AS выручка
    FROM события_пользователей
    WHERE дата_события >= CURRENT_DATE - INTERVAL '14 days'
        AND дата_события < CURRENT_DATE - INTERVAL '7 days'
)
SELECT 
    'Текущая неделя' AS период,
    cp.активные_пользователи,
    cp.событий,
    cp.покупок,
    cp.выручка,
    'N/A' AS изменение_пользователей,
    'N/A' AS изменение_событий,
    'N/A' AS изменение_покупок,
    'N/A' AS изменение_выручки
FROM current_period cp

UNION ALL

SELECT 
    'Предыдущая неделя' AS период,
    pp.активные_пользователи,
    pp.событий,
    pp.покупок,
    pp.выручка,
    ROUND(((cp.активные_пользователи - pp.активные_пользователи) * 100.0 / NULLIF(pp.активные_пользователи, 0)), 2) AS изменение_пользователей,
    ROUND(((cp.событий - pp.событий) * 100.0 / NULLIF(pp.событий, 0)), 2) AS изменение_событий,
    ROUND(((cp.покупок - pp.покупок) * 100.0 / NULLIF(pp.покупок, 0)), 2) AS изменение_покупок,
    ROUND(((cp.выручка - pp.выручка) * 100.0 / NULLIF(pp.выручка, 0)), 2) AS изменение_выручки
FROM previous_period pp
CROSS JOIN current_period cp;
```

### Заключение проекта 3

Проект аналитики пользователей демонстрирует:

1. Создание структуры для хранения пользовательских событий
2. Расчет поведенческих метрик
3. Сегментацию пользователей
4. Анализ воронки конверсии
5. Построение пользовательского пути
6. А/В тестирование
7. Прогнозирование оттока
8. Создание комплексных отчетов

Этот проект показывает, как SQL может использоваться для глубокого понимания поведения пользователей и принятия обоснованных решений по улучшению продукта.

---

## Глава 74: Проект 4: Управление инвентарем

### Введение

Эффективное управление инвентарем критично для любой компании, торгующей товарами. В этой главе мы разработаем комплексную систему управления инвентарем, включая учет запасов, анализ движения товаров, оптимизацию уровней запасов и управление поставками.

### 1. Структура данных для управления инвентарем

```sql
-- Таблица складов
CREATE TABLE склады (
    id SERIAL PRIMARY KEY,
    код_склада VARCHAR(20) UNIQUE NOT NULL,
    название VARCHAR(200) NOT NULL,
    адрес TEXT,
    тип_склада VARCHAR(50) CHECK (тип_склада IN ('основной', 'филиал', 'транзитный', 'возврат')),
    вместимость NUMERIC(10,2),  -- в кубических метрах или другой единице
    активен BOOLEAN DEFAULT TRUE,
    дата_создания TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица местоположений на складе (ячейки хранения)
CREATE TABLE ячейки_хранения (
    id SERIAL PRIMARY KEY,
    id_склада INTEGER NOT NULL REFERENCES склады(id),
    код_ячейки VARCHAR(50) NOT NULL,  -- например, 'A-01-01'
    описание TEXT,
    вместимость NUMERIC(8,2),
    тип_ячейки VARCHAR(50) CHECK (тип_ячейки IN ('обычная', 'холод', 'опасные_грузы', 'ценности')),
    активна BOOLEAN DEFAULT TRUE
);

-- Таблица поставщиков
CREATE TABLE поставщики (
    id SERIAL PRIMARY KEY,
    название VARCHAR(200) NOT NULL,
    контактное_лицо VARCHAR(100),
    телефон VARCHAR(20),
    email VARCHAR(100),
    адрес TEXT,
    рейтинг NUMERIC(2,1) CHECK (рейтинг >= 0 AND рейтинг <= 5),
    активен BOOLEAN DEFAULT TRUE,
    дата_сотрудничества DATE
);

-- Таблица категорий товаров
CREATE TABLE категории_товаров (
    id SERIAL PRIMARY KEY,
    название VARCHAR(100) NOT NULL UNIQUE,
    описание TEXT,
    нормы_хранения TEXT,  -- особые условия хранения
    родительская_категория INTEGER REFERENCES категории_товаров(id),
    активна BOOLEAN DEFAULT TRUE
);

-- Таблица хранения товарной номенклатуры
CREATE TABLE номенклатура (
    id SERIAL PRIMARY KEY,
    артикул VARCHAR(30) UNIQUE NOT NULL,
    наименование VARCHAR(300) NOT NULL,
    id_категории INTEGER REFERENCES категории_товаров(id),
    id_поставщика INTEGER REFERENCES поставщики(id),
    единица_измерения VARCHAR(20) DEFAULT 'шт',  -- шт, кг, литр, м и т.д.
    ширина NUMERIC(8,3),  -- в метрах
    высота NUMERIC(8,3),  -- в метрах
    глубина NUMERIC(8,3),  -- в метрах
    вес NUMERIC(8,3),     -- в кг
    объем NUMERIC(10,4),  -- в куб. м
    минимальный_остаток INTEGER DEFAULT 0,
    максимальный_остаток INTEGER DEFAULT 10000,
    точка_заказа INTEGER DEFAULT 0,
    срок_годности INTERVAL,
    условия_хранения TEXT,
    себестоимость NUMERIC(10,2),
    цена_продажи NUMERIC(10,2),
    активен BOOLEAN DEFAULT TRUE,
    дата_создания TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица движения товаров (инвентаризация)
CREATE TABLE движение_товаров (
    id SERIAL PRIMARY KEY,
    id_номенклатуры INTEGER NOT NULL REFERENCES номенклатура(id),
    id_склада INTEGER NOT NULL REFERENCES склады(id),
    id_ячейки INTEGER REFERENCES ячейки_хранения(id),
    тип_движения VARCHAR(20) NOT NULL CHECK (тип_движения IN ('приход', 'расход', 'перемещение', 'инвентаризация', 'битый')),
    количество INTEGER NOT NULL,
    цена NUMERIC(10,2),  -- для прихода товаров
    дата_движения DATE NOT NULL DEFAULT CURRENT_DATE,
    id_документа VARCHAR(50),  -- номер накладной, акта и т.д.
    комментарий TEXT,
    пользователь VARCHAR(100)
);

-- Таблица остатков товаров
CREATE TABLE остатки (
    id SERIAL PRIMARY KEY,
    id_номенклатуры INTEGER NOT NULL REFERENCES номенклатура(id),
    id_склада INTEGER NOT NULL REFERENCES склады(id),
    id_ячейки INTEGER REFERENCES ячейки_хранения(id),
    количество INTEGER NOT NULL DEFAULT 0,
    дата_учета DATE NOT NULL DEFAULT CURRENT_DATE,
    просрочено INTEGER DEFAULT 0,
    битый INTEGER DEFAULT 0,
    зарезервировано INTEGER DEFAULT 0,  -- для предстоящих отгрузок
    UNIQUE(id_номенклатуры, id_склада, id_ячейки)
);

-- Таблица заказов на поставку
CREATE TABLE заказы_на_поставку (
    id SERIAL PRIMARY KEY,
    номер_заказа VARCHAR(50) UNIQUE NOT NULL,
    id_поставщика INTEGER NOT NULL REFERENCES поставщики(id),
    дата_создания TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    дата_поставки_ожидаемая DATE,
    дата_поставки_фактическая DATE,
    статус VARCHAR(30) DEFAULT 'в_работе' CHECK (статус IN ('в_работе', 'подтвержден', 'в_пути', 'доставлен', 'принят', 'отменен')),
    общая_сумма NUMERIC(12,2),
    валюта VARCHAR(3) DEFAULT 'RUB',
    комментарий TEXT
);

-- Таблица позиций заказа на поставку
CREATE TABLE позиции_заказа_поставки (
    id SERIAL PRIMARY KEY,
    id_заказа INTEGER NOT NULL REFERENCES заказы_на_поставку(id) ON DELETE CASCADE,
    id_номенклатуры INTEGER NOT NULL REFERENCES номенклатура(id),
    количество_заказано INTEGER NOT NULL,
    количество_получено INTEGER DEFAULT 0,
    цена_закупки NUMERIC(10,2) NOT NULL,
    UNIQUE(id_заказа, id_номенклатуры)
);

-- Таблица для учета брака
CREATE TABLE брак (
    id SERIAL PRIMARY KEY,
    id_номенклатуры INTEGER NOT NULL REFERENCES номенклатура(id),
    id_склада INTEGER NOT NULL REFERENCES склады(id),
    количество INTEGER NOT NULL,
    дата_обнаружения DATE DEFAULT CURRENT_DATE,
    причина TEXT,
    статус VARCHAR(20) DEFAULT 'актуальный' CHECK (статус IN ('актуальный', 'исправлен', 'списан'))
);

-- Создадим тестовые данные
INSERT INTO склады (код_склада, название, адрес) VALUES
('WH001', 'Центральный склад', 'г. Москва, ул. Складская, д. 1'),
('WH002', 'Филиал СПб', 'г. Санкт-Петербург, пр. Северный, д. 5');

INSERT INTO поставщики (название, контактное_лицо, телефон) VALUES
('ООО "ТехноПоставка"', 'Иванов Петр', '+7(495)123-45-67'),
('ООО "ЭлектроГрупп"', 'Сидорова Мария', '+7(812)234-56-78');

INSERT INTO категории_товаров (название) VALUES
('Электроника'),
('Бытовая техника'),
('Одежда'),
('Книги');

INSERT INTO номенклатура (артикул, наименование, id_категории, id_поставщика, вес, минимальный_остаток, точка_заказа) VALUES
('EL-001', 'Смартфон iPhone 14', 1, 1, 0.171, 5, 10),
('BT-001', 'Холодильник LG', 2, 2, 65.0, 2, 3),
('OD-001', 'Куртка зимняя', 3, 1, 1.2, 10, 20);
```

### 2. Основные аналитические отчеты

#### 2.1. Текущие остатки на складах

```sql
CREATE VIEW текущие_остатки AS
WITH latest_inventory AS (
    SELECT 
        id_номенклатуры,
        id_склада,
        id_ячейки,
        количество,
        просрочено,
        битый,
        зарезервировано,
        дата_учета,
        ROW_NUMBER() OVER (
            PARTITION BY id_номенклатуры, id_склада, id_ячейки 
            ORDER BY дата_учета DESC
        ) AS rn
    FROM остатки
)
SELECT 
    n.артикул,
    n.наименование,
    s.название AS склад,
    y.код_ячейки,
    li.количество,
    li.зарезервировано,
    (li.количество - li.зарезервировано) AS доступно_для_отгрузки,
    li.просрочено,
    li.битый,
    n.минимальный_остаток,
    n.максимальный_остаток,
    n.точка_заказа,
    CASE 
        WHEN (li.количество - li.зарезервировано) < n.минимальный_остаток THEN 'Срочно пополнить'
        WHEN (li.количество - li.зарезервировано) < n.точка_заказа THEN 'Пополнить'
        WHEN li.количество > n.максимальный_остаток THEN 'Избыток'
        ELSE 'Норма'
    END AS рекомендация,
    (n.точка_заказа - (li.количество - li.зарезервировано)) AS необх_для_пополнения,
    ROUND(li.количество * n.себестоимость, 2) AS стоимость_запасов
FROM latest_inventory li
JOIN номенклатура n ON li.id_номенклатуры = n.id
JOIN склады s ON li.id_склада = s.id
LEFT JOIN ячейки_хранения y ON li.id_ячейки = y.id
WHERE li.rn = 1 AND n.активен = TRUE
ORDER BY склад, рекомендация, (li.количество - li.зарезервировано);
```

#### 2.2. Анализ движения товаров

```sql
CREATE VIEW анализ_движения_товаров AS
SELECT 
    n.артикул,
    n.наименование,
    s.название AS склад,
    dm.дата_движения,
    dm.тип_движения,
    dm.количество,
    dm.цена,
    dm.комментарий,
    dm.пользователь,
    SUM(CASE 
        WHEN dm.тип_движения = 'приход' THEN dm.количество
        WHEN dm.тип_движения = 'расход' THEN -dm.количество
        ELSE 0
    END) OVER (
        PARTITION BY dm.id_номенклатуры, dm.id_склада
        ORDER BY dm.дата_движения
    ) AS накопительный_остаток
FROM движение_товаров dm
JOIN номенклатура n ON dm.id_номенклатуры = n.id
JOIN склады s ON dm.id_склада = s.id
WHERE dm.дата_движения >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY dm.дата_движения DESC, n.артикул;
```

#### 2.3. Отчет по скоропортящимся товарам

```sql
CREATE VIEW скоропортящиеся_товары AS
WITH expiring_goods AS (
    SELECT 
        dm.id_номенклатуры,
        n.наименование,
        dm.id_склада,
        s.название AS склад,
        SUM(dm.количество) AS количество,
        dm.дата_движения,
        n.срок_годности,
        dm.дата_движения + n.срок_годности AS дата_окончания_годности,
        EXTRACT(DAY FROM (dm.дата_движения + n.срок_годности - CURRENT_DATE)) AS дней_до_окончания
    FROM движение_товаров dm
    JOIN номенклатура n ON dm.id_номенклатуры = n.id
    JOIN склады s ON dm.id_склада = s.id
    WHERE n.срок_годности IS NOT NULL
        -- Учитываем только свежеприбывшие товары (для оценки срока годности)
        AND dm.дата_движения + n.срок_годности > CURRENT_DATE
        AND dm.тип_движения = 'приход'
    GROUP BY dm.id_номенклатуры, n.наименование, dm.id_склада, s.название, dm.дата_движения, n.срок_годности
)
SELECT 
    артикул,
    наименование,
    склад,
    количество,
    срок_годности,
    дата_окончания_годности,
    дней_до_окончания,
    CASE 
        WHEN дней_до_окончания <= 0 THEN 'Просрочено'
        WHEN дни_до_окончания <= 3 THEN 'Критично'
        WHEN дни_до_окончания <= 7 THEN 'Внимание'
        WHEN дни_до_окончания <= 14 THEN 'Планировать реализацию'
        ELSE 'В норме'
    END AS статус,
    CASE 
        WHEN дни_до_окончания <= 7 THEN 'Спешите продать!'
        WHEN дни_до_окончания <= 14 THEN 'Рекомендуется скидка'
        ELSE 'Обычная реализация'
    END AS рекомендация
FROM expiring_goods e
JOIN номенклатура n ON e.id_номенклатуры = n.id
WHERE дни_до_окончания <= 14
ORDER BY дни_до_окончания, количество DESC;
```

### 3. Оптимизация уровней запасов

#### 3.1. Точка заказа (Reorder Point)

```sql
CREATE VIEW расчет_точек_заказа AS
WITH demand_analysis AS (
    SELECT 
        id_номенклатуры,
        AVG(количество) AS средний_спрос_в_день,
        STDDEV(количество) AS отклонение_спроса,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY количество) AS max_спрос_день
    FROM (
        SELECT 
            id_номенклатуры,
            COUNT(*) AS количество
        FROM движение_товаров
        WHERE тип_движения = 'расход'
            AND дата_движения >= CURRENT_DATE - INTERVAL '90 days'
        GROUP BY id_номенклатуры, дата_движения
    ) daily_demand
    GROUP BY id_номенклатуры
),
lead_time AS (
    SELECT 
        id_номенклатуры,
        AVG(EXTRACT(DAY FROM (дата_поставки_фактическая - дата_создания))) AS среднее_время_поставки
    FROM заказы_на_поставку zp
    JOIN позиции_заказа_поставки zpp ON zp.id = zpp.id_заказа
    WHERE дата_поставки_фактическая IS NOT NULL
    GROUP BY id_номенклатуры
)
SELECT 
    n.артикул,
    n.наименование,
    COALESCE(da.средний_спрос_в_день, 0) AS средний_спрос_день,
    COALESCE(lt.среднее_время_поставки, 0) AS время_поставки_дней,
    (COALESCE(da.средний_спрос_в_день, 0) * COALESCE(lt.среднее_время_поставки, 0)) AS ожидаемое_потребление,
    (COALESCE(da.max_спрос_день, 0) * COALESCE(lt.среднее_время_поставки, 0)) AS максимальное_ожид_потребление,
    n.минимальный_остаток AS страховой_запас,
    (COALESCE(da.средний_спрос_в_день, 0) * COALESCE(lt.среднее_время_поставки, 0) + n.минимальный_остаток) AS расчетная_точка_заказа,
    n.точка_заказа AS текущая_точка_заказа,
    CASE 
        WHEN (COALESCE(da.средний_спрос_в_день, 0) * COALESCE(lt.среднее_время_поставки, 0) + n.минимальный_остаток) > n.точка_заказа THEN 'Увеличить точку заказа'
        WHEN (COALESCE(da.средний_спрос_в_день, 0) * COALESCE(lt.среднее_время_поставки, 0) + n.минимальный_остаток) < n.точка_заказа THEN 'Уменьшить точку заказа'
        ELSE 'Точка заказа оптимальна'
    END AS рекомендация
FROM номенклатура n
LEFT JOIN demand_analysis da ON n.id = da.id_номенклатуры
LEFT JOIN lead_time lt ON n.id = lt.id_номенклатуры
WHERE n.активен = TRUE
ORDER BY расчетная_точка_заказа DESC NULLS LAST;
```

#### 3.2. ABC-XYZ анализ запасов

```sql
CREATE VIEW abc_xyz_инвентарь AS
WITH inventory_value AS (
    SELECT 
        n.id,
        n.артикул,
        n.наименование,
        n.категория_товаров,
        COALESCE(SUM(ost.количество * n.себестоимость), 0) AS стоимость_запасов,
        COALESCE(SUM(ost.количество), 0) AS количество_на_складе,
        COALESCE(
            (SELECT SUM(dm.количество) 
             FROM движение_товаров dm 
             WHERE dm.id_номенклатуры = n.id 
               AND dm.дата_движения >= CURRENT_DATE - INTERVAL '365 days'
               AND dm.тип_движения = 'расход'), 
            0
        ) AS оборот_год,
        COALESCE(
            (SELECT COUNT(DISTINCT DATE_TRUNC('month', dm.дата_движения)) 
             FROM движение_товаров dm 
             WHERE dm.id_номенклатуры = n.id 
               AND dm.дата_движения >= CURRENT_DATE - INTERVAL '365 days'
               AND dm.тип_движения = 'расход'), 
            0
        ) AS активных_месяцев
    FROM номенклатура n
    LEFT JOIN остатки ost ON n.id = ost.id_номенклатуры
    GROUP BY n.id, n.артикул, n.наименование, n.категория_товаров
),
abc_xyz_calc AS (
    SELECT *,
        CASE 
            WHEN PERCENT_RANK() OVER (ORDER BY стоимость_запасов DESC) <= 0.8 THEN 'A'
            WHEN PERCENT_RANK() OVER (ORDER BY стоимость_запасов DESC) <= 0.95 THEN 'B'
            ELSE 'C'
        END AS abc_категория,
        CASE 
            WHEN активных_месяцев = 12 THEN 'X'  -- стабильный спрос
            WHEN активных_месяцев BETWEEN 6 AND 11 THEN 'Y'  -- умеренный
            ELSE 'Z'  -- нерегулярный
        END AS xyz_категория
    FROM inventory_value
)
SELECT 
    abc_категория,
    xyz_категория,
    COUNT(*) AS номенклатуры,
    SUM(стоимость_запасов) AS общая_стоимость,
    AVG(стоимость_запасов) AS средняя_стоимость,
    AVG(оборот_год) AS средний_оборот,
    AVG(количество_на_складе) AS средний_остаток
FROM abc_xyz_calc
GROUP BY abc_категория, xyz_категория
ORDER BY abc_категория, xyz_категория;

-- Подробный анализ по номенклатуре
CREATE VIEW abc_xyz_номенклатура AS
WITH inventory_value AS (
    SELECT 
        n.id,
        n.артикул,
        n.наименование,
        n.категория_товаров,
        COALESCE(SUM(ost.количество * n.себестоимость), 0) AS стоимость_запасов,
        COALESCE(SUM(ost.количество), 0) AS количество_на_складе,
        COALESCE(
            (SELECT SUM(dm.количество) 
             FROM движение_товаров dm 
             WHERE dm.id_номенклатуры = n.id 
               AND dm.дата_движения >= CURRENT_DATE - INTERVAL '365 days'
               AND dm.тип_движения = 'расход'), 
            0
        ) AS оборот_год,
        COALESCE(
            (SELECT COUNT(DISTINCT DATE_TRUNC('month', dm.дата_движения)) 
             FROM движение_товаров dm 
             WHERE dm.id_номенклатуры = n.id 
               AND dm.дата_движения >= CURRENT_DATE - INTERVAL '365 days'
               AND dm.тип_движения = 'расход'), 
            0
        ) AS активных_месяцев,
        ROUND(
            (SELECT AVG(CASE WHEN dm.количество > 0 THEN dm.количество ELSE NULL END)
             FROM движение_товаров dm 
             WHERE dm.id_номенклатуры = n.id 
               AND dm.дата_движения >= CURRENT_DATE - INTERVAL '365 days'
               AND dm.тип_движения = 'расход'), 
            2
        ) AS среднемесячный_оборот
    FROM номенклатура n
    LEFT JOIN остатки ost ON n.id = ost.id_номенклатуры
    GROUP BY n.id, n.артикул, n.наименование, n.категория_товаров
),
abc_xyz_calc AS (
    SELECT *,
        CASE 
            WHEN PERCENT_RANK() OVER (ORDER BY стоимость_запасов DESC) <= 0.8 THEN 'A'
            WHEN PERCENT_RANK() OVER (ORDER BY стоимость_запасов DESC) <= 0.95 THEN 'B'
            ELSE 'C'
        END AS abc_категория,
        CASE 
            WHEN активных_месяцев = 12 AND ABS(среднемесячный_оборот - (оборот_год/12)) < среднемесячный_оборот*0.2 THEN 'X'
            WHEN активных_месяцев >= 6 THEN 'Y'
            ELSE 'Z'
        END AS xyz_категория
    FROM inventory_value
    WHERE стоимость_запасов > 0
)
SELECT 
    артикул,
    наименование,
    категория_товаров,
    abc_категория,
    xyz_категория,
    стоимость_запасов,
    количество_на_складе,
    оборот_год,
    активных_месяцев,
    среднемесячный_оборот,
    CASE 
        WHEN abc_категория = 'A' AND xyz_категория = 'X' THEN 'Ежедневный контроль, точный заказ'
        WHEN abc_категория = 'A' AND xyz_категория = 'Y' THEN 'Постоянный контроль, точное прогнозирование'
        WHEN abc_категория = 'A' AND xyz_категория = 'Z' THEN 'Месячный контроль, страховой запас'
        WHEN abc_категория = 'B' AND xyz_категория = 'X' THEN 'Еженедельный контроль'
        WHEN abc_категория = 'B' AND xyz_категория = 'Y' THEN 'Контроль по графику'
        WHEN abc_категория = 'B' AND xyz_категория = 'Z' THEN 'Раз в 2 недели'
        WHEN abc_категория = 'C' AND xyz_категория = 'X' THEN 'Простой контроль'
        WHEN abc_категория = 'C' AND xyz_категория = 'Y' THEN 'Регулярный контроль'
        ELSE 'Минимальный контроль'
    END AS стратегия_управления
FROM abc_xyz_calc
ORDER BY 
    CASE abc_категория 
        WHEN 'A' THEN 1 
        WHEN 'B' THEN 2 
        ELSE 3 
    END,
    abc_категория, 
    xyz_категория, 
    стоимость_запасов DESC;
```

### 4. Анализ поставок

#### 4.1. Отчет по поставкам

```sql
CREATE VIEW отчет_по_поставкам AS
SELECT 
    zp.номер_заказа,
    ps.название AS поставщик,
    zp.дата_создания,
    zp.дата_поставки_ожидаемая,
    zp.дата_поставки_фактическая,
    zp.статус,
    zp.общая_сумма,
    COUNT(zpp.id) AS позиций_в_заказе,
    SUM(zpp.количество_заказано) AS всего_единиц_заказано,
    SUM(zpp.количество_получено) AS всего_единиц_получено,
    ROUND(AVG(ps.рейтинг), 2) AS рейтинг_поставщика,
    CASE 
        WHEN zp.дата_поставки_фактическая IS NULL AND zp.дата_поставки_ожидаемая < CURRENT_DATE THEN 'Просрочено'
        WHEN zp.дата_поставки_фактическая IS NOT NULL AND zp.дата_поставки_фактическая > zp.дата_поставки_ожидаемая THEN 'С опозданием'
        WHEN zp.статус = 'доставлен' OR zp.статус = 'принят' THEN 'Вовремя'
        ELSE zp.статус
    END AS статус_поставки
FROM заказы_на_поставку zp
JOIN поставщики ps ON zp.id_поставщика = ps.id
LEFT JOIN позиции_заказа_поставки zpp ON zp.id = zpp.id_заказа
GROUP BY zp.id, zp.номер_заказа, ps.id, ps.название, zp.дата_создания, zp.дата_поставки_ожидаемая, 
         zp.дата_поставки_фактическая, zp.статус, zp.общая_сумма
ORDER BY zp.дата_создания DESC;
```

#### 4.2. Анализ поставщиков

```sql
CREATE VIEW анализ_поставщиков AS
WITH supplier_metrics AS (
    SELECT 
        ps.id,
        ps.название,
        ps.рейтинг,
        COUNT(zp.id) AS всего_заказов,
        COUNT(CASE WHEN zp.статус IN ('доставлен', 'принят') THEN 1 END) AS успешных_поставок,
        COUNT(CASE WHEN zp.дата_поставки_ожидаемая < COALESCE(zp.дата_поставки_фактическая, CURRENT_DATE) THEN 1 END) AS опоздавших_поставок,
        AVG(EXTRACT(DAY FROM (zp.дата_поставки_фактическая - zp.дата_создания))) AS среднее_время_выполнения,
        SUM(zp.общая_сумма) AS общая_сумма_заказов,
        COUNT(DISTINCT zpp.id_номенклатуры) AS номенклатур_поставлено
    FROM поставщики ps
    LEFT JOIN заказы_на_поставку zp ON ps.id = zp.id_поставщика
    LEFT JOIN позиции_заказа_поставки zpp ON zp.id = zpp.id_заказа
    WHERE ps.активен = TRUE
    GROUP BY ps.id, ps.название, ps.рейтинг
)
SELECT 
    название,
    рейтинг,
    всего_заказов,
    успешных_поставок,
    опоздавших_поставок,
    ROUND(успешных_поставок * 100.0 / NULLIF(всего_заказов, 0), 2) AS успешность_в_процентах,
    ROUND(опоздавших_поставок * 100.0 / NULLIF(всего_заказов, 0), 2) AS процент_опозданий,
    среднее_время_выполнения,
    общая_сумма_заказов,
    номенклатур_поставлено,
    CASE 
        WHEN рейтинг >= 4.5 THEN 'Отличный'
        WHEN рейтинг >= 3.5 THEN 'Хороший'
        WHEN рейтинг >= 2.5 THEN 'Удовлетворительный'
        ELSE 'Требует внимания'
    END AS оценка_поставщика
FROM supplier_metrics
ORDER BY рейтинг DESC, общая_сумма_заказов DESC;
```

### 5. Прогнозирование потребностей

#### 5.1. Прогнозирование спроса на товары

```sql
CREATE VIEW прогноз_спроса_товаров AS
WITH demand_history AS (
    SELECT 
        id_номенклатуры,
        DATE_TRUNC('month', дата_движения) AS месяц,
        SUM(CASE WHEN тип_движения = 'расход' THEN количество ELSE 0 END) AS monthly_sales
    FROM движение_товаров
    WHERE дата_движения >= CURRENT_DATE - INTERVAL '12 months'
        AND тип_движения = 'расход'
    GROUP BY id_номенклатуры, DATE_TRUNC('month', дата_движения)
),
demand_forecast AS (
    SELECT 
        id_номенклатуры,
        месяц,
        monthly_sales,
        -- Скользящее среднее за 3 месяца
        AVG(monthly_sales) OVER (
            PARTITION BY id_номенклатуры 
            ORDER BY месяц 
            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ) AS moving_avg_3m,
        -- Линейный тренд (упрощенный)
        REGR_SLOPE(monthly_sales, EXTRACT(EPOCH FROM месяц)/86400) OVER (
            PARTITION BY id_номенклатуры 
            ORDER BY месяц 
            ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
        ) AS trend_slope
    FROM demand_history
),
final_forecast AS (
    SELECT 
        id_номенклатуры,
        ROUND(AVG(moving_avg_3m)) AS avg_monthly_demand,
        ROUND(AVG(moving_avg_3m) + AVG(trend_slope) * 30) AS forecast_next_month
    FROM demand_forecast
    GROUP BY id_номенклатуры
)
SELECT 
    n.артикул,
    n.наименование,
    fc.avg_monthly_demand AS среднемесячный_спрос,
    fc.forecast_next_month AS прогноз_следующий_месяц,
    ost.количество AS текущий_остаток,
    (ost.количество - fc.forecast_next_month) AS избыток_недостаток,
    CASE 
        WHEN ost.количество < fc.forecast_next_month * 0.5 THEN 'Срочно заказать'
        WHEN ost.количество < fc.forecast_next_month THEN 'Заказать'
        WHEN ost.количество > fc.forecast_next_month * 2 THEN 'Избыток'
        ELSE 'В норме'
    END AS рекомендация
FROM final_forecast fc
JOIN номенклатура n ON fc.id_номенклатуры = n.id
JOIN (
    SELECT id_номенклатуры, SUM(количество) AS количество
    FROM остатки
    WHERE дата_учета = (SELECT MAX(дата_учета) FROM остатки)
    GROUP BY id_номенклатуры
) ost ON fc.id_номенклатуры = ost.id_номенклатуры
WHERE n.активен = TRUE
    AND fc.forecast_next_month > 0
ORDER BY ABS(избыток_недостаток) DESC;
```

### 6. Контроль качества и брак

#### 6.1. Анализ брака

```sql
CREATE VIEW анализ_брака AS
SELECT 
    n.артикул,
    n.наименование,
    b.количество AS количество_брака,
    b.дата_обнаружения,
    b.причина,
    b.статус,
    s.название AS склад,
    (b.количество * n.себестоимость) AS стоимость_брака
FROM брак b
JOIN номенклатура n ON b.id_номенклатуры = n.id
JOIN склады s ON b.id_склада = s.id
WHERE b.статус = 'актуальный'
ORDER BY b.дата_обнаружения DESC, стоимость_брака DESC;

CREATE VIEW статистика_брака_по_поставщикам AS
SELECT 
    ps.название AS поставщик,
    COUNT(b.id) AS случаев_брака,
    SUM(b.количество) AS единиц_брака,
    SUM(b.количество * n.себестоимость) AS общая_стоимость_брака,
    AVG(n.себестоимость) AS средняя_стоимость_единицы,
    COUNT(DISTINCT b.id_номенклатуры) AS затронутых_номенклатур
FROM брак b
JOIN номенклатура n ON b.id_номенклатуры = n.id
JOIN поставщики ps ON n.id_поставщика = ps.id
WHERE b.дата_обнаружения >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY ps.id, ps.название
ORDER BY общая_стоимость_брака DESC;
```

### 7. Комплексные отчеты

#### 7.1. Ежемесячный отчет по инвентарю

```sql
CREATE VIEW ежемесячный_отчет_инвентарь AS
WITH monthly_stats AS (
    SELECT 
        DATE_TRUNC('month', dm.дата_движения) AS месяц,
        dm.id_склада,
        s.название AS склад,
        SUM(CASE WHEN dm.тип_движения = 'приход' THEN dm.количество ELSE 0 END) AS приход_месяц,
        SUM(CASE WHEN dm.тип_движения = 'расход' THEN dm.количество ELSE 0 END) AS расход_месяц,
        SUM(CASE WHEN dm.тип_движения = 'битый' THEN dm.количество ELSE 0 END) AS брак_месяц,
        SUM(CASE WHEN dm.тип_движения = 'перемещение' THEN dm.количество ELSE 0 END) AS перемещения_месяц
    FROM движение_товаров dm
    JOIN склады s ON dm.id_склада = s.id
    WHERE dm.дата_движения >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY DATE_TRUNC('month', dm.дата_движения), dm.id_склада, s.название
)
SELECT 
    месяц,
    склад,
    приход_месяц,
    расход_месяц,
    брак_месяц,
    перемещения_месяц,
    (приход_месяч - расход_месяч - брак_месяч) AS чистое_движение,
    ROUND(брак_месяч * 100.0 / NULLIF(приход_месяч, 0), 2) AS процент_брака_от_прихода
FROM monthly_stats
ORDER BY месяц DESC, склад;
```

### Заключение проекта 4

Проект управления инвентарем демонстрирует:

1. Создание комплексной системы учета товаров
2. Расчет оптимальных уровней запасов
3. Прогнозирование спроса
4. Анализ эффективности поставщиков
5. Контроль качества и брака
6. Комплексную аналитику для принятия решений
7. Построение систем управления запасами

Этот проект показывает, как SQL может использоваться для оптимизации логистических процессов и снижения издержек на хранение товарных запасов.

---

## Глава 75: Решение реальных бизнес-задач

### Введение

В этой главе мы рассмотрим реальные бизнес-задачи и способы их решения с помощью SQL. Каждая задача будет включать постановку проблемы, анализ данных и разработку решения с пояснением логики.

### Задача 1: Оптимизация цепочки поставок

**Кейс:** Компания хочет оптимизировать цепочку поставок, определив узкие места и возможности для сокращения времени доставки.

```sql
-- Создадим таблицу для отслеживания этапов поставки
CREATE TABLE этапы_поставки (
    id SERIAL PRIMARY KEY,
    id_заказа_поставки INTEGER NOT NULL,
    этап VARCHAR(50) NOT NULL,  -- 'заказ_создан', 'заказ_подтвержден', 'отправлен', 'в_пути', 'доставлен'
    дата_начала TIMESTAMP NOT NULL,
    дата_окончания TIMESTAMP,
    ответственный VARCHAR(100),
    статус VARCHAR(20) DEFAULT 'в_процессе' CHECK (статус IN ('в_процессе', 'завершен', 'отменен')),
    комментарий TEXT
);

-- Пример решения: анализ времени на каждый этап
CREATE VIEW анализ_времени_поставки AS
WITH stage_durations AS (
    SELECT 
        esp.id_заказа_поставки,
        esp.этап,
        esp.дата_начала,
        esp.дата_окончания,
        EXTRACT(EPOCH FROM (esp.дата_окончания - esp.дата_начала))/3600 AS часы_на_этап, -- в часах
        esp.ответственный
    FROM этапы_поставки esp
    WHERE esp.дата_окончания IS NOT NULL
),
stage_stats AS (
    SELECT 
        этап,
        COUNT(*) AS количество_заказов,
        AVG(часы_на_этап) AS среднее_время_часы,
        STDDEV(часы_на_этап) AS отклонение,
        MAX(часы_на_этап) AS максимальное_время,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY часы_на_этап) AS 95_перцентиль
    FROM stage_durations
    GROUP BY этап
)
SELECT 
    этап,
    количество_заказов,
    ROUND(среднее_время_часы, 2) AS среднее_время_часы,
    ROUND(отклонение, 2) AS отклонение_часы,
    максимальное_время,
    95_перцентиль,
    CASE 
        WHEN среднее_время_часы > 24 THEN 'Критично медленный этап'
        WHEN среднее_время_часы > 8 THEN 'Медленный этап'
        WHEN среднее_время_часы > 2 THEN 'Удовлетворительный'
        ELSE 'Быстрый этап'
    END AS оценка_этапа
FROM stage_stats
ORDER BY среднее_время_часы DESC;
```

### Задача 2: Выявление мошеннических транзакций

**Кейс:** Компания хочет выявлять подозрительные финансовые операции для предотвращения мошенничества.

```sql
-- Используем уже созданную таблицу финансовых операций
CREATE VIEW анализ_подозрительных_операций AS
WITH transaction_patterns AS (
    SELECT 
        id_контрагента,
        SUM(сумма) AS общая_сумма,
        COUNT(*) AS количество_операций,
        COUNT(DISTINCT дата_операции) AS уникальных_дней,
        AVG(сумма) AS средняя_сумма,
        MIN(дата_операции) AS первая_дата,
        MAX(дата_операции) AS последняя_дата,
        STDDEV(сумма) AS отклонение_суммы
    FROM финансовые_операции
    WHERE дата_операции >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY id_контрагента
),
suspicious_indicators AS (
    SELECT *,
        CASE 
            WHEN общая_сумма > (SELECT AVG(общая_сумма) * 3 FROM transaction_patterns) THEN 1
            ELSE 0
        END AS high_volume_flag,
        CASE 
            WHEN средняя_сумма > (SELECT AVG(средняя_сумма) * 5 FROM transaction_patterns) THEN 1
            ELSE 0
        END AS high_average_flag,
        CASE 
            WHEN количество_операций > 10 AND уникальных_дней = 1 THEN 1
            ELSE 0
        END AS bulk_operations_flag,
        CASE 
            WHEN (последняя_дата - первая_дата) < INTERVAL '3 days' 
                 AND количество_операций > 20 THEN 1
            ELSE 0
        END AS rapid_activity_flag
    FROM transaction_patterns
)
SELECT 
    id_контрагента,
    общая_сумма,
    количество_операций,
    уникальных_дней,
    средняя_сумма,
    отклонение_суммы,
    (high_volume_flag + high_average_flag + bulk_operations_flag + rapid_activity_flag) AS индекс_риска,
    CASE 
        WHEN (high_volume_flag + high_average_flag + bulk_operations_flag + rapid_activity_flag) >= 3 THEN 'Высокий риск'
        WHEN (high_volume_flag + high_average_flag + bulk_operations_flag + rapid_activity_flag) >= 2 THEN 'Средний риск'
        WHEN (high_volume_flag + high_average_flag + bulk_operations_flag + rapid_activity_flag) >= 1 THEN 'Низкий риск'
        ELSE 'Нормальный'
    END AS уровень_риска
FROM suspicious_indicators
WHERE индекс_риска > 0
ORDER BY индекс_риска DESC, общая_сумма DESC;
```

### Задача 3: Анализ эффективности маркетинговых кампаний

**Кейс:** Определить ROI маркетинговых кампаний и оптимизировать бюджет.

```sql
-- Создадим структуру для маркетинговых кампаний
CREATE TABLE маркетинговые_кампании (
    id SERIAL PRIMARY KEY,
    название VARCHAR(200) NOT NULL,
    канал VARCHAR(50) NOT NULL,  -- email, social, ads, seo
    бюджет NUMERIC(10,2),
    дата_начала DATE,
    дата_окончания DATE,
    статус VARCHAR(20) DEFAULT 'активна' CHECK (статус IN ('черновик', 'активна', 'завершена', 'отменена')),
    цели TEXT  -- JSON с целями кампании
);

CREATE TABLE взаимодействия_с_кампаниями (
    id SERIAL PRIMARY KEY,
    id_кампании INTEGER NOT NULL REFERENCES маркетинговые_кампании(id),
    id_пользователя INTEGER,
    тип_взаимодействия VARCHAR(50) NOT NULL,  -- click, conversion, purchase
    дата_взаимодействия TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    стоимость_привлечения NUMERIC(10,2),  -- если известна
    комментарий TEXT
);

-- Анализ эффективности кампаний
CREATE VIEW эффективность_маркетинговых_кампаний AS
WITH campaign_stats AS (
    SELECT 
        mk.id,
        mk.название,
        mk.канал,
        mk.бюджет,
        mk.дата_начала,
        mk.дата_окончания,
        COUNT(vz.id) AS всего_взаимодействий,
        COUNT(CASE WHEN vz.тип_взаимодействия = 'conversion' THEN 1 END) AS конверсии,
        COUNT(CASE WHEN vz.тип_взаимодействия = 'purchase' THEN 1 END) AS покупки,
        SUM(CASE WHEN vz.тип_взаимодействия = 'purchase' THEN 
            (SELECT SUM(fo.сумма) FROM финансовые_операции fo WHERE fo.id_заказа IN (
                SELECT o.id FROM заказы o WHERE o.id_клиента = vz.id_пользователя
                AND o.дата_создания BETWEEN mk.дата_начала AND mk.дата_окончания
            ))
        END) AS доход_от_кампании
    FROM маркетинговые_кампании mk
    LEFT JOIN взаимодействия_с_кампаниями vz ON mk.id = vz.id_кампании
    WHERE mk.дата_окончания IS NOT NULL
    GROUP BY mk.id, mk.название, mk.канал, mk.бюджет, mk.дата_начала, mk.дата_окончания
)
SELECT 
    название,
    канал,
    бюджет,
    всего_взаимодействий,
    конверсии,
    покупки,
    доход_от_кампании,
    CASE 
        WHEN бюджет > 0 THEN ROUND((доход_от_кампании - бюджет) * 100.0 / бюджет, 2)
        ELSE NULL
    END AS ROI_в_процентах,
    CASE 
        WHEN доход_от_кампании > бюджет * 2 THEN 'Отличная эффективность'
        WHEN доход_от_кампании > бюджет * 1.5 THEN 'Хорошая эффективность'
        WHEN доход_от_кампании > бюджет THEN 'Удовлетворительная'
        WHEN доход_от_кампании > 0 THEN 'Низкая эффективность'
        ELSE 'Убыточная кампания'
    END AS оценка_эффективности,
    ROUND(доход_от_кампании / NULLIF(покупки, 0), 2) AS LTV_на_покупку
FROM campaign_stats
ORDER BY 
    CASE оценка_эффективности 
        WHEN 'Отличная эффективность' THEN 1
        WHEN 'Хорошая эффективность' THEN 2
        WHEN 'Удовлетворительная' THEN 3
        WHEN 'Низкая эффективность' THEN 4
        ELSE 5
    END,
    ROI_в_процентах DESC NULLS LAST;
```

### Задача 4: Прогнозирование оттока клиентов

**Кейс:** Компания хочет прогнозировать, какие клиенты склонны к оттоку, чтобы принять удерживающие меры.

```sql
CREATE VIEW прогноз_оттока_клиентов AS
WITH customer_behavior AS (
    SELECT 
        o.id_клиента,
        COUNT(o.id) AS заказов_за_период,
        SUM(o.общая_сумма) AS сумма_заказов,
        AVG(o.общая_сумма) AS средний_чек,
        MAX(o.дата_заказа) AS последний_заказ,
        MIN(o.дата_заказа) AS первый_заказ,
        -- Частота заказов
        COUNT(o.id) / NULLIF(EXTRACT(DAY FROM (MAX(o.дата_заказа) - MIN(o.дата_заказа)))::NUMERIC, 0) * 30 AS частота_в_месяц
    FROM заказы o
    WHERE o.дата_заказа >= CURRENT_DATE - INTERVAL '180 days'
    GROUP BY o.id_клиента
),
customer_status AS (
    SELECT *,
        EXTRACT(DAY FROM (CURRENT_DATE - последний_заказ)) AS дней_без_заказа,
        CASE 
            WHEN (CURRENT_DATE - последний_заказ) > INTERVAL '90 days' THEN 'высокий_риск'
            WHEN (CURRENT_DATE - последний_заказ) > INTERVAL '60 days' AND сумма_заказов < 10000 THEN 'средний_риск'
            WHEN частота_в_месяц < 0.5 AND (CURRENT_DATE - последний_заказ) > INTERVAL '30 days' THEN 'низкий_риск'
            ELSE 'активный'
        END AS прогноз_статуса,
        CASE 
            WHEN сумма_заказов > 100000 THEN 'VIP'
            WHEN сумма_заказов > 50000 THEN 'премиум'
            WHEN сумма_заказов > 10000 THEN 'ценный'
            ELSE 'новый'
        END AS сегмент_ценности
    FROM customer_behavior
)
SELECT 
    к.фамилия,
    к.имя,
    к.город,
    cs.заказов_за_период,
    cs.сумма_заказов,
    cs.средний_чек,
    cs.дней_без_заказа,
    cs.частота_в_месяц,
    cs.прогноз_статуса,
    cs.сегмент_ценности,
    CASE 
        WHEN cs.прогноз_статуса = 'высокий_риск' AND cs.сегмент_ценности IN ('VIP', 'премиум') THEN 'Срочные меры удержания'
        WHEN cs.прогноз_статуса = 'высокий_риск' THEN 'Предложить скидку'
        WHEN cs.прогноз_статуса = 'средний_риск' THEN 'Периодический контакт'
        ELSE 'Наблюдать'
    END AS рекомендуемое_действие
FROM customer_status cs
JOIN клиенты к ON cs.id_клиента = к.id
ORDER BY cs.дней_без_заказа DESC, cs.сумма_заказов DESC;
```

### Задача 5: Оптимизация ценовой стратегии

**Кейс:** Определить оптимальные цены для максимизации прибыли.

```sql
CREATE VIEW оптимизация_ценовой_стратегии AS
WITH price_elasticity AS (
    SELECT 
        id_товара,
        дата_заказа,
        цена_на_момент,
        количество,
        (SELECT AVG(цена_на_момент) FROM позиции_заказа WHERE id_товара = p.id_товара) AS средняя_цена,
        (SELECT AVG(количество) FROM позиции_заказа WHERE id_товара = p.id_товара) AS среднее_количество
    FROM позиции_заказа p
    JOIN заказы z ON p.id_заказа = z.id
    WHERE z.дата_заказа >= CURRENT_DATE - INTERVAL '12 months'
),
elasticity_calc AS (
    SELECT 
        id_товара,
        AVG(
            ((количество - среднее_количество) / NULLIF(среднее_количество, 0)) / 
            ((цена_на_момент - средняя_цена) / NULLIF(средняя_цена, 0))
        ) AS коэф_эластичности
    FROM price_elasticity
    GROUP BY id_товара
)
SELECT 
    t.артикул,
    t.название,
    t.цена AS текущая_цена,
    t.себестоимость,
    ec.коэф_эластичности,
    CASE 
        WHEN ec.коэф_эластичности < -2 THEN 'Рекомендуется снизить цену (высокая эластичность)'
        WHEN ec.коэф_эластичности BETWEEN -2 AND -0.5 THEN 'Текущая цена оптимальна'
        WHEN ec.коэф_эластичности > -0.5 THEN 'Рекомендуется повысить цену (низкая эластичность)'
        ELSE 'Недостаточно данных'
    END AS рекомендация,
    ROUND(t.цена * 1.1, 2) AS рекомендуемая_цена_с_10_проц_повышением,
    ROUND(t.цена * 0.9, 2) AS рекомендуемая_цена_с_10_проц_понижением
FROM elasticity_calc ec
JOIN товары t ON ec.id_товара = t.id
WHERE ec.коэф_эластичности IS NOT NULL
ORDER BY ABS(ec.коэф_эластичности) DESC;
```

### Задача 6: Управление качеством обслуживания

**Кейс:** Анализ времени обработки заказов и выявление узких мест в обслуживании.

```sql
-- Предположим, у нас есть история статусов заказов
CREATE TABLE история_статусов_заказа (
    id SERIAL PRIMARY KEY,
    id_заказа INTEGER NOT NULL REFERENCES заказы(id),
    старый_статус VARCHAR(20),
    новый_статус VARCHAR(20) NOT NULL,
    дата_изменения TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    комментарий TEXT,
    изменен_пользователем VARCHAR(100)
);

CREATE VIEW анализ_качества_обслуживания AS
WITH order_timeline AS (
    SELECT 
        z.id AS id_заказа,
        z.дата_создания AS дата_создания_заказа,
        hsz.дата_изменения AS дата_принятия_в_работу,
        hsz2.дата_изменения AS дата_комплектации,
        hsz3.дата_изменения AS дата_передачи_в_доставку,
        z.дата_доставки,
        z.общая_сумма
    FROM заказы z
    LEFT JOIN история_статусов_заказа hsz ON z.id = hsz.id_заказа 
        AND hsz.новый_статус = 'в_работе' 
        AND hsz.дата_изменения = (
            SELECT MIN(дата_изменения) FROM история_статусов_заказа 
            WHERE id_заказа = z.id AND новый_статус = 'в_работе'
        )
    LEFT JOIN история_статусов_заказа hsz2 ON z.id = hsz2.id_заказа 
        AND hsz2.новый_статус = 'собирается' 
        AND hsz2.дата_изменения = (
            SELECT MIN(дата_изменения) FROM история_статусов_заказа 
            WHERE id_заказа = z.id AND новый_статус = 'собирается'
        )
    LEFT JOIN история_статусов_заказа hsz3 ON z.id = hsz3.id_заказа 
        AND hsz3.новый_статус = 'в_доставке' 
        AND hsz3.дата_изменения = (
            SELECT MIN(дата_изменения) FROM история_статусов_заказа 
            WHERE id_заказа = z.id AND новый_статус = 'в_доставке'
        )
),
time_analysis AS (
    SELECT 
        id_заказа,
        общая_сумма,
        дата_создания_заказа,
        дата_принятия_в_работу,
        дата_комплектации,
        дата_передачи_в_доставку,
        дата_доставки,
        EXTRACT(EPOCH FROM (дата_принятия_в_работу - дата_создания_заказа))/3600 AS время_до_принятия_часы,
        EXTRACT(EPOCH FROM (дата_комплектации - дата_принятия_в_работу))/3600 AS время_комплектации_часы,
        EXTRACT(EPOCH FROM (дата_передачи_в_доставку - дата_комплектации))/3600 AS время_до_доставки_часы,
        EXTRACT(EPOCH FROM (дата_доставки - дата_передачи_в_доставку))/3600 AS время_доставки_часы
    FROM order_timeline
    WHERE дата_передачи_в_доставку IS NOT NULL
)
SELECT 
    COUNT(*) AS всего_заказов,
    ROUND(AVG(время_до_принятия_часы), 2) AS среднее_ожидание_часы,
    ROUND(AVG(время_комплектации_часы), 2) AS среднее_комплектация_часы,
    ROUND(AVG(время_до_доставки_часы), 2) AS среднее_доставка_склад_часы,
    ROUND(AVG(время_доставки_часы), 2) AS среднее_доставка_часы,
    ROUND(AVG(время_до_принятия_часы + время_комплектации_часы + время_до_доставки_часы + время_доставки_часы), 2) AS среднее_общее_время_часы,
    COUNT(CASE WHEN (время_до_принятия_часы + время_комплектации_часы + время_до_доставки_часы + время_доставки_часы) > 48 THEN 1 END) AS заказов_с_опозданием,
    ROUND(COUNT(CASE WHEN (время_до_принятия_часы + время_комплектации_часы + время_до_доставки_часы + время_доставки_часы) > 48 THEN 1 END) * 100.0 / COUNT(*), 2) AS процент_опоздавших
FROM time_analysis
WHERE дата_доставки IS NOT NULL;
```

### Заключение проекта 75

Этот проект показывает, как SQL может решать реальные бизнес-задачи:

1. Оптимизация операционной эффективности
2. Выявление мошенничества
3. Анализ маркетинговых кампаний
4. Прогнозирование поведения клиентов
5. Ценовая оптимизация
6. Контроль качества обслуживания

Каждое решение основано на реальных бизнес-процессах и показывает, как аналитика может способствовать принятию обоснованных управленческих решений.

### Заключение по всему курсу

SQL - мощный язык, позволяющий извлекать ценную информацию из данных. В этом курсе мы рассмотрели:

1. Основы SQL и работу с базовыми запросами
2. Продвинутые возможности: оконные функции, CTE, подзапросы
3. Управление базами данных: таблицы, ключи, ограничения
4. Условные выражения и функции обработки данных
5. Оптимизацию запросов и индексы
6. Практические проекты по различным аспектам бизнеса

Знание SQL открывает возможности для карьерного роста в аналитике данных, бизнес-анализе, разработке и других областях, требующих работы с данными.

Практика - ключ к мастерству SQL. Регулярное выполнение запросов и решение задач позволит закрепить знания и развить профессиональные навыки.