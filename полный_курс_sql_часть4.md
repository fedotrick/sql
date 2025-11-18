# Полный курс SQL: От новичка до профессионала (Часть 4)

## Оглавление

### Раздел 5: Продвинутые техники SQL (продолжение)
- Глава 46: Window функции (расширенное использование) (продолжение)

### Раздел 6: Управление базами данных
- Глава 47: Типы данных
- Глава 48: Первичные и внешние ключи
- Глава 49: Ограничения
- Глава 50: Создание таблиц (CREATE TABLE)
- Глава 51: Вставка данных (INSERT)
- Глава 52: Обновление данных (UPDATE)
- Глава 53: Удаление данных (DELETE)
- Глава 54: Изменение структуры таблиц (ALTER TABLE)
- Глава 55: Удаление таблиц (DROP TABLE)
- Глава 56: Транзакции

### Раздел 7: Условные выражения и аналитические функции
- Глава 57: Введение в условные выражения
- Глава 58: CASE
- Глава 59: Задание: CASE
- Глава 60: COALESCE
- Глава 61: CAST
- Глава 62: NULLIF
- Глава 63: Представления (Views)
- Глава 64: Индексы и оптимизация запросов

# Раздел 5: Продвинутые техники SQL (продолжение)

## Глава 46: Window функции (расширенное использование) (продолжение)

### Продвинутые примеры из реальной практики

#### Пример 6: Сложный аналитический запрос с множественными оконными функциями

```sql
-- Комплексный анализ клиентской активности с использованием оконных функций
WITH клиенты_с_подробной_статистикой AS (
    SELECT 
        к.id AS клиент_id,
        к.фамилия,
        к.имя,
        к.город,
        к.дата_регистрации,
        з.дата_заказа,
        з.общая_сумма,
        -- Номер заказа по времени для каждого клиента
        ROW_NUMBER() OVER (
            PARTITION BY к.id 
            ORDER BY з.дата_заказа
        ) AS номер_заказа_по_времени,
        -- Ранг заказа по сумме для клиента
        RANK() OVER (
            PARTITION BY к.id 
            ORDER BY з.общая_сумма DESC
        ) AS ранг_заказа_по_сумме,
        -- Скользящее среднее за последние 3 заказа
        AVG(з.общая_сумма) OVER (
            PARTITION BY к.id 
            ORDER BY з.дата_заказа 
            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ) AS среднее_за_3_заказа,
        -- Кумулятивная сумма заказов
        SUM(з.общая_сумма) OVER (
            PARTITION BY к.id 
            ORDER BY з.дата_заказа 
            ROWS UNBOUNDED PRECEDING
        ) AS накопительная_сумма
    FROM клиенты к
    JOIN заказы з ON к.id = з.id_клиента
)
SELECT 
    фамилия,
    имя,
    дата_заказа,
    общая_сумма,
    номер_заказа_по_времени,
    ранг_заказа_по_сумме,
    среднее_за_3_заказа,
    накопительная_сумма,
    -- Отношение текущего заказа к среднему
    CASE 
        WHEN среднее_за_3_заказа > 0 THEN 
            ROUND((общая_сумма / среднее_за_3_заказа - 1) * 100, 2)
        ELSE 0
    END AS отклонение_в_процентах_от_среднего,
    -- Является ли заказ аномальным (> в 2 раза среднего за 3 заказа)
    CASE 
        WHEN общая_сумма > 2 * среднее_за_3_заказа THEN 'АНОМАЛЬНЫЙ'
        WHEN ранг_заказа_по_сумме = 1 THEN 'РЕКОРДНЫЙ'
        ELSE 'ОБЫЧНЫЙ'
    END AS тип_заказа
FROM клиенты_с_подробной_статистикой
WHERE номер_заказа_по_времени >= 3  -- После как минимум 3 заказов
ORDER BY клиент_id, дата_заказа
LIMIT 25;
```

#### Пример 7: Определение трендов с использованием оконных функций

```sql
-- Анализ трендов в заказах клиентов
WITH заказы_с_трендами AS (
    SELECT 
        id_клиента,
        дата_заказа,
        общая_сумма,
        -- Предыдущая сумма заказа
        LAG(общая_сумма) OVER (
            PARTITION BY id_клиента 
            ORDER BY дата_заказа
        ) AS предыдущая_сумма,
        -- Скользящее среднее за 3 заказа
        AVG(общая_сумма) OVER (
            PARTITION BY id_клиента 
            ORDER BY дата_заказа 
            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ) AS среднее_за_3_заказа,
        -- Порядковый номер заказа
        ROW_NUMBER() OVER (
            PARTITION BY id_клиента 
            ORDER BY дата_заказа
        ) AS номер_заказа
    FROM заказы
)
SELECT 
    id_клиента,
    дата_заказа,
    общая_сумма,
    предыдущая_сумма,
    среднее_за_3_заказа,
    -- Тренд по сравнению с предыдущим заказом
    CASE 
        WHEN предыдущая_сумма IS NULL THEN 'ПЕРВЫЙ ЗАКАЗ'
        WHEN общая_сумма > предыдущая_сумма THEN 'РОСТ'
        WHEN общая_сумма < предыдущая_сумма THEN 'ПАДЕНИЕ'
        ELSE 'СТАБИЛЬНО'
    END AS тренд_по_сравнению_с_предыдущим,
    -- Тренд по сравнению со скользящим средним
    CASE 
        WHEN среднее_за_3_заказа IS NOT NULL AND общая_сумма > среднее_за_3_заказа THEN 'ВЫШЕ СРЕДНЕГО'
        WHEN среднее_за_3_заказа IS NOT NULL AND общая_сумма < среднее_за_3_заказа THEN 'НИЖЕ СРЕДНЕГО'
        ELSE 'СРЕДНИЙ'
    END AS позиция_относительно_среднего
FROM заказы_с_трендами
WHERE номер_заказа > 1  -- Начинаем после первого заказа
ORDER BY id_клиента, дата_заказа
LIMIT 30;
```

### Практические сценарии бизнес-аналитики

#### Пример 8: RFM-анализ с использованием оконных функций

RFM (Recency, Frequency, Monetary) анализ - популярный метод сегментации клиентов:

```sql
WITH rfm_данные AS (
    SELECT 
        к.id AS клиент_id,
        к.фамилия,
        к.имя,
        -- Recency: сколько дней прошло с последнего заказа
        EXTRACT(DAY FROM (CURRENT_DATE - MAX(з.дата_заказа))) AS дни_с_последнего_заказа,
        -- Frequency: сколько всего заказов
        COUNT(з.id) AS количество_заказов,
        -- Monetary: общая сумма заказов
        SUM(з.общая_сумма) AS общая_сумма,
        -- Средний чек
        AVG(з.общая_сумма) AS средний_чек
    FROM клиенты к
    LEFT JOIN заказы з ON к.id = з.id_клиента
    GROUP BY к.id, к.фамилия, к.имя
),
rfm_с_оценками AS (
    SELECT 
        *,
        -- Оценка Recency (чем меньше дней, тем выше оценка)
        NTILE(5) OVER (ORDER BY дни_с_последнего_заказа ASC) AS r_оценка,
        -- Оценка Frequency (чем больше заказов, тем выше оценка)
        NTILE(5) OVER (ORDER BY количество_заказов DESC) AS f_оценка,
        -- Оценка Monetary (чем больше сумма, тем выше оценка)
        NTILE(5) OVER (ORDER BY общая_сумма DESC) AS m_оценка
    FROM rfm_данные
)
SELECT 
    фамилия,
    имя,
    дни_с_последнего_заказа,
    количество_заказов,
    общая_сумма,
    r_оценка,
    f_оценка,
    m_оценка,
    -- Общий RFM-скор
    (r_оценка + f_оценка + m_оценка) AS rfm_скор,
    -- Сегментация на основе оценок
    CASE 
        WHEN r_оценка >= 4 AND f_оценка >= 4 AND m_оценка >= 4 THEN 'Лучшие клиенты'
        WHEN r_оценка >= 3 AND f_оценка >= 3 THEN 'Лояльные клиенты'
        WHEN r_оценка >= 4 AND m_оценка >= 4 THEN 'Потенциально ценные'
        WHEN r_оценка <= 2 THEN 'Покинувшие клиенты'
        WHEN f_оценка <= 2 AND m_оценка <= 2 THEN 'Низкая ценность'
        ELSE 'Другое'
    END AS сегмент
FROM rfm_с_оценками
ORDER BY rfm_скор DESC, общая_сумма DESC
LIMIT 15;
```

#### Пример 9: Анализ "жизненного цикла" клиента

```sql
WITH клиенты_с_жизненным_циклом AS (
    SELECT 
        к.id AS клиент_id,
        к.фамилия,
        к.имя,
        к.дата_регистрации,
        MIN(з.дата_заказа) AS первый_заказ,
        MAX(з.дата_заказа) AS последний_заказ,
        COUNT(з.id) AS всего_заказов,
        SUM(з.общая_сумма) AS общая_сумма,
        -- Средний интервал между заказами
        AVG(EXTRACT(DAY FROM (
            з.дата_заказа - LAG(з.дата_заказа) OVER (
                PARTITION BY к.id 
                ORDER BY з.дата_заказа
            )
        ))) AS средний_интервал_между_заказами
    FROM клиенты к
    LEFT JOIN заказы з ON к.id = з.id_клиента
    GROUP BY к.id, к.фамилия, к.имя, к.дата_регистрации
)
SELECT 
    фамилия,
    имя,
    дата_регистрации,
    первый_заказ,
    последний_заказ,
    всего_заказов,
    общая_сумма,
    средний_интервал_между_заказами,
    -- Возраст клиента в днях
    EXTRACT(DAY FROM (CURRENT_DATE - дата_регистрации)) AS возраст_клиента_в_днях,
    -- Дней с последнего заказа
    EXTRACT(DAY FROM (CURRENT_DATE - последний_заказ)) AS дней_без_заказа,
    -- Классификация по активности
    CASE 
        WHEN последний_заказ IS NULL THEN 'Нет заказов'
        WHEN EXTRACT(DAY FROM (CURRENT_DATE - последний_заказ)) <= 30 THEN 'Активный'
        WHEN EXTRACT(DAY FROM (CURRENT_DATE - последний_заказ)) <= 90 THEN 'Малоактивный'
        WHEN EXTRACT(DAY FROM (CURRENT_DATE - последний_заказ)) <= 180 THEN 'Снижение активности'
        ELSE 'Неактивный'
    END AS статус_активности
FROM клиенты_с_жизненным_циклом
ORDER BY общая_сумма DESC
LIMIT 20;
```

### Заключение по главе 46

Расширенное использование оконных функций открывает огромные возможности для анализа данных. Они позволяют создавать сложные аналитические запросы, которые иначе потребовали бы сложной логики на уровне приложения. Оконные функции особенно мощны при решении задач:

1. Ранжирования и сравнения данных
2. Вычисления скользящих метрик
3. Определения трендов и паттернов
4. Сегментации клиентов
5. Бизнес-аналитики

Важно понимать рамки окон, эффективно использовать PARTITION BY и ORDER BY, а также комбинировать оконные функции с другими возможностями SQL для достижения максимальной эффективности анализа.

---

# Раздел 6: Управление базами данных

## Глава 47: Типы данных

### Введение

Типы данных определяют, какие значения могут храниться в столбцах таблицы и как эти значения обрабатываются. Правильный выбор типа данных влияет на эффективность хранения и производительность запросов. В PostgreSQL доступна широкая номенклатура типов данных, от простых числовых и строковых до сложных структур данных.

### Числовые типы данных

#### Целые числа

```sql
-- SMALLINT: 2 байта, диапазон от -32,768 до 32,767
CREATE TABLE пример_маленькое_целое (
    id SMALLINT
);

-- INTEGER (или INT): 4 байта, диапазон от -2,147,483,648 до 2,147,483,647
CREATE TABLE пример_целое (
    id INTEGER,
    количество INTEGER DEFAULT 0
);

-- BIGINT: 8 байтов, диапазон от -9,223,372,036,854,775,808 до 9,223,372,036,854,775,807
CREATE TABLE пример_большое_целое (
    id BIGINT,
    внешний_id BIGINT
);
```

#### Дробные числа

```sql
-- NUMERIC / DECIMAL: точные числа с фиксированной точностью
CREATE TABLE пример_точные_числа (
    цена NUMERIC(10, 2),  -- 10 цифр всего, 2 после запятой
    точное_значение DECIMAL(15, 5)
);

-- REAL: приблизительное число, 4 байта
CREATE TABLE пример_real (
    координата_x REAL,
    координата_y REAL
);

-- DOUBLE PRECISION: приблизительное число, 8 байтов
CREATE TABLE пример_double (
    координата_x DOUBLE PRECISION,
    координата_y DOUBLE PRECISION,
    высокая_точность DOUBLE PRECISION
);
```

### Строковые типы данных

#### Фиксированной и переменной длины

```sql
-- CHAR(n): фиксированная длина, дополнение пробелами
CREATE TABLE пример_char (
    код CHAR(10)  -- всегда будет занимать 10 символов
);

-- VARCHAR(n): переменная длина до n символов
CREATE TABLE пример_varchar (
    фамилия VARCHAR(50),
    имя VARCHAR(50),
    отчество VARCHAR(50),
    email VARCHAR(100)
);

-- VARCHAR без ограничения: переменная длина без ограничений
CREATE TABLE пример_varchar_неограничено (
    комментарий VARCHAR
);

-- TEXT: текст неограниченной длины
CREATE TABLE пример_text (
    описание TEXT,
    примечание TEXT
);
```

### Типы данных даты и времени

```sql
-- DATE: только дата (год-месяц-день)
CREATE TABLE пример_date (
    дата_рождения DATE,
    дата_регистрации DATE
);

-- TIME: только время (часы:минуты:секунды)
CREATE TABLE пример_time (
    время_начала TIME,
    время_окончания TIME
);

-- TIMESTAMP: дата и время без часового пояса
CREATE TABLE пример_timestamp (
    дата_создания TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    время_обновления TIMESTAMP
);

-- TIMESTAMP WITH TIME ZONE: дата и время с часовыми поясами
CREATE TABLE пример_timestamp_tz (
    время_создания TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    время_заказа TIMESTAMP WITH TIME ZONE
);

-- INTERVAL: разница между двумя значениями времени
CREATE TABLE пример_interval (
    продолжительность INTERVAL
);
```

### Логический тип данных

```sql
-- BOOLEAN: логическое значение (true/false)
CREATE TABLE пример_boolean (
    активен BOOLEAN DEFAULT TRUE,
    подтвержден BOOLEAN,
    является_клиентом BOOLEAN DEFAULT FALSE
);
```

### Бинарные данные

```sql
-- BYTEA: бинарная строка переменной длины
CREATE TABLE пример_bytea (
    файл_данные BYTEA,
    хеш_значение BYTEA
);
```

### Сетевые адреса

```sql
-- INET: IPv4 или IPv6 сетевой адрес
CREATE TABLE пример_inet (
    ip_адрес INET,
    клиент_ip INET
);

-- CIDR: сетевой адрес класса
CREATE TABLE пример_cidr (
    сеть CIDR
);

-- MACADDR: MAC адрес
CREATE TABLE пример_macaddr (
    mac_адрес MACADDR
);
```

### JSON типы данных

```sql
-- JSON: текстовый формат JSON
CREATE TABLE пример_json (
    данные JSON
);

-- JSONB: бинарный формат JSON (более эффективный)
CREATE TABLE пример_jsonb (
    данные JSONB,
    профиль JSONB
);
```

### Массивы

```sql
-- Массивы различных типов
CREATE TABLE пример_массивы (
    теги TEXT[],
    числа INTEGER[],
    координаты DOUBLE PRECISION[]
);

-- Примеры работы с массивами
INSERT INTO пример_массивы (теги, числа) VALUES 
(ARRAY['новый', 'горячий', 'популярный'], ARRAY[1, 2, 3, 4, 5]);
```

### Перечисления (ENUM)

```sql
-- Создание пользовательского типа перечисления
CREATE TYPE статус_заказа AS ENUM ('новый', 'оплачен', 'в_доставке', 'доставлен', 'отменен');

-- Использование перечисления
CREATE TABLE пример_enum (
    id SERIAL PRIMARY KEY,
    статус статус_заказа DEFAULT 'новый',
    приоритет статус_заказа
);
```

### Геометрические типы

```sql
-- Точка
CREATE TABLE пример_точка (
    местоположение POINT
);

-- Прямоугольник
CREATE TABLE пример_прямоугольник (
    область BOX
);
```

### Практические рекомендации по выбору типов данных

#### 1. Выбор подходящего размера целых чисел

```sql
-- Плохо: использовать BIGINT для счетчика, который никогда не превысит 1000
CREATE TABLE плохой_пример (
    id BIGINT,  -- избыточно для маленьких значений
    количество BIGINT
);

-- Хорошо: использовать подходящий тип
CREATE TABLE хороший_пример (
    id SERIAL,  -- автоматически INTEGER
    количество INTEGER,  -- подходит для большинства счетчиков
    уникальный_id BIGINT  -- только если действительно большие значения
);
```

#### 2. Точность в финансовых данных

```sql
-- Правильно: для финансовых данных использовать NUMERIC
CREATE TABLE финансовые_операции (
    сумма NUMERIC(15, 2),  -- до 13 знаков до запятой, 2 после
    курс_валюты NUMERIC(10, 6)  -- для точных валютных курсов
);

-- Неправильно: использовать REAL для денег
CREATE TABLE неправильный_фин_пример (
    сумма REAL  -- может привести к ошибкам округления
);
```

#### 3. Эффективность строковых типов

```sql
-- Правильно: использовать VARCHAR с разумным ограничением
CREATE TABLE пользователи (
    email VARCHAR(255),  -- email обычно не длиннее 255 символов
    имя VARCHAR(50),
    фамилия VARCHAR(50)
);

-- Правильно: использовать TEXT для длинных текстов
CREATE TABLE статьи (
    заголовок VARCHAR(200),
    содержание TEXT  -- неограниченная длина для содержания
);
```

### Особенности типов данных в PostgreSQL

#### Автоматические преобразования

```sql
-- PostgreSQL может автоматически преобразовывать типы
SELECT '2023-01-01'::DATE + INTERVAL '1 day';  -- Преобразует строку в дату
SELECT 10 * 1.5;  -- Преобразует INTEGER в NUMERIC для точности
```

#### Пользовательские типы

```sql
-- Создание составного типа
CREATE TYPE адрес_типо AS (
    улица TEXT,
    дом INTEGER,
    квартира INTEGER,
    город TEXT
);

-- Использование составного типа
CREATE TABLE клиенты_с_адресом (
    id SERIAL PRIMARY KEY,
    имя VARCHAR(100),
    адрес адрес_типо
);
```

### Проверка типов данных

#### Проверка типов столбцов в существующей таблице

```sql
-- Просмотр информации о столбцах таблицы
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_name = 'заказы';
```

### Практические примеры типов данных из нашего курса

```sql
-- Пример таблицы клиентов с правильными типами данных
CREATE TABLE клиенты_с_типами (
    id SERIAL PRIMARY KEY,
    фамилия VARCHAR(50) NOT NULL,
    имя VARCHAR(50) NOT NULL,
    отчество VARCHAR(50),
    дата_рождения DATE,
    email VARCHAR(100) UNIQUE,
    телефон VARCHAR(20),
    город VARCHAR(50),
    адрес TEXT,
    активен BOOLEAN DEFAULT TRUE,
    дата_регистрации TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    количество_входов INTEGER DEFAULT 0,
    последний_вход TIMESTAMP,
    профиль JSONB  -- для гибких пользовательских данных
);

-- Пример таблицы товаров
CREATE TABLE товары_с_типами (
    id SERIAL PRIMARY KEY,
    наименование VARCHAR(200) NOT NULL,
    описание TEXT,
    цена NUMERIC(10, 2) NOT NULL,
    количество_на_складе INTEGER DEFAULT 0,
    категория VARCHAR(50),
    вес DOUBLE PRECISION,  -- для точности взвешивания
    размеры JSONB,  -- размеры могут быть сложной структурой
    дата_добавления TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    доступен BOOLEAN DEFAULT TRUE
);

-- Пример таблицы заказов
CREATE TABLE заказы_с_типами (
    id SERIAL PRIMARY KEY,
    id_клиента INTEGER NOT NULL,
    дата_заказа TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    общая_сумма NUMERIC(12, 2),
    статус статус_заказа DEFAULT 'новый',  -- ENUM тип
    комментарий TEXT,
    данные_доставки JSONB,  -- детали доставки
    FOREIGN KEY (id_клиента) REFERENCES клиенты(id)
);
```

### Заключение главы

Выбор правильных типов данных - критически важный аспект проектирования базы данных. Он влияет на:

1. Эффективность хранения данных
2. Производительность запросов
3. Целостность данных
4. Возможности индексации
5. Удобство работы с данными

Понимание и правильное использование различных типов данных является основой для создания эффективных и надежных баз данных.

---

## Глава 48: Первичные и внешние ключи

### Введение

Первичные и внешние ключи - это фундаментальные концепции реляционных баз данных, обеспечивающие целостность данных и связи между таблицами. Они определяют структуру базы данных и гарантируют, что данные остаются точными и согласованными.

### Первичные ключи (Primary Key)

#### Что такое первичный ключ

Первичный ключ - это столбец или комбинация столбцов, которая уникально идентифицирует каждую строку в таблице. У первичного ключа есть два важных свойства:

1. Уникальность: значение первичного ключа не может повторяться
2. Не может быть NULL: значение первичного ключа обязательно должно быть указано

#### Создание первичного ключа

```sql
-- Пример 1: Первичный ключ при создании таблицы
CREATE TABLE клиенты_pk (
    id SERIAL PRIMARY KEY,  -- SERIAL автоматически создает уникальные значения
    фамилия VARCHAR(50) NOT NULL,
    имя VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE
);

-- Пример 2: Комбинированный первичный ключ (составной)
CREATE TABLE заказы_товары (
    id_заказа INTEGER NOT NULL,
    id_товара INTEGER NOT NULL,
    количество INTEGER NOT NULL,
    цена NUMERIC(10, 2),
    PRIMARY KEY (id_заказа, id_товара)  -- комбинация столбцов как первичный ключ
);

-- Пример 3: Первичный ключ через отдельное определение
CREATE TABLE товары_pk (
    артикул VARCHAR(20) NOT NULL,
    наименование VARCHAR(200) NOT NULL,
    цена NUMERIC(10, 2),
    PRIMARY KEY (артикул)
);
```

#### SERIAL vs UUID

```sql
-- SERIAL: автоматически генерируемые числовые идентификаторы
CREATE TABLE пример_serial (
    id SERIAL PRIMARY KEY,
    имя VARCHAR(100)
);

-- UUID: глобально уникальные идентификаторы
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- для генерации UUID

CREATE TABLE пример_uuid (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    имя VARCHAR(100)
);
```

### Внешние ключи (Foreign Key)

#### Что такое внешний ключ

Внешний ключ - это столбец или комбинация столбцов, которая создает связь между двумя таблицами. Внешний ключ указывает на первичный ключ другой таблицы, обеспечивая ссылочную целостность.

#### Создание внешнего ключа

```sql
-- Пример 1: Создание таблицы с внешним ключом
CREATE TABLE заказы_fk (
    id SERIAL PRIMARY KEY,
    id_клиента INTEGER NOT NULL,  -- внешний ключ
    дата_заказа TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    общая_сумма NUMERIC(12, 2),
    FOREIGN KEY (id_клиента) REFERENCES клиенты(id)  -- указываем связь
);

-- Пример 2: Внешний ключ с ограничением на удаление
CREATE TABLE заказы_с_каскадом (
    id SERIAL PRIMARY KEY,
    id_клиента INTEGER NOT NULL,
    дата_заказа TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_клиента) 
        REFERENCES клиенты(id) 
        ON DELETE CASCADE  -- каскадное удаление
        ON UPDATE CASCADE  -- каскадное обновление
);

-- Пример 3: Множественные внешние ключи
CREATE TABLE заказы_товары_fk (
    id SERIAL PRIMARY KEY,
    id_заказа INTEGER NOT NULL,
    id_товара INTEGER NOT NULL,
    количество INTEGER NOT NULL,
    цена NUMERIC(10, 2),
    FOREIGN KEY (id_заказа) REFERENCES заказы(id) ON DELETE CASCADE,
    FOREIGN KEY (id_товара) REFERENCES товары(id) ON DELETE RESTRICT
);
```

### Типы связей между таблицами

#### Один-к-одному (One-to-One)

```sql
-- Пример: профиль пользователя (один к одному с пользователями)
CREATE TABLE пользователи_oo (
    id SERIAL PRIMARY KEY,
    имя VARCHAR(100) NOT NULL
);

CREATE TABLE профили_user (
    id_пользователя INTEGER PRIMARY KEY,  -- уникальный внешний ключ
    телефон VARCHAR(20),
    адрес TEXT,
    FOREIGN KEY (id_пользователя) REFERENCES пользователи_oo(id) ON DELETE CASCADE
);
```

#### Один-ко-многим (One-to-Many)

```sql
-- Пример: клиенты и заказы (один клиент может сделать много заказов)
CREATE TABLE клиенты_otm (
    id SERIAL PRIMARY KEY,
    фамилия VARCHAR(50) NOT NULL,
    имя VARCHAR(50) NOT NULL
);

CREATE TABLE заказы_otm (
    id SERIAL PRIMARY KEY,
    id_клиента INTEGER NOT NULL,  -- внешний ключ
    дата_заказа TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    общая_сумма NUMERIC(12, 2),
    FOREIGN KEY (id_клиента) REFERENCES клиенты_otm(id)
);

-- Запрос для получения клиента и его заказов
SELECT 
    к.фамилия,
    к.имя,
    з.дата_заказа,
    з.общая_сумма
FROM клиенты_otm к
JOIN заказы_otm з ON к.id = з.id_клиента;
```

#### Многие-ко-многим (Many-to-Many)

```sql
-- Пример: студенты и курсы (многие-ко-многим требует промежуточной таблицы)
CREATE TABLE студенты (
    id SERIAL PRIMARY KEY,
    имя VARCHAR(100) NOT NULL
);

CREATE TABLE курсы (
    id SERIAL PRIMARY KEY,
    название VARCHAR(200) NOT NULL,
    код VARCHAR(10) UNIQUE
);

-- Промежуточная таблица для связи многие-ко-многим
CREATE TABLE студенты_курсы (
    id_студента INTEGER NOT NULL,
    id_курса INTEGER NOT NULL,
    дата_регистрации DATE DEFAULT CURRENT_DATE,
    оценка INTEGER,
    PRIMARY KEY (id_студента, id_курса),
    FOREIGN KEY (id_студента) REFERENCES студенты(id) ON DELETE CASCADE,
    FOREIGN KEY (id_курса) REFERENCES курсы(id) ON DELETE CASCADE
);

-- Запрос для получения студентов и их курсов
SELECT 
    с.имя AS студент,
    к.название AS курс,
    ск.дата_регистрации,
    ск.оценка
FROM студенты с
JOIN студенты_курсы ск ON с.id = ск.id_студента
JOIN курсы к ON ск.id_курса = к.id;
```

### Практические примеры связей в нашей учебной базе данных

```sql
-- Обновленное определение таблиц с правильными ключами
CREATE TABLE клиенты_full (
    id SERIAL PRIMARY KEY,
    фамилия VARCHAR(50) NOT NULL,
    имя VARCHAR(50) NOT NULL,
    отчество VARCHAR(50),
    дата_рождения DATE,
    email VARCHAR(100) UNIQUE,
    телефон VARCHAR(20),
    город VARCHAR(50),
    дата_регистрации TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE категории (
    id SERIAL PRIMARY KEY,
    название VARCHAR(100) NOT NULL UNIQUE,
    описание TEXT
);

CREATE TABLE товары_full (
    id SERIAL PRIMARY KEY,
    наименование VARCHAR(200) NOT NULL,
    id_категории INTEGER,
    цена NUMERIC(10, 2) NOT NULL,
    количество_на_складе INTEGER DEFAULT 0,
    FOREIGN KEY (id_категории) REFERENCES категории(id) ON DELETE SET NULL
);

CREATE TABLE заказы_full (
    id SERIAL PRIMARY KEY,
    id_клиента INTEGER NOT NULL,
    дата_заказа TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    общая_сумма NUMERIC(12, 2),
    статус VARCHAR(20) DEFAULT 'новый',
    FOREIGN KEY (id_клиента) REFERENCES клиенты_full(id) ON DELETE RESTRICT
);

-- Таблица для связи заказов и товаров (многие-ко-многим)
CREATE TABLE заказы_товары_full (
    id_заказа INTEGER NOT NULL,
    id_товара INTEGER NOT NULL,
    количество INTEGER NOT NULL DEFAULT 1,
    цена_на_момент NUMERIC(10, 2) NOT NULL,
    PRIMARY KEY (id_заказа, id_товара),
    FOREIGN KEY (id_заказа) REFERENCES заказы_full(id) ON DELETE CASCADE,
    FOREIGN KEY (id_товара) REFERENCES товары_full(id) ON DELETE RESTRICT
);
```

### Поведение при нарушении ссылочной целостности

#### ON DELETE и ON UPDATE опции

```sql
-- CASCADE: автоматически удаляет/обновляет связанные строки
CREATE TABLE заказы_cascade (
    id SERIAL PRIMARY KEY,
    id_клиента INTEGER,
    FOREIGN KEY (id_клиента) REFERENCES клиенты(id) ON DELETE CASCADE
);

-- RESTRICT: запрещает удаление, если есть связанные строки
CREATE TABLE заказы_restrict (
    id SERIAL PRIMARY KEY,
    id_клиента INTEGER,
    FOREIGN KEY (id_клиента) REFERENCES клиенты(id) ON DELETE RESTRICT
);

-- SET NULL: устанавливает внешний ключ в NULL при удалении
CREATE TABLE заказы_set_null (
    id SERIAL PRIMARY KEY,
    id_представителя INTEGER,
    FOREIGN KEY (id_представителя) REFERENCES сотрудники(id) ON DELETE SET NULL
);

-- SET DEFAULT: устанавливает внешний ключ в значение по умолчанию
CREATE TABLE заказы_set_default (
    id SERIAL PRIMARY KEY,
    id_менеджера INTEGER DEFAULT 1,
    FOREIGN KEY (id_менеджера) REFERENCES менеджеры(id) ON DELETE SET DEFAULT
);
```

### Проверка и управление ключами

#### Просмотр существующих ключей

```sql
-- Просмотр первичных ключей
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_name = 'заказы';

-- Просмотр внешних ключей
SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name AS столбец_ключа,
    ccu.table_name AS связанная_таблица,
    ccu.column_name AS столбец_связи
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'заказы';
```

#### Добавление ключей к существующей таблице

```sql
-- Добавление первичного ключа
ALTER TABLE какая_то_таблица 
ADD CONSTRAINT pk_таблица PRIMARY KEY (id);

-- Добавление внешнего ключа
ALTER TABLE заказы
ADD CONSTRAINT fk_заказы_клиенты 
FOREIGN KEY (id_клиента) REFERENCES клиенты(id);
```

#### Удаление ключей

```sql
-- Удаление внешнего ключа
ALTER TABLE заказы
DROP CONSTRAINT fk_заказы_клиенты;
```

### Практические советы

#### 1. Всегда используйте первичные ключи

```sql
-- Правильно: каждая таблица должна иметь первичный ключ
CREATE TABLE правильная_таблица (
    id SERIAL PRIMARY KEY,
    данные TEXT
);

-- Неправильно: таблица без первичного ключа
CREATE TABLE плохая_таблица (
    данные TEXT
);  -- трудно будет поддерживать целостность
```

#### 2. Используйте осмысленные имена для ограничений

```sql
-- Правильно: понятные имена ограничений
CREATE TABLE заказы_именованные (
    id SERIAL PRIMARY KEY,
    id_клиента INTEGER NOT NULL,
    CONSTRAINT fk_заказы_клиенты FOREIGN KEY (id_клиента) REFERENCES клиенты(id),
    CONSTRAINT chk_сумма_положительная CHECK (общая_сумма > 0)
);
```

#### 3. Думайте о каскадных операциях

```sql
-- Подумайте, что должно происходить при удалении основной записи
-- CASCADE для заказов-товаров: при удалении заказа удаляются позиции
-- SET NULL для заказов-менеджеров: при удалении менеджера заказы не удаляются
```

### Заключение главы

Первичные и внешние ключи - основа целостности данных в реляционных базах данных. Они обеспечивают:

1. Уникальность записей
2. Согласованность связей между таблицами
3. Защиту от некорректных данных
4. Возможность эффективного соединения таблиц

Правильное использование ключей критично для надежной и эффективной работы базы данных.

---

## Глава 49: Ограничения

### Введение

Ограничения (Constraints) - это правила, которые определяют, какие данные могут быть вставлены, обновлены или удалены из таблицы. Они обеспечивают целостность данных и помогают поддерживать качество информации в базе данных. PostgreSQL поддерживает несколько типов ограничений:

1. NOT NULL
2. UNIQUE
3. PRIMARY KEY
4. FOREIGN KEY
5. CHECK
6. EXCLUSION

Мы уже рассмотрели PRIMARY KEY и FOREIGN KEY, теперь изучим остальные.

### NOT NULL ограничение

Ограничение NOT NULL требует, чтобы столбец всегда содержал значение (не NULL).

```sql
-- Примеры использования NOT NULL
CREATE TABLE клиенты_not_null (
    id SERIAL PRIMARY KEY,
    фамилия VARCHAR(50) NOT NULL,  -- обязательно должно быть заполнено
    имя VARCHAR(50) NOT NULL,      -- обязательно должно быть заполнено
    отчество VARCHAR(50),          -- может быть NULL
    email VARCHAR(100) NOT NULL UNIQUE,  -- обязательно и уникально
    дата_регистрации TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Добавление NOT NULL ограничения к существующему столбцу
ALTER TABLE клиенты_not_null 
ALTER COLUMN отчество SET NOT NULL;

-- Удаление NOT NULL ограничения
ALTER TABLE клиенты_not_null 
ALTER COLUMN отчество DROP NOT NULL;
```

### UNIQUE ограничение

Ограничение UNIQUE гарантирует, что все значения в столбце уникальны (или комбинация значений в нескольких столбцах уникальна).

```sql
-- Примеры UNIQUE ограничений
CREATE TABLE пользователи_unique (
    id SERIAL PRIMARY KEY,
    логин VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    телефон VARCHAR(20) UNIQUE  -- может быть NULL, но если задан, должен быть уникальным
);

-- Уникальность по нескольким столбцам
CREATE TABLE логины_уникальные (
    id SERIAL PRIMARY KEY,
    пользователь_id INTEGER NOT NULL,
    домен VARCHAR(50) NOT NULL,
    UNIQUE (пользователь_id, домен)  -- уникальная пара значений
);

-- Именованное ограничение UNIQUE
CREATE TABLE продукты_unique (
    id SERIAL PRIMARY KEY,
    артикул VARCHAR(20) NOT NULL,
    наименование VARCHAR(200) NOT NULL,
    CONSTRAINT uk_продукты_артикул UNIQUE (артикул)
);
```

### CHECK ограничение

Ограничение CHECK позволяет указать условие, которому должны удовлетворять значения в столбце.

```sql
-- Примеры CHECK ограничений
CREATE TABLE товары_check (
    id SERIAL PRIMARY KEY,
    наименование VARCHAR(200) NOT NULL,
    цена NUMERIC(10, 2) NOT NULL,
    количество_на_складе INTEGER DEFAULT 0,
    вес DOUBLE PRECISION,
    дата_добавления DATE DEFAULT CURRENT_DATE,
    
    -- Проверка, что цена положительная
    CONSTRAINT chk_цена_положительная CHECK (цена > 0),
    
    -- Проверка, что количество неотрицательное
    CONSTRAINT chk_количество_неотрицательное CHECK (количество_на_складе >= 0),
    
    -- Проверка веса
    CONSTRAINT chk_вес_положительный CHECK (вес > 0 OR вес IS NULL),
    
    -- Проверка даты
    CONSTRAINT chk_дата_не_в_будущем CHECK (дата_добавления <= CURRENT_DATE),
    
    -- Сложное условие
    CONSTRAINT chk_цена_не_слишком_высокая CHECK (цена < 1000000)
);

-- CHECK ограничение в нескольких столбцах
CREATE TABLE заказы_check (
    id SERIAL PRIMARY KEY,
    id_клиента INTEGER NOT NULL,
    общая_сумма NUMERIC(12, 2) NOT NULL,
    скидка_в_процентах NUMERIC(5, 2) DEFAULT 0,
    
    -- Скидка не может быть отрицательной и не может превышать 100%
    CONSTRAINT chk_скидка_в_пределах CHECK (скидка_в_процентах >= 0 AND скидка_в_процентах <= 100),
    
    -- Проверка, что итоговая сумма с учетом скидки положительна
    CONSTRAINT chk_итоговая_сумма_положительна CHECK (общая_сумма * (1 - скидка_в_процентах/100) > 0)
);
```

### DEFAULT значения

DEFAULT не является ограничением в строгом смысле, но тесно связано с ними и определяет значение, которое будет использовано при вставке, если значение не указано.

```sql
-- Примеры DEFAULT значений
CREATE TABLE заказы_default (
    id SERIAL PRIMARY KEY,
    id_клиента INTEGER NOT NULL,
    дата_заказа TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    общая_сумма NUMERIC(12, 2) DEFAULT 0,
    статус VARCHAR(20) DEFAULT 'новый',
    приоритет INTEGER DEFAULT 3,  -- по умолчанию средний приоритет
    комментарий TEXT DEFAULT 'Без комментариев',
    активен BOOLEAN DEFAULT TRUE,
    
    -- DEFAULT с функцией
    идентификатор UUID DEFAULT gen_random_uuid()
);

-- Изменение DEFAULT значения
ALTER TABLE заказы_default 
ALTER COLUMN приоритет SET DEFAULT 5;

-- Удаление DEFAULT значения
ALTER TABLE заказы_default 
ALTER COLUMN комментарий DROP DEFAULT;
```

### COMPOSITE ограничения

Ограничения, применяемые к нескольким столбцам одновременно.

```sql
-- Примеры COMPOSITE ограничений
CREATE TABLE расписания (
    id SERIAL PRIMARY KEY,
    преподаватель_id INTEGER NOT NULL,
    группа_id INTEGER NOT NULL,
    дата_занятия DATE NOT NULL,
    время_начала TIME NOT NULL,
    время_окончания TIME NOT NULL,
    
    -- Уникальность: один преподаватель не может быть в двух местах одновременно
    CONSTRAINT uk_преподаватель_время UNIQUE (преподаватель_id, дата_занятия, время_начала),
    
    -- Уникальность: одна группа не может быть в двух местах одновременно
    CONSTRAINT uk_группа_время UNIQUE (группа_id, дата_занятия, время_начала),
    
    -- Проверка: время окончания должно быть после времени начала
    CONSTRAINT chk_время_корректно CHECK (время_окончания > время_начала),
    
    -- Проверка: не может быть занятия в прошлом (для новых записей)
    CONSTRAINT chk_не_в_прошлом CHECK (дата_занятия >= CURRENT_DATE)
);
```

### Ограничения в реальных сценариях

#### Пример 1: Ограничения для клиентской таблицы

```sql
CREATE TABLE клиенты_ограничения (
    id SERIAL PRIMARY KEY,
    фамилия VARCHAR(50) NOT NULL,
    имя VARCHAR(50) NOT NULL,
    отчество VARCHAR(50),
    дата_рождения DATE,
    email VARCHAR(100) NOT NULL UNIQUE,
    телефон VARCHAR(20) UNIQUE,
    город VARCHAR(50) NOT NULL,
    скидка NUMERIC(5, 2) DEFAULT 0,
    дата_регистрации TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    активен BOOLEAN DEFAULT TRUE NOT NULL,
    
    -- Проверки
    CONSTRAINT chk_имя_не_пустое CHECK (LENGTH(TRIM(имя)) > 0),
    CONSTRAINT chk_фамилия_не_пустая CHECK (LENGTH(TRIM(фамилия)) > 0),
    CONSTRAINT chk_возраст_разумный CHECK (дата_рождения IS NULL OR дата_рождения <= CURRENT_DATE - INTERVAL '18 years'),
    CONSTRAINT chk_город_не_пустой CHECK (LENGTH(TRIM(город)) > 0),
    CONSTRAINT chk_скидка_в_пределах CHECK (скидка >= 0 AND скидка <= 100),
    CONSTRAINT chk_дата_регистрации_не_в_будущем CHECK (дата_регистрации <= CURRENT_TIMESTAMP),
    
    -- Уникальность email без учета регистра (с использованием индекса)
    CONSTRAINT uk_email_case_insensitive UNIQUE (LOWER(email))
);
```

#### Пример 2: Ограничения для товаров с категориями

```sql
CREATE TABLE товары_ограничения (
    id SERIAL PRIMARY KEY,
    артикул VARCHAR(20) NOT NULL UNIQUE,
    наименование VARCHAR(200) NOT NULL,
    id_категории INTEGER,
    цена NUMERIC(10, 2) NOT NULL,
    количество_на_складе INTEGER NOT NULL DEFAULT 0,
    вес NUMERIC(8, 3),
    дата_добавления TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    архивный BOOLEAN DEFAULT FALSE NOT NULL,
    
    -- Проверки
    CONSTRAINT chk_артикул_формат CHECK (артикул ~ '^[A-Z0-9-]+$'),  -- только заглавные, цифры и дефис
    CONSTRAINT chk_наименование_не_пустое CHECK (LENGTH(TRIM(наименование)) > 0),
    CONSTRAINT chk_цена_положительная CHECK (цена > 0),
    CONSTRAINT chk_количество_неотрицательное CHECK (количество_на_складе >= 0),
    CONSTRAINT chk_вес_положительный CHECK (вес > 0 OR вес IS NULL),
    CONSTRAINT chk_дата_не_в_будущем CHECK (дата_добавления <= CURRENT_TIMESTAMP),
    
    -- Связь с категориями
    FOREIGN KEY (id_категории) REFERENCES категории(id) ON DELETE SET NULL
);
```

#### Пример 3: Ограничения для заказов

```sql
CREATE TABLE заказы_ограничения (
    id SERIAL PRIMARY KEY,
    id_клиента INTEGER NOT NULL,
    дата_заказа TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    общая_сумма NUMERIC(12, 2) NOT NULL DEFAULT 0,
    скидка_в_процентах NUMERIC(5, 2) DEFAULT 0,
    статус VARCHAR(20) NOT NULL DEFAULT 'новый',
    комментарий TEXT,
    
    -- Проверки
    CONSTRAINT chk_дата_не_в_будущем CHECK (дата_заказа <= CURRENT_TIMESTAMP),
    CONSTRAINT chk_сумма_неотрицательная CHECK (общая_сумма >= 0),
    CONSTRAINT chk_скидка_в_пределах CHECK (скидка_в_процентах >= 0 AND скидка_в_процентах <= 100),
    CONSTRAINT chk_итоговая_сумма_с_учетом_скидки CHECK (общая_сумма * (1 - скидка_в_процентах/100) >= 0),
    CONSTRAINT chk_статус_допустимый CHECK (статус IN ('новый', 'оплачен', 'в_доставке', 'доставлен', 'отменен')),
    
    -- Связи
    FOREIGN KEY (id_клиента) REFERENCES клиенты_ограничения(id) ON DELETE RESTRICT
);
```

### Управление ограничениями

#### Просмотр существующих ограничений

```sql
-- Просмотр всех ограничений для таблицы
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS references_table,
    ccu.column_name AS references_column
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'заказы_ограничения'
ORDER BY tc.constraint_type, tc.constraint_name;
```

#### Добавление ограничений к существующей таблице

```sql
-- Добавление CHECK ограничения
ALTER TABLE товары_ограничения
ADD CONSTRAINT chk_цена_не_слишком_высокая 
CHECK (цена < 1000000);

-- Добавление UNIQUE ограничения
ALTER TABLE клиенты_ограничения
ADD CONSTRAINT uk_телефон_уникальный 
UNIQUE (телефон);

-- Добавление NOT NULL ограничения
ALTER TABLE клиенты_ограничения
ALTER COLUMN отчество SET NOT NULL;
```

#### Удаление ограничений

```sql
-- Удаление CHECK ограничения
ALTER TABLE товары_ограничения
DROP CONSTRAINT chk_цена_не_слишком_высокая;

-- Удаление UNIQUE ограничения
ALTER TABLE клиенты_ограничения
DROP CONSTRAINT uk_телефон_уникальный;

-- Удаление NOT NULL ограничения
ALTER TABLE клиенты_ограничения
ALTER COLUMN отчество DROP NOT NULL;
```

### Практические советы по использованию ограничений

#### 1. Используйте осмысленные имена для ограничений

```sql
-- Хорошо: именованные ограничения с понятными именами
CREATE TABLE хорошая_таблица (
    id SERIAL PRIMARY KEY,
    цена NUMERIC(10, 2) NOT NULL,
    CONSTRAINT chk_цена_положительная CHECK (цена > 0),
    CONSTRAINT chk_не_слишком_дорого CHECK (цена < 1000000)
);

-- Плохо: неименованные ограничения
CREATE TABLE плохая_таблица (
    id SERIAL PRIMARY KEY,
    цена NUMERIC(10, 2) NOT NULL,
    CHECK (цена > 0),
    CHECK (цена < 1000000)
);
```

#### 2. Не перегружайте таблицу ограничениями

```sql
-- Плохо: слишком много сложных ограничений
CREATE TABLE перегруженная (
    id SERIAL PRIMARY KEY,
    значение VARCHAR(100),
    CHECK (LENGTH(значение) > 5 AND LENGTH(значение) < 50 AND 
           значение ~ '^[A-Z][a-z]+$' AND 
           POSITION(' ' IN значение) = 0 AND 
           -- и т.д. слишком много условий
           TRUE)
);

-- Хорошо: разумный баланс между проверками и производительностью
CREATE TABLE сбалансированная (
    id SERIAL PRIMARY KEY,
    значение VARCHAR(100) NOT NULL,
    CONSTRAINT chk_длина_в_пределах CHECK (LENGTH(значение) BETWEEN 1 AND 100),
    CONSTRAINT chk_не_только_пробелы CHECK (TRIM(значение) != '')
);
```

#### 3. Используйте проверки на уровне приложения в дополнение к БД

```sql
-- Ограничения в базе данных как последняя линия защиты
-- Проверки в приложении для лучшего UX
-- Пример проверки в запросе перед вставкой:
INSERT INTO товары_ограничения (артикул, наименование, цена)
SELECT 'NEW-001', 'Новый товар', 1000.00
WHERE NOT EXISTS (
    SELECT 1 FROM товары_ограничения WHERE артикул = 'NEW-001'
);
```

#### 4. Рассмотрите производительность при сложных CHECK ограничениях

```sql
-- Плохо: сложная проверка, влияющая на производительность
CREATE TABLE медленная (
    id SERIAL PRIMARY KEY,
    данные TEXT,
    CHECK (
        -- сложное регулярное выражение или подзапрос
        (SELECT COUNT(*) FROM json_array_elements_text(данные::JSON)) > 0
    )
);

-- Лучше: простые проверки или проверки на уровне приложения
CREATE TABLE быстрая (
    id SERIAL PRIMARY KEY,
    данные TEXT,
    CONSTRAINT chk_данные_не_пустые CHECK (данные IS NOT NULL AND LENGTH(данные) > 0)
);
```

### Заключение главы

Ограничения - важный инструмент для обеспечения целостности данных в базе данных. Они обеспечивают:

1. Качество входящих данных
2. Согласованность информации
3. Защиту от некорректных операций
4. Ясность бизнес-правил

Правильное использование ограничений требует баланса между надежностью и производительностью. Важно понимать, как различные типы ограничений влияют на производительность и как они взаимодействуют друг с другом.

---

## Глава 50: Создание таблиц (CREATE TABLE)

### Введение

Создание таблиц - это первый и один из самых важных шагов в проектировании базы данных. Команда CREATE TABLE определяет структуру таблицы, включая столбцы, типы данных, ограничения и связи с другими таблицами. Правильное создание таблицы критично для производительности, целостности данных и удобства работы с базой данных.

### Базовый синтаксис CREATE TABLE

```sql
CREATE TABLE имя_таблицы (
    столбец1 тип_данных [ограничения],
    столбец2 тип_данных [ограничения],
    ...
    [ограничения_таблицы]
);
```

### Полный пример создания таблицы

```sql
-- Пример создания таблицы клиентов с полной спецификацией
CREATE TABLE клиенты_создание (
    -- Основной идентификатор
    id SERIAL PRIMARY KEY,
    
    -- Персональная информация
    фамилия VARCHAR(50) NOT NULL,
    имя VARCHAR(50) NOT NULL,
    отчество VARCHAR(50),
    
    -- Контактная информация
    email VARCHAR(100) NOT NULL UNIQUE,
    телефон VARCHAR(20) UNIQUE,
    город VARCHAR(50) NOT NULL,
    
    -- Даты
    дата_рождения DATE CHECK (дата_рождения <= CURRENT_DATE - INTERVAL '18 years'),
    дата_регистрации TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Статусы
    активен BOOLEAN DEFAULT TRUE NOT NULL,
    подтвержден BOOLEAN DEFAULT FALSE NOT NULL,
    
    -- Финансовая информация
    скидка NUMERIC(5, 2) DEFAULT 0 CHECK (скидка >= 0 AND скидка <= 100),
    
    -- Метаданные
    версия_записи INTEGER DEFAULT 1 NOT NULL,
    дата_обновления TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Составные ограничения
    CONSTRAINT chk_имя_не_пустое CHECK (LENGTH(TRIM(имя)) > 0),
    CONSTRAINT chk_фамилия_не_пустая CHECK (LENGTH(TRIM(фамилия)) > 0),
    CONSTRAINT chk_город_не_пустой CHECK (LENGTH(TRIM(город)) > 0)
);

-- Добавим комментарии к таблице и столбцам
COMMENT ON TABLE клиенты_создание IS 'Таблица клиентов системы';
COMMENT ON COLUMN клиенты_создание.id IS 'Уникальный идентификатор клиента';
COMMENT ON COLUMN клиенты_создание.email IS 'Уникальный email клиента';
```

### Расширенные возможности CREATE TABLE

#### Наследование таблиц

```sql
-- Создание родительской таблицы
CREATE TABLE сущности (
    id SERIAL PRIMARY KEY,
    дата_создания TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    дата_обновления TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    активен BOOLEAN DEFAULT TRUE NOT NULL
);

-- Создание таблицы-наследника
CREATE TABLE клиенты_наследование (
    -- Наследуем столбцы от родительской таблицы
    фамилия VARCHAR(50) NOT NULL,
    имя VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE
) INHERITS (сущности);

-- Таблица-наследник будет содержать все столбцы родителя плюс свои
```

#### Временные таблицы

```sql
-- Создание временной таблицы (существует только в текущей сессии)
CREATE TEMPORARY TABLE временные_результаты (
    id SERIAL PRIMARY KEY,
    результат TEXT,
    время_создания TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Или сокращенно
CREATE TEMP TABLE temp_data (
    ключ VARCHAR(50) PRIMARY KEY,
    значение TEXT
);
```

#### Создание таблицы из результата запроса

```sql
-- Создание таблицы на основе результата запроса
CREATE TABLE клиенты_москвы AS
SELECT 
    id,
    фамилия,
    имя,
    email,
    телефон
FROM клиенты_создание
WHERE город = 'Москва';

-- Создание с указанием структуры и данных
CREATE TABLE клиенты_с_индексом AS
SELECT 
    id,
    фамилия,
    имя,
    дата_регистрации
FROM клиенты_создание
WHERE дата_регистрации >= '2023-01-01'
WITH DATA;  -- WITH NO DATA - без копирования данных
```

### Создание таблиц с различными опциями

#### Таблицы с указанием табличного пространства

```sql
-- Создание таблицы в определенном табличном пространстве
-- (требует наличия созданного табличного пространства)
-- CREATE TABLESPACE my_tablespace LOCATION '/path/to/tablespace';
/*
CREATE TABLE данные_с_таблицы (
    id SERIAL PRIMARY KEY,
    данные TEXT
) TABLESPACE my_tablespace;
*/
```

#### Таблицы с параметрами хранения

```sql
-- Определение параметров хранения
CREATE TABLE логи_с_параметрами (
    id BIGSERIAL PRIMARY KEY,
    уровень VARCHAR(10),
    сообщение TEXT,
    дата_время TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) WITH (
    fillfactor = 90,  -- процент заполнения страниц
    autovacuum_enabled = true
);
```

### Практические примеры создания таблиц

#### Пример 1: Полная структура таблицы заказов

```sql
CREATE TABLE заказы_полная (
    -- Идентификаторы
    id SERIAL PRIMARY KEY,
    id_клиента INTEGER NOT NULL,
    
    -- Даты и время
    дата_создания TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    дата_обновления TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    дата_доставки DATE,
    
    -- Суммы
    общая_сумма NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (общая_сумма >= 0),
    сумма_доставки NUMERIC(8, 2) DEFAULT 0 CHECK (сумма_доставки >= 0),
    сумма_товаров NUMERIC(12, 2) GENERATED ALWAYS AS (общая_сумма - сумма_доставки) STORED,
    
    -- Статусы
    статус VARCHAR(20) NOT NULL DEFAULT 'новый' 
        CHECK (статус IN ('новый', 'подтвержден', 'оплачен', 'собирается', 'в_доставке', 'доставлен', 'отменен')),
    приоритет INTEGER DEFAULT 3 CHECK (приоритет BETWEEN 1 AND 5),
    
    -- Адрес доставки
    адрес_доставки TEXT,
    индекс_доставки VARCHAR(10),
    
    -- Скидки и налоги
    скидка_процент NUMERIC(5, 2) DEFAULT 0 CHECK (скидка_процент >= 0 AND скидка_процент <= 100),
    налог_процент NUMERIC(5, 2) DEFAULT 20 CHECK (налог_процент >= 0),
    
    -- Комментарии и метки
    комментарий_клиента TEXT,
    внутренний_комментарий TEXT,
    метки JSONB,
    
    -- Внешние ключи
    CONSTRAINT fk_заказы_клиенты FOREIGN KEY (id_клиента) REFERENCES клиенты_создание(id) ON DELETE RESTRICT,
    
    -- Проверки
    CONSTRAINT chk_дата_доставки_не_в_прошлом CHECK (дата_доставки IS NULL OR дата_доставки >= CURRENT_DATE),
    CONSTRAINT chk_сумма_не_нулевая CHECK (общая_сумма > 0 OR статус = 'отменен'),
    
    -- Уникальность/Индексы определяются отдельно
    CONSTRAINT uk_заказы_для_отмены UNIQUE (id) WHERE (статус = 'отменен')  -- частичный уникальный индекс
);

-- Добавим индексы
CREATE INDEX idx_заказы_клиент_статус ON заказы_полная (id_клиента, статус);
CREATE INDEX idx_заказы_дата_создания ON заказы_полная (дата_создания);
CREATE INDEX idx_заказы_статус ON заказы_полная (статус);
```

#### Пример 2: Таблица товаров с различными характеристиками

```sql
CREATE TABLE товары_многомерные (
    -- Основная информация
    id SERIAL PRIMARY KEY,
    артикул VARCHAR(30) NOT NULL UNIQUE,
    наименование VARCHAR(200) NOT NULL,
    описание TEXT,
    
    -- Цена и стоимость
    цена NUMERIC(10, 2) NOT NULL CHECK (цена > 0),
    себестоимость NUMERIC(10, 2) CHECK (себестоимость >= 0),
    скидка_процент NUMERIC(5, 2) DEFAULT 0 CHECK (себестоимость >= 0 AND себестоимость <= 100),
    
    -- Остатки
    количество_на_складе INTEGER NOT NULL DEFAULT 0 CHECK (количество_на_складе >= 0),
    минимальный_остаток INTEGER DEFAULT 0 CHECK (минимальный_остаток >= 0),
    резерв INTEGER DEFAULT 0 CHECK (резерв >= 0),
    
    -- Категории и атрибуты
    id_категории INTEGER,
    атрибуты JSONB,  -- для гибких характеристик товаров
    теги TEXT[],     -- массив тегов
    
    -- Физические параметры
    вес NUMERIC(8, 3) CHECK (вес > 0),  -- в кг
    объем NUMERIC(10, 5) CHECK (объем > 0),  -- в куб.м
    габариты JSONB,  -- {"длина": 10, "ширина": 5, "высота": 3}
    
    -- Даты
    дата_добавления TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    дата_обновления TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    дата_снятия_с_продажи DATE,
    
    -- Статусы
    активен BOOLEAN DEFAULT TRUE NOT NULL,
    на_распродаже BOOLEAN DEFAULT FALSE NOT NULL,
    в_новинках BOOLEAN DEFAULT FALSE NOT NULL,
    
    -- Внешние ключи
    FOREIGN KEY (id_категории) REFERENCES категории(id) ON DELETE SET NULL,
    
    -- Проверки
    CONSTRAINT chk_артикул_формат CHECK (артикул ~ '^[A-Z0-9-]+$'),
    CONSTRAINT chk_цена_выше_себестоимости CHECK (себестоимость IS NULL OR цена >= себестоимость),
    CONSTRAINT chk_дата_не_в_будущем CHECK (дата_снятия_с_продажи IS NULL OR дата_снятия_с_продажи <= CURRENT_DATE),
    CONSTRAINT chk_наименование_не_пустое CHECK (LENGTH(TRIM(наименование)) > 0)
);

-- Добавим индексы для эффективности
CREATE INDEX idx_товары_категория ON товары_многомерные (id_категории);
CREATE INDEX idx_товары_цена ON товары_многомерные (цена);
CREATE INDEX idx_товары_артикул_gin ON товары_многомерные USING GIN (артикул gin_trgm_ops);
CREATE INDEX idx_товары_артикулы ON товары_многомерные (артикул);
CREATE INDEX idx_товары_активные ON товары_многомерные (id) WHERE активен = TRUE;
```

#### Пример 3: История изменений (аудит)

```sql
CREATE TABLE история_изменений (
    id BIGSERIAL PRIMARY KEY,
    таблица_название VARCHAR(50) NOT NULL,
    операция VARCHAR(10) NOT NULL CHECK (операция IN ('INSERT', 'UPDATE', 'DELETE')),
    id_записи INTEGER NOT NULL,
    пользователь VARCHAR(100),
    дата_время TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    старые_значения JSONB,
    новые_значения JSONB,
    сессия_id VARCHAR(50),
    
    -- Проверки
    CONSTRAINT chk_операция_допустима CHECK (операция IN ('INSERT', 'UPDATE', 'DELETE')),
    CONSTRAINT chk_дата_не_в_будущем CHECK (дата_время <= CURRENT_TIMESTAMP)
);

-- Индекс для эффективного поиска изменений
CREATE INDEX idx_история_таблица_запись ON история_изменений (таблица_название, id_записи);
CREATE INDEX idx_история_дата ON история_изменений (дата_время);
```

### Использование шаблонов таблиц

```sql
-- Создание таблицы как шаблона
CREATE TABLE шаблон_сущности (
    id SERIAL PRIMARY KEY,
    дата_создания TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    дата_обновления TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    активен BOOLEAN DEFAULT TRUE NOT NULL
) WITH OIDS;  -- с OID (в современных версиях PostgreSQL не рекомендуется)

-- Создание новой таблицы на основе шаблона
CREATE TABLE новые_сущности (LIKE шаблон_сущности INCLUDING ALL) 
INHERITS (шаблон_сущности);
```

### Практические советы по созданию таблиц

#### 1. Планирование структуры заранее

```sql
-- Плохо: создание таблицы "как получится"
-- CREATE TABLE что_то (id INTEGER, data TEXT);

-- Хорошо: продуманная структура
CREATE TABLE хорошо_спроектированная (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    -- и т.д. с понятными именами и типами
);
```

#### 2. Использование единообразных соглашений

```sql
-- Соглашения об именовании
-- id - всегда SERIAL PRIMARY KEY
-- даты: created_at, updated_at, deleted_at
-- статусы: is_active, is_deleted, is_confirmed
-- внешние ключи: table_name_id
-- индексы: idx_table_column
```

#### 3. Учет будущего масштабирования

```sql
-- Учет будущих потребностей
-- Использование BIGSERIAL для потенциально больших таблиц
-- Использование NUMERIC с запасом для финансовых данных
-- Гибкие поля (JSONB) для изменяющихся требований
```

#### 4. Документирование структуры

```sql
-- Добавление комментариев
CREATE TABLE документированная (
    id SERIAL PRIMARY KEY,
    имя VARCHAR(100) NOT NULL
);

COMMENT ON TABLE документированная IS 'Таблица для хранения имен';
COMMENT ON COLUMN документированная.id IS 'Уникальный идентификатор записи';
COMMENT ON COLUMN документированная.имя IS 'Полное имя пользователя';
```

### Заключение главы

Создание таблиц - это фундамент для всей последующей работы с базой данных. Качественно спроектированная таблица с правильными типами данных, ограничениями и связями обеспечивает:

1. Целостность данных
2. Производительность запросов
3. Удобство сопровождения
4. Масштабируемость

При создании таблиц необходимо учитывать как текущие, так и потенциальные будущие требования к данным, использовать понятные соглашения об именовании и документировать структуру для других разработчиков.

---

## Глава 51: Вставка данных (INSERT)

### Введение

Вставка данных - это процесс добавления новых записей в таблицу. Команда INSERT позволяет добавлять одну или несколько строк в таблицу, при этом соблюдая все установленные ограничения. Это одна из фундаментальных операций в SQL, позволяющая наполнять базу данных информацией.

### Базовый синтаксис INSERT

#### INSERT с указанием столбцов

```sql
INSERT INTO имя_таблицы (столбец1, столбец2, ...) 
VALUES (значение1, значение2, ...);
```

#### INSERT без указания столбцов (все столбцы)

```sql
INSERT INTO имя_таблицы 
VALUES (значение1, значение2, ...);
```

### Простые примеры INSERT

#### Вставка одной записи

```sql
-- Вставка одного клиента
INSERT INTO клиенты (фамилия, имя, email, город) 
VALUES ('Иванов', 'Иван', 'ivanov@example.com', 'Москва');

-- Вставка с использованием DEFAULT
INSERT INTO клиенты (фамилия, имя, email, город) 
VALUES ('Петров', 'Петр', 'petrov@example.com', 'Санкт-Петербург');

-- Вставка с автоматическим заполнением SERIAL
INSERT INTO товары (наименование, цена, количество_на_складе) 
VALUES ('Ноутбук Dell', 55990.00, 5);

-- Вставка с выражениями
INSERT INTO клиенты (фамилия, имя, дата_регистрации) 
VALUES ('Сидоров', 'Андрей', CURRENT_TIMESTAMP);
```

### Вставка нескольких записей

#### Вставка нескольких строк за один запрос

```sql
-- Вставка нескольких клиентов за один запрос
INSERT INTO клиенты (фамилия, имя, email, город) 
VALUES 
    ('Козлова', 'Елена', 'kozlova@example.com', 'Новосибирск'),
    ('Волков', 'Дмитрий', 'volkov@example.com', 'Екатеринбург'),
    ('Морозова', 'Анна', 'morozova@example.com', 'Казань'),
    ('Петров', 'Сергей', 'petrov2@example.com', 'Москва');

-- Вставка нескольких товаров
INSERT INTO товары (наименование, цена, категория) 
VALUES 
    ('Смартфон Samsung', 79990.00, 'Электроника'),
    ('Планшет Apple', 45990.00, 'Электроника'),
    ('Кроссовки Adidas', 8990.00, 'Обувь'),
    ('Книга SQL', 1490.00, 'Книги');
```

### INSERT с использованием SELECT (INSERT INTO ... SELECT)

#### Копирование данных из другой таблицы

```sql
-- Копирование данных из одной таблицы в другую
CREATE TABLE клиенты_архив (
    id INTEGER,
    фамилия VARCHAR(50),
    имя VARCHAR(50),
    дата_архивации DATE DEFAULT CURRENT_DATE
);

-- Вставка данных из основной таблицы в архивную
INSERT INTO клиенты_архив (id, фамилия, имя)
SELECT id, фамилия, имя
FROM клиенты
WHERE дата_регистрации < '2020-01-01';

-- Вставка с преобразованием данных
INSERT INTO клиенты_архив (id, фамилия, имя)
SELECT 
    id, 
    UPPER(фамилия),  -- преобразование в верхний регистр
    UPPER(имя)       -- преобразование в верхний регистр
FROM клиенты
WHERE город = 'Москва';
```

#### Вставка результатов агрегации

```sql
-- Создание таблицы для статистики
CREATE TABLE статистика_по_городам (
    город VARCHAR(50),
    количество_клиентов INTEGER,
    средняя_сумма_заказов NUMERIC(12, 2)
);

-- Вставка агрегированных данных
INSERT INTO статистика_по_городам
SELECT 
    к.город,
    COUNT(DISTINCT к.id) AS количество_клиентов,
    AVG(з.общая_сумма) AS средняя_сумма_заказов
FROM клиенты к
LEFT JOIN заказы з ON к.id = з.id_клиента
GROUP BY к.город;
```

### INSERT с возвратом значений (RETURNING)

#### Возврат автоматически сгенерированных значений

```sql
-- Вставка и возврат сгенерированного ID
INSERT INTO клиенты (фамилия, имя, email, город)
VALUES ('Новый', 'Клиент', 'newclient@example.com', 'Москва')
RETURNING id, фамилия, дата_регистрации;

-- Возврат вычисленных значений
INSERT INTO заказы (id_клиента, общая_сумма)
SELECT id, 1000.00
FROM клиенты
WHERE email = 'newclient@example.com'
RETURNING id, id_клиента, дата_заказа;

-- Возврат с проверкой
INSERT INTO товары (наименование, цена)
VALUES ('Новый товар', 100.00)
RETURNING 
    id,
    наименование,
    цена,
    (SELECT COUNT(*) FROM товары WHERE цена > 50) AS товаров_дороже_50;
```

### INSERT с обработкой конфликтов (ON CONFLICT)

#### INSERT ... ON CONFLICT DO NOTHING

```sql
-- Вставка с игнорированием конфликтов
INSERT INTO клиенты (фамилия, имя, email, город)
VALUES ('Иванов', 'Иван', 'ivanov@example.com', 'Москва')
ON CONFLICT (email) DO NOTHING;

-- Это не вызовет ошибки, если email уже существует
```

#### INSERT ... ON CONFLICT DO UPDATE (UPSERT)

```sql
-- Обновление записи при конфликте (UPSERT)
INSERT INTO клиенты (фамилия, имя, email, город)
VALUES ('Иванов', 'Иван', 'ivanov@example.com', 'Санкт-Петербург')
ON CONFLICT (email) 
DO UPDATE SET 
    фамилия = EXCLUDED.фамилия,
    имя = EXCLUDED.имя,
    город = EXCLUDED.город,
    дата_обновления = CURRENT_TIMESTAMP;

-- EXCLUDED ссылается на вставляемые значения
```

#### Частичный UPSERT

```sql
-- Обновление только некоторых полей при конфликте
INSERT INTO клиенты (фамилия, имя, email, город, скидка)
VALUES ('Петров', 'Петр', 'petrov@example.com', 'Новосибирск', 10)
ON CONFLICT (email) 
DO UPDATE SET 
    город = CASE 
        WHEN клиенты.активен THEN EXCLUDED.город 
        ELSE клиенты.город 
    END,
    скидка = GREATEST(клиенты.скидка, EXCLUDED.скидка),
    дата_обновления = CURRENT_TIMESTAMP;
```

### Практические примеры INSERT

#### Пример 1: Массовая вставка с подготовленными данными

```sql
-- Подготовка данных для вставки
WITH подготовленные_данные AS (
    SELECT 
        UNNEST(ARRAY['Сидоров', 'Морозов', 'Волкова']) AS фамилия,
        UNNEST(ARRAY['Алексей', 'Олег', 'Мария']) AS имя,
        UNNEST(ARRAY['sidorov', 'morozov', 'volkova']) AS префикс_email,
        UNNEST(ARRAY['Москва', 'СПб', 'Новосибирск']) AS город
)
INSERT INTO клиенты (фамилия, имя, email, город)
SELECT 
    фамилия,
    имя,
    префикс_email || '@example.com',
    город
FROM подготовленные_данные;
```

#### Пример 2: Вставка с вычислениями

```sql
-- Вставка заказов с автоматическим расчетом суммы
WITH корзина AS (
    SELECT 
        1 AS id_клиента,  -- предположим, это ID клиента
        JSONB_BUILD_ARRAY(
            JSONB_BUILD_OBJECT('id_товара', 1, 'количество', 2),
            JSONB_BUILD_OBJECT('id_товара', 2, 'количество', 1)
        ) AS содержимое
),
расчеты AS (
    SELECT 
        id_клиента,
        содержимое,
        JSONB_ARRAY_ELEMENTS(содержимое) AS элемент
    FROM корзина
),
итоговая_сумма AS (
    SELECT 
        id_клиента,
        SUM((элемент->>'количество')::INTEGER * т.цена) AS общая_сумма
    FROM расчеты
    JOIN товары т ON т.id = (элемент->>'id_товара')::INTEGER
    GROUP BY id_клиента
)
INSERT INTO заказы (id_клиента, общая_сумма)
SELECT id_клиента, общая_сумма
FROM итоговая_сумма;
```

#### Пример 3: Условная вставка (INSERT ... WHERE NOT EXISTS)

```sql
-- Вставка только если запись не существует
INSERT INTO клиенты (фамилия, имя, email, город)
SELECT 'Новый', 'Клиент', 'new@example.com', 'Москва'
WHERE NOT EXISTS (
    SELECT 1 FROM клиенты WHERE email = 'new@example.com'
);

-- Альтернатива с ON CONFLICT
INSERT INTO клиенты (фамилия, имя, email, город)
VALUES ('Новый', 'Клиент', 'new@example.com', 'Москва')
ON CONFLICT (email) DO NOTHING;
```

### Особенности и ограничения INSERT

#### Ограничения по типам данных

```sql
-- Правильное преобразование типов
INSERT INTO заказы (id_клиента, общая_сумма, дата_заказа)
VALUES (1, '1000.50'::NUMERIC, '2023-12-01'::DATE);

-- Автоматическое преобразование
INSERT INTO заказы (id_клиента, общая_сумма)
VALUES (1, 1000.50);  -- число автоматически преобразуется в NUMERIC
```

#### Работа с JSON данными

```sql
-- Вставка JSON данных
INSERT INTO клиенты (фамилия, имя, профиль)
VALUES (
    'Иванов', 
    'Иван', 
    JSONB_BUILD_OBJECT(
        'настройки', 
        JSONB_BUILD_OBJECT('тема', 'темная', 'язык', 'ru'),
        'интересы', 
        JSONB_BUILD_ARRAY('спорт', 'чтение', 'путешествия')
    )
);
```

### Практические советы по INSERT

#### 1. Используйте batch вставки для большого объема данных

```sql
-- ПЛОХО: много отдельных запросов
-- INSERT INTO products ... ;
-- INSERT INTO products ... ;
-- INSERT INTO products ... ; (и так много раз)

-- ХОРОШО: одна batch вставка
INSERT INTO products (name, price) VALUES 
    ('product1', 100),
    ('product2', 200),
    ('product3', 300);
    -- ... и т.д.
```

#### 2. Используйте COPY для очень больших объемов

```sql
-- Для очень больших объемов данных используйте COPY
-- COPY products FROM '/path/to/file.csv' WITH (FORMAT csv);
```

#### 3. Используйте ON CONFLICT для UPSERT операций

```sql
-- Вместо отдельных UPDATE и INSERT используйте ON CONFLICT
INSERT INTO пользователи (email, имя)
VALUES ('user@example.com', 'Иван')
ON CONFLICT (email) 
DO UPDATE SET имя = EXCLUDED.имя, дата_обновления = CURRENT_TIMESTAMP;
```

#### 4. Обработка возвращаемых значений

```sql
-- Использование возвращаемых значений для связанных операций
WITH новый_клиент AS (
    INSERT INTO клиенты (фамилия, имя, email)
    VALUES ('Тест', 'Пользователь', 'test@example.com')
    RETURNING id
)
INSERT INTO заказы (id_клиента, общая_сумма)
SELECT id, 1000.00 FROM новый_клиент;
```

### Ошибки и их обработка

#### Распространенные ошибки при INSERT

```sql
-- 1. Нарушение NOT NULL ограничения
-- INSERT INTO клиенты (фамилия) VALUES (NULL); -- ОШИБКА

-- 2. Нарушение уникальности
-- INSERT INTO клиенты (фамилия, имя, email) 
-- VALUES ('Иванов', 'Иван', 'существующий@email.com'); -- ОШИБКА если email уникален

-- 3. Нарушение CHECK ограничения
-- INSERT INTO товары (наименование, цена) 
-- VALUES ('Товар', -100); -- ОШИБКА если цена должна быть положительной

-- 4. Нарушение внешнего ключа
-- INSERT INTO заказы (id_клиента, общая_сумма) 
-- VALUES (999999, 1000); -- ОШИБКА если такого клиента нет
```

### Заключение главы

Команда INSERT - основа для наполнения базы данных информацией. Понимание различных способов вставки данных, включая вставку нескольких строк, вставку с SELECT, обработку конфликтов и возврат значений, критично для эффективной работы с базами данных. Правильное использование INSERT позволяет обеспечить целостность данных и эффективную загрузку информации в систему.

---

## Глава 52: Обновление данных (UPDATE)

### Введение

Команда UPDATE используется для изменения существующих данных в таблице. Это одна из основных операций DML (Data Manipulation Language), позволяющая модифицировать значения в одной или нескольких строках таблицы. UPDATE особенно важен для поддержания актуальности данных и реализации бизнес-логики обновления информации.

### Базовый синтаксис UPDATE

```sql
UPDATE имя_таблицы
SET столбец1 = значение1, 
    столбец2 = значение2, 
    ...
WHERE условие;
```

### Простые примеры UPDATE

#### Обновление отдельных записей

```sql
-- Обновление одного клиента
UPDATE клиенты
SET телефон = '+7(916)123-45-67'
WHERE id = 1;

-- Обновление нескольких столбцов
UPDATE клиенты
SET 
    город = 'Москва',
    активен = TRUE
WHERE email = 'ivanov@example.com';

-- Использование выражений при обновлении
UPDATE клиенты
SET 
    дата_обновления = CURRENT_TIMESTAMP,
    версия_записи = версия_записи + 1
WHERE id = 1;
```

### Условия в UPDATE

#### Обновление с условиями на основе значений

```sql
-- Обновление клиентов из определенного города
UPDATE клиенты
SET скидка = скидка + 5
WHERE город = 'Москва' AND скидка < 20;

-- Обновление с числовыми условиями
UPDATE товары
SET цена = цена * 1.1  -- увеличение цены на 10%
WHERE цена < 10000;

-- Обновление с датами
UPDATE клиенты
SET активен = FALSE
WHERE дата_регистрации < CURRENT_DATE - INTERVAL '1 year'
  AND (SELECT COUNT(*) FROM заказы WHERE id_клиента = клиенты.id) = 0;
```

### UPDATE с подзапросами

#### Использование скалярных подзапросов

```sql
-- Обновление на основе данных из другой таблицы
UPDATE клиенты
SET 
    скидка = (
        SELECT COALESCE(AVG(общая_сумма) / 1000, 0)
        FROM заказы
        WHERE id_клиента = клиенты.id
    )
WHERE EXISTS (
    SELECT 1 FROM заказы WHERE id_клиента = клиенты.id
);

-- Обновление с агрегацией
UPDATE товары
SET 
    средняя_оценка = (
        SELECT AVG(оценка)
        FROM отзывы
        WHERE id_товара = товары.id
    )
WHERE id IN (
    SELECT DISTINCT id_товара
    FROM отзывы
);
```

#### UPDATE с JOIN (альтернатива подзапросу)

```sql
-- Обновление с использованием JOIN (PostgreSQL поддерживает UPDATE ... FROM)
UPDATE клиенты
SET 
    скидка = скидка + заказы_стат.доп_скидка
FROM (
    SELECT 
        id_клиента,
        CASE 
            WHEN SUM(общая_сумма) > 100000 THEN 10
            WHEN SUM(общая_сумма) > 50000 THEN 5
            ELSE 0
        END AS доп_скидка
    FROM заказы
    GROUP BY id_клиента
) AS заказы_стат
WHERE клиенты.id = заказы_стат.id_клиента;

-- Альтернативный синтаксис
UPDATE клиенты
SET 
    скидка = CASE 
        WHEN заказы_сумма.сумма > 100000 THEN 15
        WHEN заказы_сумма.сумма > 50000 THEN 10
        ELSE клиенты.скидка
    END
FROM (
    SELECT 
        id_клиента,
        SUM(общая_сумма) AS сумма
    FROM заказы
    GROUP BY id_клиента
) AS заказы_сумма
WHERE клиенты.id = заказы_сумма.id_клиента;
```

### UPDATE с вычислениями и функциями

#### Математические вычисления

```sql
-- Обновление с математическими операциями
UPDATE товары
SET 
    цена = цена * 1.15,  -- увеличение на 15%
    цена = ROUND(цена, 2)  -- округление до копеек
WHERE категория = 'Электроника';

-- Обновление с условными выражениями
UPDATE заказы
SET 
    общая_сумма = общая_сумма * (1 - скидка_в_процентах/100),
    статус = CASE 
        WHEN общая_сумма > 100000 THEN 'высокий приоритет'
        WHEN общая_сумма > 50000 THEN 'средний приоритет'
        ELSE 'обычный'
    END
WHERE статус != 'архивный';
```

#### Строковые операции

```sql
-- Обновление строковых данных
UPDATE клиенты
SET 
    email = LOWER(TRIM(email)),
    фамилия = INITCAP(LOWER(фамилия)),
    имя = INITCAP(LOWER(имя))
WHERE POSITION(' ' IN email) > 0 OR email != LOWER(email);

-- Обновление с конкатенацией
UPDATE клиенты
SET 
    фамилия_и_имя = CONCAT(фамилия, ' ', имя)
WHERE фамилия_и_имя IS NULL;
```

### UPDATE с JSON данными

```sql
-- Обновление JSONB данных
UPDATE клиенты
SET профиль = JSONB_SET(
    профиль,
    '{настройки,тема}',
    '"темная"'::JSONB
)
WHERE id = 1;

-- Добавление в JSONB массив
UPDATE клиенты
SET профиль = JSONB_SET(
    профиль,
    '{интересы}',
    COALESCE(профиль->'интересы', '[]'::JSONB) || '["новый интерес"]'::JSONB
)
WHERE профиль ? 'интересы';  -- проверка наличия ключа
```

### Практические примеры UPDATE

#### Пример 1: Обновление статусов заказов

```sql
-- Обновление статусов заказов на основе даты
UPDATE заказы
SET 
    статус = 'просрочен',
    комментарий = CONCAT(COALESCE(комментарий, ''), ' Просрочен - ', CURRENT_DATE::TEXT)
WHERE 
    статус = 'в_доставке'
    AND дата_заказа < CURRENT_DATE - INTERVAL '14 days';
```

#### Пример 2: Обновление остатков товаров

```sql
-- Обновление остатков на основе завершенных заказов
UPDATE товары
SET 
    количество_на_складе = количество_на_складе - проданные.количество
FROM (
    SELECT 
        ot.id_товара,
        SUM(ot.количество) AS количество
    FROM заказы o
    JOIN заказы_товары ot ON o.id = ot.id_заказа
    WHERE o.статус = 'доставлен'
    GROUP BY ot.id_товара
) AS проданные
WHERE товары.id = проданные.id_товара
  AND товары.количество_на_складе >= проданные.количество;
```

#### Пример 3: Сезонные изменения цен

```sql
-- Сезонное изменение цен (например, скидки на зимние товары летом)
UPDATE товары
SET 
    цена = цена * 0.8,  -- 20% скидка
    дата_последнего_изменения = CURRENT_TIMESTAMP
WHERE 
    категория IN ('Зимняя одежда', 'Лыжи', 'Сноуборды')
    AND EXTRACT(MONTH FROM CURRENT_DATE) IN (6, 7, 8);  -- летние месяцы
```

#### Пример 4: Продвинутые вычисления

```sql
-- Обновление рейтинга клиентов на основе анализа
UPDATE клиенты
SET 
    рейтинг = клиенты_с_анализом.новый_рейтинг,
    сегмент = клиенты_с_анализом.сегмент
FROM (
    SELECT 
        к.id,
        CASE 
            WHEN стат.общая_сумма > 200000 THEN 10
            WHEN стат.общая_сумма > 100000 THEN 8
            WHEN стат.общая_сумма > 50000 THEN 6
            WHEN стат.количество_заказов > 10 THEN 5
            ELSE 3
        END AS новый_рейтинг,
        CASE 
            WHEN стат.общая_сумма > 200000 THEN 'VIP'
            WHEN стат.общая_сумма > 100000 THEN 'Премиум'
            WHEN стат.количество_заказов > 5 THEN 'Постоянный'
            ELSE 'Новый'
        END AS сегмент
    FROM клиенты к
    LEFT JOIN (
        SELECT 
            id_клиента,
            COUNT(*) AS количество_заказов,
            SUM(общая_сумма) AS общая_сумма,
            AVG(общая_сумма) AS средний_чек
        FROM заказы
        WHERE дата_заказа >= CURRENT_DATE - INTERVAL '1 year'
        GROUP BY id_клиента
    ) AS стат ON к.id = стат.id_клиента
) AS клиенты_с_анализом
WHERE клиенты.id = клиенты_с_анализом.id;
```

### UPDATE с возвратом значений (RETURNING)

```sql
-- Возврат обновленных значений
UPDATE клиенты
SET 
    скидка = скидка + 5,
    дата_обновления = CURRENT_TIMESTAMP
WHERE город = 'Москва'
RETURNING 
    id,
    фамилия,
    имя,
    скидка AS новая_скидка,
    дата_обновления;

-- Использование в CTE
WITH обновленные AS (
    UPDATE клиенты
    SET 
        скидка = CASE 
            WHEN (SELECT SUM(общая_сумма) FROM заказы WHERE id_клиента = клиенты.id) > 100000 
            THEN 15 
            ELSE скидка 
        END
    WHERE EXISTS (SELECT 1 FROM заказы WHERE id_клиента = клиенты.id)
    RETURNING id, фамилия, скидка
)
SELECT 
    фамилия,
    скидка
FROM обновленные
ORDER BY скидка DESC;
```

### UPDATE с ограничениями и проверками

#### Проверка перед обновлением

```sql
-- Обновление с проверкой условий (в реальной жизни лучше использовать триггеры или приложение)
UPDATE товары
SET 
    количество_на_складе = количество_на_складе - 1
WHERE id IN (
    SELECT id FROM товары 
    WHERE количество_на_складе >= 1  -- проверка, что остаток позволяет уменьшить
)
AND id = 1;  -- конкретный товар
```

### Опасности и предосторожности

#### Опасность: UPDATE без WHERE (обновление всех строк)

```sql
-- ОПАСНО: обновит ВСЕ строки в таблице
-- UPDATE клиенты SET скидка = 10;

-- ПРАВИЛЬНО: всегда используйте WHERE или будьте уверены в своих действиях
UPDATE клиенты 
SET скидка = 10 
WHERE условие_фильтрации;
```

#### Использование транзакций для безопасности

```sql
-- UPDATE в транзакции для безопасности
BEGIN;

UPDATE клиенты
SET 
    скидка = 15,
    дата_обновления = CURRENT_TIMESTAMP
WHERE id IN (1, 2, 3);

-- Проверка результатов
SELECT id, фамилия, скидка FROM клиенты WHERE id IN (1, 2, 3);

-- Если все верно - фиксируем
COMMIT;
-- Если что-то не так - откатываем
-- ROLLBACK;
```

### Практические советы

#### 1. Всегда тестируйте UPDATE с SELECT

```sql
-- ПЛОХО: сразу обновлять
-- UPDATE клиенты SET скидка = 10 WHERE условие;

-- ХОРОШО: сначала проверить с SELECT
SELECT id, фамилия, скидка FROM клиенты WHERE условие;

-- Затем выполнить UPDATE
UPDATE клиенты SET скидка = 10 WHERE условие;
```

#### 2. Используйте транзакции для сложных обновлений

```sql
-- Для сложных обновлений используйте транзакции
BEGIN;

UPDATE клиенты SET скидка = 15 WHERE id = 1;
UPDATE заказы SET общая_сумма = общая_сумма * 0.85 WHERE id_клиента = 1;
UPDATE товары SET количество_на_складе = количество_на_складе - 1 WHERE id = 1;

COMMIT;
```

#### 3. Используйте LIMIT при необходимости (в PostgreSQL через подзапрос)

```sql
-- Ограничьте количество обновляемых строк при необходимости
UPDATE клиенты
SET скидка = 10
WHERE id IN (
    SELECT id 
    FROM клиенты 
    WHERE активен = TRUE 
    ORDER BY дата_регистрации 
    LIMIT 100
);
```

### Заключение главы

Команда UPDATE - мощный инструмент для модификации существующих данных. При правильном использовании она позволяет поддерживать актуальность информации в базе данных. Важно всегда использовать точные условия в WHERE, тестировать запросы заранее и использовать транзакции для сложных обновлений. Понимание различных способов обновления данных, включая использование подзапросов, JOIN и выражений, критично для эффективной работы с базами данных.

---

## Глава 53: Удаление данных (DELETE)

### Введение

Команда DELETE используется для удаления существующих записей из таблицы. Это важная операция DML, позволяющая управлять содержимым таблицы, удалять устаревшие или ненужные данные, а также поддерживать целостность информации. Важно понимать, как правильно использовать DELETE, учитывая возможные последствия и ограничения.

### Базовый синтаксис DELETE

```sql
DELETE FROM имя_таблицы
WHERE условие;
```

### Простые примеры DELETE

#### Удаление отдельных записей

```sql
-- Удаление клиента по ID
DELETE FROM клиенты
WHERE id = 1;

-- Удаление клиента по email
DELETE FROM клиенты
WHERE email = 'unwanted@example.com';

-- Удаление с условием
DELETE FROM заказы
WHERE дата_заказа < '2020-01-01' AND статус = 'отменен';
```

### Условия в DELETE

#### Удаление с числовыми условиями

```sql
-- Удаление товаров с низкой ценой
DELETE FROM товары
WHERE цена < 100 AND количество_на_складе = 0;

-- Удаление заказов с низкой суммой
DELETE FROM заказы
WHERE общая_сумма < 1000 AND статус = 'новый' AND дата_заказа < CURRENT_DATE - INTERVAL '1 day';
```

#### Удаление с датами

```sql
-- Удаление старых заказов
DELETE FROM заказы
WHERE дата_заказа < CURRENT_DATE - INTERVAL '2 years';

-- Удаление клиентов, неактивных длительное время
DELETE FROM клиенты
WHERE дата_регистрации < CURRENT_DATE - INTERVAL '3 years'
  AND (SELECT COUNT(*) FROM заказы WHERE id_клиента = клиенты.id) = 0;
```

### DELETE с подзапросами

#### Использование подзапросов в WHERE

```sql
-- Удаление клиентов без заказов
DELETE FROM клиенты
WHERE id NOT IN (
    SELECT DISTINCT id_клиента 
    FROM заказы 
    WHERE id_клиента IS NOT NULL
);

-- Удаление товаров без заказов за последний год
DELETE FROM товары
WHERE id NOT IN (
    SELECT DISTINCT ot.id_товара
    FROM заказы_товары ot
    JOIN заказы z ON ot.id_заказа = z.id
    WHERE z.дата_заказа >= CURRENT_DATE - INTERVAL '1 year'
);
```

#### DELETE с EXISTS

```sql
-- Использование EXISTS (часто более эффективно)
DELETE FROM клиенты
WHERE NOT EXISTS (
    SELECT 1 FROM заказы WHERE id_клиента = клиенты.id
)
AND дата_регистрации < CURRENT_DATE - INTERVAL '1 year';

-- Удаление заказов с определенным условием
DELETE FROM заказы
WHERE EXISTS (
    SELECT 1 
    FROM клиенты 
    WHERE клиенты.id = заказы.id_клиента 
    AND клиенты.активен = FALSE
);
```

### DELETE с JOIN (используя USING в PostgreSQL)

```sql
-- Удаление заказов клиентов из определенного города
DELETE FROM заказы
USING клиенты
WHERE заказы.id_клиента = клиенты.id
  AND клиенты.город = 'Москва'
  AND заказы.дата_заказа < '2022-01-01';

-- Удаление товаров определенной категории с низким остатком
DELETE FROM товары
USING категории
WHERE товары.id_категории = категории.id
  AND категории.название = 'Уцененные товары'
  AND товары.количество_на_складе = 0;
```

### DELETE с возвратом значений (RETURNING)

```sql
-- Возврат удаленных данных
DELETE FROM клиенты
WHERE дата_регистрации < '2021-01-01' AND (SELECT COUNT(*) FROM заказы WHERE id_клиента = клиенты.id) = 0
RETURNING id, фамилия, имя, email, дата_регистрации;

-- Сохранение удаленных данных перед удалением
WITH удаленные_данные AS (
    DELETE FROM клиенты
    WHERE дата_регистрации < '2021-01-01' AND (SELECT COUNT(*) FROM заказы WHERE id_клиента = клиенты.id) = 0
    RETURNING *
)
INSERT INTO клиенты_архив SELECT *, CURRENT_DATE FROM удаленные_данные;
```

### Практические примеры DELETE

#### Пример 1: Очистка старых логов

```sql
-- Удаление логов старше 30 дней
DELETE FROM логи
WHERE дата_время < CURRENT_DATE - INTERVAL '30 days';
```

#### Пример 2: Удаление временных/тестовых записей

```sql
-- Удаление тестовых клиентов
DELETE FROM клиенты
WHERE email LIKE '%test%' OR email LIKE '%demo%' OR email LIKE '%temp%';

-- Удаление тестовых заказов
DELETE FROM заказы
WHERE id_клиента IN (
    SELECT id FROM клиенты WHERE email LIKE '%test%'
);
```

#### Пример 3: Каскадное удаление через подзапросы

```sql
-- Удаление заказов и заказанных товаров (в правильном порядке)
-- Сначала удаляем связи
DELETE FROM заказы_товары
WHERE id_заказа IN (
    SELECT id FROM заказы WHERE дата_заказа < '2021-01-01'
);

-- Потом удаляем заказы
DELETE FROM заказы
WHERE дата_заказа < '2021-01-01';
```

#### Пример 4: Удаление с подсчетом

```sql
-- Удаление с подсчетом удаленных записей
WITH удаленные AS (
    DELETE FROM товары
    WHERE количество_на_складе = 0 AND дата_обновления < CURRENT_DATE - INTERVAL '6 months'
    RETURNING *
)
SELECT COUNT(*) AS количество_удаленных FROM удаленные;
```

### DELETE и внешние ключи

#### Нарушение ограничений внешних ключей

```sql
-- Следующий запрос может вызвать ошибку, если есть связанные заказы
-- DELETE FROM клиенты WHERE id = 1;  -- ОШИБКА, если есть заказы у этого клиента

-- Решения:
-- 1. Удалить сначала связанные данные
DELETE FROM заказы WHERE id_клиента = 1;
DELETE FROM клиенты WHERE id = 1;

-- 2. Использовать каскадное удаление (если было определено при создании FK)
-- ALTER TABLE заказы ADD FOREIGN KEY (id_клиента) REFERENCES клиенты(id) ON DELETE CASCADE;

-- 3. Установить связанные поля в NULL (если возможно)
-- ALTER TABLE заказы ADD FOREIGN KEY (id_клиента) REFERENCES клиенты(id) ON DELETE SET NULL;
```

#### DELETE с учетом ограничений

```sql
-- Безопасное удаление с проверкой связей
DELETE FROM клиенты
WHERE id = 1
  AND NOT EXISTS (SELECT 1 FROM заказы WHERE id_клиента = клиенты.id);
```

### DELETE в транзакциях

```sql
-- DELETE в транзакции для безопасности
BEGIN;

-- Сохраняем данные перед удалением
CREATE TEMP TABLE сохраненные_данные AS
SELECT * FROM клиенты WHERE id = 1;

-- Удаляем
DELETE FROM клиенты WHERE id = 1;

-- ПРОВЕРКА: если все ОК - фиксируем
COMMIT;

-- ИЛИ: если что-то пошло не так - откатываем
-- ROLLBACK;
```

### Оптимизация DELETE

#### Удаление большого объема данных

```sql
-- Для удаления большого объема данных лучше использовать несколько подходов:

-- 1. Удалять порционно
DELETE FROM заказы
WHERE дата_заказа < '2020-01-01'
LIMIT 1000;

-- 2. Использовать TRUNCATE для полной очистки (с осторожностью)
-- TRUNCATE TABLE временные_данные; -- удаляет все, быстрее, но не позволяет откатить

-- 3. Использовать архивацию вместо удаления
WITH старые_данные AS (
    DELETE FROM заказы
    WHERE дата_заказа < '2020-01-01'
    RETURNING *
)
INSERT INTO заказы_архив SELECT *, '2023 архив' FROM старые_данные;
```

### Практические советы

#### 1. Всегда тестируйте DELETE с SELECT

```sql
-- ВСЕГДА сначала проверяйте, что будет удалено
SELECT * FROM клиенты WHERE условие_удаления;
-- Только потом:
DELETE FROM клиенты WHERE условие_удаления;
```

#### 2. Используйте транзакции

```sql
-- Для важных удалений всегда используйте транзакции
BEGIN;
DELETE FROM важная_таблица WHERE условие;
-- Проверьте результат
SELECT COUNT(*) FROM важная_таблица;
-- Если все ОК:
COMMIT;
-- Если ошибка:
-- ROLLBACK;
```

#### 3. Будьте осторожны с отсутствием WHERE

```sql
-- ОПАСНО: удалит ВСЕ данные из таблицы
-- DELETE FROM таблица;

-- ПРАВИЛЬНО: всегда используйте WHERE или будьте уверены
DELETE FROM таблица WHERE условие_фильтрации;
```

#### 4. Рассмотрите архивацию вместо удаления

```sql
-- Вместо удаления часто лучше архивировать
UPDATE клиенты
SET 
    активен = FALSE,
    архивный = TRUE,
    дата_архивации = CURRENT_TIMESTAMP
WHERE условие_архивации;
```

### Альтернативы DELETE

#### TRUNCATE

```sql
-- TRUNCATE: удаляет все строки из таблицы, быстрее DELETE, но:
-- - нельзя откатить (если не в транзакции)
-- - нельзя использовать WHERE
-- - не срабатывает триггеры
-- - сбрасывает счетчики SERIAL

TRUNCATE TABLE временные_результаты;

-- TRUNCATE с каскадом (удаляет связанные данные)
-- TRUNCATE TABLE основная_таблица CASCADE;
```

#### UPDATE вместо DELETE

```sql
-- Иногда лучше использовать UPDATE с флагом вместо DELETE
UPDATE клиенты
SET 
    активен = FALSE,
    дата_удаления = CURRENT_TIMESTAMP
WHERE условие_деактивации;
```

### Заключение главы

Команда DELETE - мощный, но потенциально опасный инструмент для управления данными. Она позволяет удалять ненужные или устаревшие записи, но требует особой осторожности. Всегда тестируйте свои DELETE-запросы сначала через SELECT, используйте транзакции для важных операций и учитывайте связи между таблицами. Понимание различных подходов к удалению данных и их последствий критично для безопасной и эффективной работы с базами данных.

---

## Глава 54: Изменение структуры таблиц (ALTER TABLE)

### Введение

ALTER TABLE - это команда SQL, которая позволяет изменять структуру существующей таблицы. С ее помощью можно добавлять, изменять или удалять столбцы, изменять типы данных, добавлять или удалять ограничения, изменять имена столбцов и таблиц. Это важнейший инструмент при развитии базы данных и изменении бизнес-требований.

### Базовый синтаксис ALTER TABLE

```sql
ALTER TABLE имя_таблицы
действие_с_таблицей;
```

### Добавление столбцов

#### Добавление одного столбца

```sql
-- Добавление столбца без ограничений
ALTER TABLE клиенты
ADD COLUMN телефон VARCHAR(20);

-- Добавление столбца с ограничениями
ALTER TABLE клиенты
ADD COLUMN дата_рождения DATE CHECK (дата_рождения <= CURRENT_DATE);

-- Добавление столбца с DEFAULT значением
ALTER TABLE клиенты
ADD COLUMN активен BOOLEAN DEFAULT TRUE NOT NULL;

-- Добавление столбца с внешним ключом
ALTER TABLE заказы
ADD COLUMN id_менеджера INTEGER REFERENCES сотрудники(id);
```

#### Добавление нескольких столбцов (PostgreSQL позволяет добавлять по одному)

```sql
-- Несколько ALTER TABLE команд подряд
ALTER TABLE клиенты ADD COLUMN телефон VARCHAR(20);
ALTER TABLE клиенты ADD COLUMN дата_рождения DATE;
ALTER TABLE клиенты ADD COLUMN комментарий TEXT;

-- Или в одной транзакции
BEGIN;
ALTER TABLE клиенты ADD COLUMN телефон VARCHAR(20);
ALTER TABLE клиенты ADD COLUMN дата_рождения DATE;
ALTER TABLE клиенты ADD COLUMN комментарий TEXT;
COMMIT;
```

### Удаление столбцов

```sql
-- Удаление столбца
ALTER TABLE клиенты
DROP COLUMN комментарий;

-- Удаление столбца с подтверждением (CASCADE - удаляет зависимости)
ALTER TABLE клиенты
DROP COLUMN старый_столбец CASCADE;

-- Удаление столбца только если он существует
ALTER TABLE клиенты
DROP COLUMN IF EXISTS несуществующий_столбец;
```

### Изменение типа данных столбцов

```sql
-- Изменение типа данных
ALTER TABLE клиенты
ALTER COLUMN email TYPE VARCHAR(150);

-- Изменение типа данных с преобразованием
ALTER TABLE товары
ALTER COLUMN цена TYPE NUMERIC(12, 2);

-- Изменение типа данных с USING (для сложных преобразований)
ALTER TABLE клиенты
ALTER COLUMN дата_регистрации TYPE TIMESTAMP
USING дата_регистрации::TIMESTAMP;
```

### Изменение DEFAULT значений

```sql
-- Установка нового DEFAULT значения
ALTER TABLE клиенты
ALTER COLUMN скидка SET DEFAULT 5;

-- Удаление DEFAULT значения
ALTER TABLE клиенты
ALTER COLUMN скидка DROP DEFAULT;

-- Установка DEFAULT с выражением
ALTER TABLE заказы
ALTER COLUMN дата_заказа SET DEFAULT CURRENT_TIMESTAMP;
```

### Изменение ограничений NOT NULL

```sql
-- Добавление NOT NULL ограничения
ALTER TABLE клиенты
ALTER COLUMN email SET NOT NULL;

-- Удаление NOT NULL ограничения
ALTER TABLE клиенты
ALTER COLUMN отчество DROP NOT NULL;

-- Эти изменения могут потребовать предварительной проверки данных
```

### Изменение имени столбцов

```sql
-- Изменение имени столбца
ALTER TABLE клиенты
RENAME COLUMN телефон TO контактный_телефон;

-- Изменение имени столбца с проверкой
ALTER TABLE клиенты
RENAME COLUMN IF EXISTS старое_имя TO новое_имя;
```

### Изменение имени таблицы

```sql
-- Изменение имени всей таблицы
ALTER TABLE клиенты
RENAME TO пользователи;

-- Изменение имени таблицы с проверкой
ALTER TABLE IF EXISTS старое_название
RENAME TO новое_название;
```

### Добавление ограничений

#### Добавление CHECK ограничения

```sql
-- Добавление CHECK ограничения
ALTER TABLE товары
ADD CONSTRAINT chk_цена_положительная CHECK (цена > 0);

-- Добавление CHECK ограничения с именем
ALTER TABLE заказы
ADD CONSTRAINT chk_сумма_неотрицательная CHECK (общая_сумма >= 0);
```

#### Добавление UNIQUE ограничения

```sql
-- Добавление UNIQUE ограничения
ALTER TABLE клиенты
ADD CONSTRAINT uk_email_уникальный UNIQUE (email);

-- Добавление составного UNIQUE ограничения
ALTER TABLE заказы_товары
ADD CONSTRAINT uk_заказ_товар_уникальный UNIQUE (id_заказа, id_товара);
```

#### Добавление FOREIGN KEY ограничения

```sql
-- Добавление внешнего ключа
ALTER TABLE заказы
ADD CONSTRAINT fk_заказы_клиенты 
FOREIGN KEY (id_клиента) REFERENCES клиенты(id);

-- Добавление внешнего ключа с опциями
ALTER TABLE заказы
ADD CONSTRAINT fk_заказы_клиенты 
FOREIGN KEY (id_клиента) REFERENCES клиенты(id) 
ON DELETE SET NULL ON UPDATE CASCADE;
```

#### Добавление PRIMARY KEY

```sql
-- Добавление первичного ключа
ALTER TABLE какая_то_таблица
ADD CONSTRAINT pk_таблица PRIMARY KEY (id);

-- Добавление составного первичного ключа
ALTER TABLE заказы_товары
ADD CONSTRAINT pk_заказы_товары PRIMARY KEY (id_заказа, id_товара);
```

### Удаление ограничений

```sql
-- Удаление ограничения по имени
ALTER TABLE клиенты
DROP CONSTRAINT uk_email_уникальный;

-- Удаление ограничения с проверкой
ALTER TABLE клиенты
DROP CONSTRAINT IF EXISTS несуществующее_ограничение;

-- Удаление внешнего ключа
ALTER TABLE заказы
DROP CONSTRAINT fk_заказы_клиенты;

-- Удаление первичного ключа
ALTER TABLE какая_то_таблица
DROP CONSTRAINT pk_таблица;
```

### Практические примеры ALTER TABLE

#### Пример 1: Расширение таблицы клиентов

```sql
-- Добавление новых полей в таблицу клиентов
BEGIN;

-- Добавление столбцов
ALTER TABLE клиенты ADD COLUMN дата_рождения DATE;
ALTER TABLE клиенты ADD COLUMN согласие_на_рассылку BOOLEAN DEFAULT FALSE;
ALTER TABLE клиенты ADD COLUMN дата_последнего_контакта TIMESTAMP;
ALTER TABLE клиенты ADD COLUMN профиль JSONB;

-- Добавление ограничений
ALTER TABLE клиенты ADD CONSTRAINT chk_возраст_разумный CHECK (дата_рождения <= CURRENT_DATE - INTERVAL '18 years');

-- Обновление существующих записей
UPDATE клиенты SET согласие_на_рассылку = TRUE WHERE email IS NOT NULL;

COMMIT;
```

#### Пример 2: Оптимизация структуры таблицы заказов

```sql
-- Изменение структуры таблицы заказов
BEGIN;

-- Изменение типа данных для большей точности
ALTER TABLE заказы ALTER COLUMN общая_сумма TYPE NUMERIC(14, 2);

-- Добавление столбца для отслеживания версий
ALTER TABLE заказы ADD COLUMN версия_записи INTEGER DEFAULT 1;
ALTER TABLE заказы ADD COLUMN дата_обновления TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Добавление ограничения
ALTER TABLE заказы ADD CONSTRAINT chk_сумма_положительная CHECK (общая_сумма >= 0);

-- Добавление индекса (не ALTER TABLE, но часто делается вместе)
-- CREATE INDEX idx_заказы_клиент_дата ON заказы (id_клиента, дата_заказа);

COMMIT;
```

#### Пример 3: Изменение связей между таблицами

```sql
-- Обновление связей между таблицами
BEGIN;

-- Сначала добавляем новый столбец для связи
ALTER TABLE заказы ADD COLUMN id_доставки INTEGER;

-- Обновляем данные (если нужно)
-- UPDATE заказы SET id_доставки = ... WHERE ...;

-- Добавляем внешний ключ
ALTER TABLE заказы 
ADD CONSTRAINT fk_заказы_доставка 
FOREIGN KEY (id_доставки) REFERENCES доставка(id) 
ON DELETE SET NULL;

-- Если нужно, удаляем старый столбец
-- ALTER TABLE заказы DROP COLUMN старый_столбец CASCADE;

COMMIT;
```

### Опасности и предосторожности при ALTER TABLE

#### Блокировки таблицы

```sql
-- Некоторые операции ALTER TABLE блокируют таблицу на время выполнения
-- Особенно изменение типов данных или добавление NOT NULL столбцов с DEFAULT

-- Для больших таблиц лучше выполнять в периоды низкой нагрузки
-- Или использовать онлайн-миграции (например, через pgroll в PostgreSQL)
```

#### Потеря данных

```sql
-- Опасные операции:
-- 1. ALTER COLUMN TYPE (может привести к потере данных при несовместимом преобразовании)
-- 2. DROP COLUMN (удаляет столбец и все данные в нем)
-- 3. DROP TABLE (полностью удаляет таблицу)

-- ВСЕГДА делайте резервную копию перед значительными изменениями
```

### Проверки перед ALTER TABLE

#### Проверка существования столбца

```sql
-- Проверить, существует ли столбец, перед добавлением
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'клиенты' AND column_name = 'новый_столбец';

-- Использование IF NOT EXISTS / IF EXISTS
ALTER TABLE клиенты ADD COLUMN IF NOT EXISTS новый_столбец TEXT;
ALTER TABLE клиенты DROP COLUMN IF EXISTS старый_столбец;
```

#### Проверка зависимостей

```sql
-- Проверить зависимости перед удалением столбца
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
WHERE ccu.column_name = 'id_клиента' AND ccu.table_name = 'клиенты';
```

### Расширенные возможности ALTER TABLE

#### Изменение владельца таблицы

```sql
-- Изменение владельца таблицы
ALTER TABLE клиенты OWNER TO новый_владелец;
```

#### Изменение табличного пространства

```sql
-- Перемещение таблицы в другое табличное пространство
-- ALTER TABLE клиенты SET TABLESPACE новое_табличное_пространство;
```

#### Изменение параметров хранения

```sql
-- Изменение параметров хранения
ALTER TABLE клиенты SET (fillfactor = 90);
ALTER TABLE клиенты RESET (autovacuum_enabled);
```

### Практические советы

#### 1. Планируйте изменения заранее

```sql
-- Составьте план изменений:
-- 1. Создать резервную копию
-- 2. Протестировать на тестовой базе
-- 3. Запланировать на период минимальной нагрузки
-- 4. Выполнить с мониторингом
```

#### 2. Используйте транзакции для сложных изменений

```sql
-- Объединяйте связанные изменения в транзакции
BEGIN;
ALTER TABLE заказы ADD COLUMN новый_столбец INTEGER;
ALTER TABLE заказы ADD CONSTRAINT chk_новый_столбец CHECK (новый_столбец >= 0);
-- ... другие изменения
COMMIT;
```

#### 3. Документируйте изменения

```sql
-- Добавляйте комментарии к изменениям
COMMENT ON COLUMN клиенты.новый_столбец IS 'Новый столбец для хранения дополнительной информации';
```

#### 4. Используйте безопасные операции

```sql
-- Всегда используйте IF EXISTS/IF NOT EXISTS для безопасных изменений
ALTER TABLE IF EXISTS существующая_таблица 
ADD COLUMN IF NOT EXISTS новый_столбец TEXT;
```

### Заключение главы

ALTER TABLE - мощный инструмент для эволюции структуры базы данных. Он позволяет адаптировать таблицы к изменяющимся бизнес-требованиям, но требует осторожности и планирования. Всегда тестируйте изменения на тестовых данных, делайте резервные копии и выполняйте операции в периоды низкой нагрузки. Правильное использование ALTER TABLE позволяет поддерживать актуальность и гибкость вашей базы данных.

---

## Глава 55: Удаление таблиц (DROP TABLE)

### Введение

Команда DROP TABLE используется для полного удаления таблицы из базы данных, включая все её данные, структуру, ограничения, индексы и привилегии. Это одна из самых радикальных операций в SQL, и она требует особой осторожности, так как удаленные данные и структура не могут быть восстановлены простым способом.

### Базовый синтаксис DROP TABLE

```sql
DROP TABLE имя_таблицы;

-- Или с опцией
DROP TABLE [IF EXISTS] имя_таблицы [CASCADE | RESTRICT];
```

### Простые примеры DROP TABLE

#### Удаление одной таблицы

```sql
-- Удаление таблицы
DROP TABLE временные_данные;

-- Удаление таблицы с проверкой существования
DROP TABLE IF EXISTS несуществующая_таблица;  -- Не вызывает ошибку, если таблица не существует
```

### Опция CASCADE vs RESTRICT

#### RESTRICT (по умолчанию)

```sql
-- RESTRICT: не позволяет удалить таблицу, если на неё есть зависимости
-- DROP TABLE таблица RESTRICT; -- по умолчанию
-- Это вызовет ошибку, если есть внешние ключи, ссылающиеся на эту таблицу
```

#### CASCADE

```sql
-- CASCADE: автоматически удаляет все зависимости
DROP TABLE клиенты CASCADE;  -- Удалит таблицу клиенты и все таблицы/ограничения, зависящие от неё

-- ПРИМЕР:
-- Если у вас есть таблица клиенты и таблица заказы с внешним ключом на клиенты,
-- DROP TABLE клиенты CASCADE удалит и заказы (если у них каскадное удаление)
```

### Практические примеры использования DROP TABLE

#### Пример 1: Удаление временной таблицы

```sql
-- Создание временной таблицы для обработки данных
CREATE TEMPORARY TABLE промежуточные_результаты (
    id SERIAL,
    результат TEXT,
    дата_обработки TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Работа с таблицей...
INSERT INTO промежуточные_результаты (результат) VALUES ('обработано');

-- Удаление временной таблицы после использования
DROP TABLE промежуточные_результаты;
```

#### Пример 2: Удаление тестовой таблицы

```sql
-- Удаление тестовой таблицы с проверкой
DROP TABLE IF EXISTS тестовая_таблица;

-- Это предотвращает ошибки, если таблица не существует
```

#### Пример 3: Удаление таблицы с зависимостями (каскад)

```sql
-- Предположим, у нас есть следующие таблицы:
-- 1. клиенты (id, фамилия, имя)
-- 2. заказы (id, id_клиента, сумма) - c FK на клиенты
-- 3. заказы_товары (id_заказа, id_товара) - с FK на заказы

-- Удаление всех связанных таблиц каскадом
BEGIN;
DROP TABLE клиенты CASCADE;  -- Это удалит также заказы и другие зависящие объекты
COMMIT;

-- ВАЖНО: CASCADE может удалить больше, чем вы планировали
```

### Безопасное удаление таблиц

#### Проверка зависимостей перед удалением

```sql
-- Проверить, есть ли зависимости перед удалением
SELECT 
    tc.table_name AS "Таблица, зависящая от нашей",
    tc.constraint_name,
    kcu.column_name AS "Столбец с FK"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE kcu.table_name = 'клиенты'  -- имя таблицы, которую хотим удалить
  AND tc.constraint_type = 'FOREIGN KEY';
```

#### Резервное копирование перед удалением

```sql
-- Перед удалением критичной таблицы:
BEGIN;

-- Создать резервную копию
CREATE TABLE клиенты_резерв AS SELECT * FROM клиенты;

-- Проверить копию
SELECT COUNT(*) FROM клиенты_резерв;

-- Только потом удалить оригинал
DROP TABLE клиенты;

COMMIT;
```

### Удаление нескольких таблиц

```sql
-- Удаление нескольких таблиц (в правильном порядке для избежания ошибок)
DROP TABLE IF EXISTS заказы_товары CASCADE;
DROP TABLE IF EXISTS заказы CASCADE;
DROP TABLE IF EXISTS клиенты CASCADE;

-- Или в одной команде (PostgreSQL поддерживает):
-- DROP TABLE IF EXISTS таблица1, таблица2, таблица3 CASCADE;
```

### Временные таблицы и DROP TABLE

```sql
-- Временные таблицы автоматически удаляются при завершении сессии
-- Но можно явно удалить:
CREATE TEMP TABLE временная (
    id SERIAL PRIMARY KEY
);

-- Явное удаление
DROP TABLE временная;

-- Временные таблицы с автоматическим удалением
-- CREATE TEMP TABLE ...
-- Будет удалена при закрытии соединения
```

### Практические сценарии использования DROP TABLE

#### Сценарий 1: Очистка тестовой среды

```sql
-- Полная очистка тестовой базы
BEGIN;

-- Удаление всех таблиц (в правильном порядке)
DROP TABLE IF EXISTS заказы_товары CASCADE;
DROP TABLE IF EXISTS заказы CASCADE;
DROP TABLE IF EXISTS товары CASCADE;
DROP TABLE IF EXISTS клиенты CASCADE;
DROP TABLE IF EXISTS категории CASCADE;

COMMIT;
```

#### Сценарий 2: Пересоздание таблицы

```sql
-- Когда нужно изменить структуру таблицы радикально
BEGIN;

-- Создать резервную копию
CREATE TABLE клиенты_резерв_1 AS SELECT * FROM клиенты;

-- Удалить старую таблицу
DROP TABLE клиенты CASCADE;

-- Создать новую структуру
CREATE TABLE клиенты (
    id SERIAL PRIMARY KEY,
    фамилия VARCHAR(50) NOT NULL,
    имя VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE,
    дата_регистрации TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Вернуть данные (если возможно)
INSERT INTO клиенты (фамилия, имя, email, дата_регистрации)
SELECT фамилия, имя, email, дата_регистрации FROM клиенты_резерв_1;

-- Удалить резервную копию
DROP TABLE клиенты_резерв_1;

COMMIT;
```

#### Сценарий 3: Удаление архивных таблиц

```sql
-- Удаление таблицы с историческими данными
-- Предположим, данные за 2022 год больше не нужны
BEGIN;

-- Проверить, есть ли зависимости
-- ...

-- Удалить таблицу
DROP TABLE данные_за_2022_год;

COMMIT;
```

### Опасности и предосторожности

#### Главная опасность: потеря всех данных

```sql
-- ПОМНИТЕ: DROP TABLE УДАЛЯЕТ ВСЕ ДАННЫЕ БЕЗВОЗВРАТНО
-- DROP TABLE важная_таблица; -- ВСЕ данные потеряны!
```

#### Проверка прав на удаление

```sql
-- Убедиться, что у вас есть права на удаление таблицы
-- Проверить владельца таблицы:
SELECT tableowner FROM pg_tables WHERE tablename = 'имя_таблицы';
```

#### Проверка содержимого перед удалением

```sql
-- ВСЕГДА проверяйте, что будет удалено:
SELECT COUNT(*) FROM таблица;  -- Посмотреть количество строк
SELECT * FROM таблица LIMIT 5;  -- Посмотреть несколько строк

-- Только потом:
-- DROP TABLE таблица;
```

### Альтернативы DROP TABLE

#### TRUNCATE TABLE

```sql
-- TRUNCATE удаляет все данные, но сохраняет структуру таблицы
TRUNCATE TABLE временные_результаты;

-- TRUNCATE быстрее DROP TABLE + CREATE TABLE
-- Но структура таблицы остается
```

#### Переименование вместо удаления

```sql
-- Вместо удаления можно переименовать таблицу
ALTER TABLE старая_таблица RENAME TO старая_таблица_2023_11_17_архив;

-- Потом можно удалить в удобное время
-- DROP TABLE старая_таблица_2023_11_17_архив;
```

### Практические советы

#### 1. Всегда используйте IF EXISTS

```sql
-- Правильно:
DROP TABLE IF EXISTS возможная_таблица;

-- Неправильно (может вызвать ошибку):
-- DROP TABLE возможная_таблица;
```

#### 2. Планируйте удаление зависимостей

```sql
-- При удалении таблицы с внешними ключами:
-- 1. Удалите зависимые таблицы первыми, или
-- 2. Используйте CASCADE, или
-- 3. Удалите ограничения внешних ключей
```

#### 3. Делайте резервные копии

```sql
-- Перед удалением важных таблиц:
BEGIN;

-- Создать резервную копию
CREATE TABLE таблица_архив AS SELECT * FROM важная_таблица;

-- Проверить копию
SELECT COUNT(*) FROM таблица_архив;

-- Удалить оригинал
DROP TABLE важная_таблица;

COMMIT;
```

#### 4. Используйте транзакции для безопасности

```sql
-- Используйте транзакции, чтобы иметь возможность отката
BEGIN;

-- Удаление
DROP TABLE временные_данные;

-- Проверка
-- Если что-то не так:
-- ROLLBACK;
-- Если все ОК:
COMMIT;
```

#### 5. Будьте осторожны с именами

```sql
-- Проверьте имя таблицы:
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Используйте полное имя: схема.таблица
-- DROP TABLE public.таблица;
```

### Заключение главы

DROP TABLE - это мощная, но потенциально опасная команда, которая полностью удаляет таблицу и все её содержимое. Её следует использовать с максимальной осторожностью, всегда проверяя, что:

1. Вы удаляете правильную таблицу
2. У вас есть права на удаление
3. Вы понимаете последствия удаления (каскадные удаления)
4. У вас есть резервные копии при необходимости
5. Вы в нужной базе данных

Понимание и правильное использование DROP TABLE критично для безопасного управления структурой базы данных.

---

## Глава 56: Транзакции

### Введение

Транзакция - это последовательность SQL-операций, которая рассматривается как единая неделимая единица работы. Все операции в транзакции либо завершаются успешно и изменения фиксируются в базе данных, либо, в случае ошибки, все изменения откатываются, как будто транзакция и не выполнялась. Это обеспечивает целостность данных и надежность операций.

### Основные принципы транзакций (ACID)

1. **Атомарность (Atomicity)**: все операции в транзакции выполняются как единое целое
2. **Согласованность (Consistency)**: после выполнения транзакции база данных остается в согласованном состоянии
3. **Изолированность (Isolation)**: транзакции не влияют друг на друга
4. **Долговечность (Durability)**: после фиксации транзакции изменения сохраняются навсегда

### Базовый синтаксис транзакций

```sql
BEGIN;          -- Начало транзакции
-- SQL-операции
COMMIT;         -- Фиксация изменений
-- или
ROLLBACK;       -- Откат изменений
```

### Простой пример транзакции

```sql
-- Перевод денег между счетами
BEGIN;

-- Снять деньги со счета 1
UPDATE счета SET баланс = баланс - 1000 WHERE номер = '001';

-- Зачислить деньги на счет 2
UPDATE счета SET баланс = баланс + 1000 WHERE номер = '002';

-- Если все прошло успешно - зафиксировать изменения
COMMIT;
```

### Транзакции в практическом применении

#### Пример 1: Покупка товара с уменьшением остатка

```sql
BEGIN;

-- Проверить наличие товара
DO $$
DECLARE
    доступно INTEGER;
BEGIN
    SELECT количество_на_складе INTO доступно
    FROM товары WHERE id = 1 FOR UPDATE;  -- FOR UPDATE предотвращает конкурентный доступ
    
    IF доступно < 2 THEN
        RAISE EXCEPTION 'Недостаточно товара на складе';
    END IF;
END $$;

-- Создать заказ
INSERT INTO заказы (id_клиента, общая_сумма) VALUES (1, 20000.00) RETURNING id INTO заказ_id;

-- Добавить товары в заказ
INSERT INTO заказы_товары (id_заказа, id_товара, количество, цена)
VALUES (заказ_id, 1, 2, 10000.00);

-- Уменьшить остаток на складе
UPDATE товары SET количество_на_складе = количество_на_складе - 2 WHERE id = 1;

-- Зафиксировать все изменения
COMMIT;
```

#### Пример 2: Обновление связанных данных

```sql
BEGIN;

-- Обновить клиента
UPDATE клиенты SET 
    телефон = '+7(916)123-45-67',
    дата_обновления = CURRENT_TIMESTAMP
WHERE id = 1;

-- Обновить его заказы
UPDATE заказы SET 
    комментарий = 'Обновлен контактный телефон'
WHERE id_клиента = 1 AND статус = 'новый';

-- Зафиксировать изменения
COMMIT;
```

### SAVEPOINT (контрольные точки)

SAVEPOINT позволяет установить точку внутри транзакции, к которой можно откатиться, не отменяя всю транзакцию.

```sql
BEGIN;

-- Выполнить несколько операций
INSERT INTO клиенты (фамилия, имя, email) VALUES ('Иванов', 'Иван', 'ivan@example.com');

-- Установить контрольную точку
SAVEPOINT точка_после_клиента;

BEGIN
    -- Попытка выполнить операцию, которая может вызвать ошибку
    INSERT INTO заказы (id_клиента, общая_сумма) VALUES (1, -1000.00);  -- ошибка: отрицательная сумма
EXCEPTION
    WHEN OTHERS THEN
        -- Откатиться к контрольной точке
        ROLLBACK TO точка_после_клиента;
END;

-- Продолжить выполнение транзакции
INSERT INTO заказы (id_клиента, общая_сумма) VALUES (1, 5000.00);

-- Зафиксировать изменения
COMMIT;
```

### Управление уровнями изоляции транзакций

#### Просмотр текущего уровня изоляции

```sql
SHOW TRANSACTION ISOLATION LEVEL;
```

#### Установка уровня изоляции

```sql
-- Установка уровня изоляции для текущей транзакции
BEGIN;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Ваши SQL-операции
SELECT * FROM заказы WHERE id_клиента = 1;

-- Транзакция продолжается...
COMMIT;
```

#### Уровни изоляции:

1. **READ UNCOMMITTED** - самый низкий уровень, позволяет "грязное" чтение
2. **READ COMMITTED** - уровень по умолчанию в PostgreSQL, предотвращает "грязное" чтение
3. **REPEATABLE READ** - предотвращает "неповторяющееся" чтение
4. **SERIALIZABLE** - самый высокий уровень, предотвращает все аномалии

### Явные и неявные транзакции

#### Неявные транзакции

Каждая отдельная SQL-команда автоматически оборачивается в транзакцию, если не используется явное управление транзакциями:

```sql
-- Следующие команды выполняются как отдельные транзакции
INSERT INTO клиенты (фамилия, имя) VALUES ('Петров', 'Петр');
UPDATE клиенты SET email = 'petrov@example.com' WHERE фамилия = 'Петров';
```

#### Явные транзакции

```sql
-- Явное управление транзакцией
BEGIN;
INSERT INTO клиенты (фамилия, имя) VALUES ('Сидоров', 'Андрей');
UPDATE клиенты SET email = 'sidorov@example.com' WHERE фамилия = 'Сидоров';
COMMIT;
```

### Примеры сложных транзакций

#### Пример 3: Создание заказа с проверкой ограничений

```sql
BEGIN;

-- 1. Проверить, что клиент активен
DO $$
DECLARE
    клиент_активен BOOLEAN;
BEGIN
    SELECT активен INTO клиент_активен
    FROM клиенты WHERE id = 1;
    
    IF NOT клиент_активен THEN
        RAISE EXCEPTION 'Клиент не активен, нельзя создать заказ';
    END IF;
END $$;

-- 2. Создать заказ
INSERT INTO заказы (id_клиента, общая_сумма, статус)
VALUES (1, 0, 'новый')
RETURNING id INTO заказ_id;

-- 3. Добавить позиции в заказ и проверить остатки
DO $$
DECLARE
    товар_id INTEGER := 1;
    количество INTEGER := 2;
    доступно INTEGER;
BEGIN
    -- Получить доступное количество с блокировкой
    SELECT количество_на_складе INTO доступно
    FROM товары WHERE id = товар_id FOR UPDATE;
    
    IF доступно < количество THEN
        RAISE EXCEPTION 'Недостаточно товара: запрошено %, доступно %', количество, доступно;
    END IF;
    
    -- Вставить позицию заказа
    INSERT INTO заказы_товары (id_заказа, id_товара, количество, цена)
    SELECT заказ_id, товар_id, количество, цена
    FROM товары WHERE id = товар_id;
    
    -- Обновить общую сумму заказа
    UPDATE заказы SET общая_сумма = (
        SELECT SUM(количество * цена)
        FROM заказы_товары
        WHERE id_заказа = заказ_id
    ) WHERE id = заказ_id;
    
    -- Обновить остаток
    UPDATE товары SET количество_на_складе = количество_на_складе - количество
    WHERE id = товар_id;
END $$;

COMMIT;
```

#### Пример 4: Роллбэк при ошибке

```sql
BEGIN;

-- Попытка вставить некорректные данные
INSERT INTO клиенты (фамилия, имя, email) 
VALUES ('Тест', 'Пользователь', 'test@example.com');

-- Попытка вставить заказ с отрицательной суммой (вызовет ошибку)
INSERT INTO заказы (id_клиента, общая_сумма)
VALUES (CURRVAL('клиенты_id_seq'), -100.00);  -- Это вызовет ошибку

-- Если бы мы дошли до этой строки, то:
-- COMMIT;

-- Но из-за ошибки автоматически происходит ROLLBACK
-- и никакие изменения не сохраняются
```

### Автокоммит и управление транзакциями

#### Отключение автокоммита (в некоторых клиентах)

```sql
-- В psql и большинстве клиентов автокоммит включен по умолчанию
-- Чтобы отключить автокоммит, начните транзакцию:
BEGIN;

-- Теперь все команды будут в рамках транзакции
INSERT INTO таблица VALUES (1, 'значение1');
UPDATE таблица SET поле = 'значение2' WHERE id = 1;

-- Только явный COMMIT фиксирует изменения
COMMIT;
```

### Практические советы по использованию транзакций

#### 1. Используйте транзакции для связанных операций

```sql
-- ПРАВИЛЬНО: все связанные операции в одной транзакции
BEGIN;
UPDATE счета SET баланс = баланс - сумма WHERE id = отправитель;
UPDATE счета SET баланс = баланс + сумма WHERE id = получатель;
INSERT INTO переводы (от, к, сумма) VALUES (отправитель, получатель, сумма);
COMMIT;

-- НЕПРАВИЛЬНО: операции вне транзакции
UPDATE счета SET баланс = баланс - сумма WHERE id = отправитель;
UPDATE счета SET баланс = баланс + сумма WHERE id = получатель;  -- Если тут ошибка, деньги потеряются!
```

#### 2. Держите транзакции короткими

```sql
-- ХОРОШО: короткие транзакции
BEGIN;
UPDATE заказы SET статус = 'обрабатывается' WHERE id = 1;
COMMIT;

-- ПЛОХО: длинные транзакции (могут заблокировать другие операции)
BEGIN;
-- Много операций...
-- Долгая обработка...
COMMIT;  -- транзакция держится долго
```

#### 3. Обработка ошибок

```sql
-- PostgreSQL позволяет обрабатывать ошибки внутри транзакции
DO $$
BEGIN
    BEGIN
        INSERT INTO заказы (id_клиента, общая_сумма) VALUES (1, -100.00);
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Попытка создать заказ с отрицательной суммой';
            -- Можно логировать ошибку или выполнить альтернативную логику
    END;
END $$;
```

#### 4. Использование WITH для сложных транзакций

```sql
BEGIN;

WITH новая_сумма AS (
    SELECT 
        id_заказа,
        SUM(количество * цена) AS итоговая_сумма
    FROM заказы_товары
    WHERE id_заказа = 1
    GROUP BY id_заказа
)
UPDATE заказы 
SET общая_сумма = итоговая_сумма
FROM новая_сумма
WHERE заказы.id = новая_сумма.id_заказа;

COMMIT;
```

### Уровни изоляции и их влияние

#### READ COMMITTED (по умолчанию в PostgreSQL)

```sql
-- В одном соединении:
BEGIN;
UPDATE клиенты SET скидка = 15 WHERE id = 1;
-- Не фиксируем транзакцию

-- В другом соединении:
SELECT скидка FROM клиенты WHERE id = 1;  -- Вернет старое значение, 
-- потому что первая транзакция не зафиксирована
```

#### SERIALIZABLE уровень

```sql
-- Установка уровня SERIALIZABLE
BEGIN;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Ваши операции
-- PostgreSQL может выдать ошибку "serialization failure" 
-- если обнаружит конфликт, и тогда нужно повторить транзакцию
```

### Заключение главы

Транзакции - это фундамент для обеспечения целостности данных в реляционных базах данных. Они позволяют:

1. Обеспечить атомарность операций
2. Поддерживать согласованность данных
3. Контролировать конкурентный доступ
4. Обеспечить надежность при сбоях

Правильное использование транзакций критично для надежности приложений, работающих с базами данных. Всегда оборачивайте связанные операции в транзакции, обрабатывайте ошибки и держите транзакции настолько короткими, насколько это возможно, не нарушая логику приложения.