# Полный курс SQL: От новичка до профессионала (Часть 6)

## Оглавление

### Раздел 8: Интеграция и дополнительные возможности (продолжение)
- Глава 65: Импорт и экспорт данных (продолжение)
- Глава 66: Работа с Python и PostgreSQL (начало)
- Глава 67: Безопасность и управление пользователями
- Глава 68: Производительность и оптимизация (продолжение)
- Глава 69: Практические проекты (начало)
- Глава 70: Подготовка к собеседованиям по SQL

### Раздел 9: Практические проекты и кейсы
- Глава 71: Проект 1: Анализ продаж
- Глава 72: Проект 2: Финансовый отчет
- Глава 73: Проект 3: Аналитика пользователей
- Глава 74: Проект 4: Управление инвентарем
- Глава 75: Решение реальных бизнес-задач

# Раздел 8: Интеграция и дополнительные возможности (продолжение)

## Глава 65: Импорт и экспорт данных (продолжение)

### COPY команды (подробное рассмотрение)

#### COPY FROM - детали и нюансы

Команда COPY FROM позволяет массово загружать данные из файлов в таблицы. Рассмотрим детали:

```sql
-- Полный синтаксис COPY FROM
COPY имя_таблицы [(столбец [, ...])] 
FROM {'имя_файла' | PROGRAM 'команда' | STDIN}
[WITH (option [, ...])];

-- Пример с полной спецификацией параметров
COPY клиенты (фамилия, имя, email, город)
FROM '/path/to/clients.csv'
WITH (
    FORMAT csv,
    HEADER true,
    DELIMITER ',',
    QUOTE '"',
    ESCAPE '\',
    NULL '',
    ENCODING 'UTF8'
);

-- Пример с фильтрацией данных при импорте
COPY (
    SELECT фамилия, имя, LOWER(email) as email, город
    FROM клиенты
    WHERE дата_регистрации > '2023-01-01'
) TO '/path/to/filtered_clients.csv' WITH CSV HEADER;
```

#### COPY TO - экспорт данных

```sql
-- Экспорт данных с форматированием
COPY (
    SELECT 
        id,
        фамилия,
        имя,
        email,
        город,
        дата_регистрации,
        CASE 
            WHEN (SELECT SUM(общая_сумма) FROM заказы WHERE id_клиента = клиенты.id) > 100000 THEN 'VIP'
            WHEN (SELECT COUNT(*) FROM заказы WHERE id_клиента = клиенты.id) > 5 THEN 'Постоянный'
            ELSE 'Новый'
        END AS статус
    FROM клиенты
    WHERE активен = TRUE
) TO '/tmp/активные_клиенты_детализировано.csv' 
WITH (FORMAT CSV, HEADER, DELIMITER ';', ENCODING 'WIN1251');

-- Экспорт в бинарном формате для эффективности
COPY заказы TO '/tmp/orders.backup' WITH (FORMAT BINARY);

-- Экспорт в специфичном формате для интеграции
COPY (
    SELECT 
        id || '|' || фамилия || '|' || имя || '|' || email AS строка_для_передачи
    FROM клиенты
    WHERE активен = TRUE
) TO '/tmp/clients_for_integration.txt';
```

### Использование COPY в практике

#### Пример 1: Ежедневный экспорт отчетов

```sql
-- Создание ежедневного отчета о продажах
COPY (
    SELECT 
        дата_заказа,
        COUNT(*) AS количество_заказов,
        SUM(общая_сумма) AS общая_сумма,
        AVG(общая_сумма) AS средний_чек,
        (SELECT COUNT(DISTINCT id_клиента) FROM заказы WHERE дата_заказа = CURRENT_DATE) AS уникальных_клиентов
    FROM заказы
    WHERE дата_заказа = CURRENT_DATE
    GROUP BY дата_заказа
) TO '/reports/daily_sales_report_' || CURRENT_DATE || '.csv' 
WITH (FORMAT CSV, HEADER);

-- Более подробный отчет с детализацией по категориям
COPY (
    SELECT 
        t.категория,
        COUNT(z.id) AS заказов_в_категории,
        SUM(z.общая_сумма) AS выручка_по_категории,
        AVG(z.общая_сумма) AS средний_чек
    FROM заказы z
    JOIN заказы_товары zt ON z.id = zt.id_заказа
    JOIN товары t ON zt.id_товара = t.id
    WHERE z.дата_заказа = CURRENT_DATE
    GROUP BY t.категория
    ORDER BY выручка_по_категории DESC
) TO '/reports/daily_categories_report_' || CURRENT_DATE || '.csv' 
WITH (FORMAT CSV, HEADER);
```

#### Пример 2: Миграция данных между таблицами

```sql
-- Миграция данных с очисткой и преобразованием
COPY (
    SELECT 
        id,
        TRIM(UPPER(фамилия)) AS фамилия,
        TRIM(UPPER(имя)) AS имя,
        TRIM(LOWER(email)) AS email,
        CASE 
            WHEN LENGTH(телефон) = 10 THEN '+7' || телефон
            WHEN LEFT(телефон, 1) = '8' THEN '+7' || SUBSTRING(телефон, 2)
            WHEN LEFT(телефон, 2) = '+7' THEN телефон
            ELSE NULL
        END AS телефон,
        CASE 
            WHEN LOWER(город) LIKE 'москва' THEN 'Москва'
            WHEN LOWER(город) LIKE 'санкт%' OR LOWER(город) LIKE 'спб%' THEN 'Санкт-Петербург'
            WHEN LOWER(город) LIKE 'новосибирск' THEN 'Новосибирск'
            ELSE INITCAP(LOWER(город))
        END AS город,
        дата_регистрации
    FROM клиенты_сырые
    WHERE email IS NOT NULL AND email != ''
) TO '/data/processed_customers.csv' WITH (FORMAT CSV, HEADER);
```

### Альтернативы COPY

#### Использование psql команд

```bash
# Команды для использования в psql или скриптах
# \copy - позволяет использовать команду COPY из psql
# \copy таблица TO 'файл.csv' WITH CSV HEADER
# \copy таблица FROM 'файл.csv' WITH CSV HEADER

-- Внутри psql:
-- \copy (SELECT * FROM клиенты WHERE активен = TRUE) TO '/tmp/active_clients.csv' WITH CSV HEADER
-- \copy заказы FROM '/tmp/new_orders.csv' WITH CSV HEADER
```

#### Использование внешних инструментов

```sql
-- Пример использования COPY через внешние скрипты
-- Это может быть реализовано в Python, Perl или других языках:
-- conn.cursor().execute("COPY таблица TO STDOUT WITH CSV HEADER")
-- И чтение результата в приложении
```

### Обработка ошибок при импорте/экспорте

#### Проверка целостности данных

```sql
-- Проверка, что импорт прошел успешно
DO $$
DECLARE
    до_импорта INTEGER;
    после_импорта INTEGER;
BEGIN
    SELECT COUNT(*) INTO до_импорта FROM клиенты;
    
    -- Выполняем импорт
    COPY клиенты FROM '/tmp/new_clients.csv' WITH CSV HEADER;
    
    SELECT COUNT(*) INTO после_импорта FROM клиенты;
    
    RAISE NOTICE 'Добавлено клиентов: %', после_импорта - до_импорта;
    
    -- Проверка на дубликаты
    IF EXISTS (
        SELECT 1 FROM (
            SELECT email, COUNT(*) as cnt 
            FROM клиенты 
            GROUP BY email 
            HAVING COUNT(*) > 1
        ) AS duplicates
    ) THEN
        RAISE WARNING 'Обнаружены дубликаты email!';
    END IF;
END $$;
```

#### Обработка некорректных данных

```sql
-- Создание таблицы для логирования ошибок импорта
CREATE TABLE лог_ошибок_импорта (
    id SERIAL PRIMARY KEY,
    время_ошибки TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    тип_ошибки VARCHAR(100),
    описание_ошибки TEXT,
    строка_данных TEXT
);

-- Использование временной таблицы для безопасного импорта
CREATE TEMP TABLE клиенты_temp (LIKE клиенты);

-- Попытка импорта в промежуточную таблицу
COPY клиенты_temp FROM '/tmp/clients_raw.csv' WITH CSV HEADER;

-- Проверка и фильтрация данных
INSERT INTO клиенты (фамилия, имя, email, город)
SELECT 
    CASE WHEN фамилия ~ '^[A-ZА-ЯЁ]' THEN INITCAP(LOWER(фамилия)) ELSE NULL END,
    CASE WHEN имя ~ '^[A-ZА-ЯЁ]' THEN INITCAP(LOWER(имя)) ELSE NULL END,
    CASE WHEN email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN LOWER(email) ELSE NULL END,
    INITCAP(LOWER(город))
FROM клиенты_temp
WHERE 
    фамилия IS NOT NULL AND фамилия != ''
    AND имя IS NOT NULL AND имя != ''
    AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    AND LENGTH(фамилия) <= 50
    AND LENGTH(имя) <= 50;

-- Логирование проблемных строк
INSERT INTO лог_ошибок_импорта (тип_ошибки, описание_ошибки, строка_данных)
SELECT 
    'Некорректный формат данных',
    'Email не соответствует формату или обязательные поля пусты',
    фамилия || ',' || имя || ',' || email || ',' || COALESCE(город, '')
FROM клиенты_temp
WHERE NOT (
    фамилия IS NOT NULL AND фамилия != ''
    AND имя IS NOT NULL AND имя != ''
    AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    AND LENGTH(фамилия) <= 50
    AND LENGTH(имя) <= 50
);
```

### Практические сценарии

#### Пакетный импорт с валидацией

```sql
-- Процедура для пакетного импорта данных с валидацией
CREATE OR REPLACE FUNCTION импорт_данных_с_валидацией(
    путь_к_файлу TEXT
) RETURNS TABLE(
    успех BOOLEAN,
    сообщение TEXT,
    добавлено_записей INTEGER
) AS $$
DECLARE
    временная_таблица TEXT := 'импорт_временная_' || (EXTRACT(EPOCH FROM NOW())::INTEGER % 10000);
    до_записей INTEGER;
    после_записей INTEGER;
BEGIN
    -- Создаем временную таблицу
    EXECUTE 'CREATE TEMP TABLE ' || временная_таблица || ' (
        фамилия VARCHAR(50),
        имя VARCHAR(50),
        email VARCHAR(100),
        город VARCHAR(50),
        дата_регистрации DATE
    )';
    
    -- Импортируем данные
    BEGIN
        EXECUTE 'COPY ' || временная_таблица || ' FROM ''' || путь_к_файлу || ''' WITH CSV HEADER';
    EXCEPTION
        WHEN OTHERS THEN
            RETURN QUERY SELECT FALSE, 'Ошибка импорта файла: ' || SQLERRM, 0;
            RETURN;
    END;
    
    -- Проверяем количество записей до
    SELECT COUNT(*) INTO до_записей FROM клиенты;
    
    -- Вставляем валидные данные в основную таблицу
    EXECUTE '
    INSERT INTO клиенты (фамилия, имя, email, город, дата_регистрации, активен)
    SELECT 
        INITCAP(LOWER(фамилия)),
        INITCAP(LOWER(имя)),
        LOWER(email),
        INITCAP(LOWER(город)),
        COALESCE(дата_регистрации, CURRENT_DATE),
        TRUE
    FROM ' || временная_таблица || '
    WHERE 
        фамилия IS NOT NULL AND TRIM(фамилия) != ''''
        AND имя IS NOT NULL AND TRIM(имя) != ''''
        AND email ~* ''^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$''
    ON CONFLICT (email) DO NOTHING';
    
    -- Проверяем количество записей после
    SELECT COUNT(*) INTO после_записей FROM клиенты;
    
    -- Удаляем временную таблицу
    EXECUTE 'DROP TABLE ' || временная_таблица;
    
    RETURN QUERY SELECT 
        TRUE as успех,
        'Успешно импортировано ' || (после_записей - до_записей) || ' записей' as сообщение,
        (после_записей - до_записей) as добавлено_записей;
        
END;
$$ LANGUAGE plpgsql;

-- Использование процедуры
SELECT * FROM импорт_данных_с_валидацией('/tmp/clients_new.csv');
```

#### Экспорт в различных форматах

```sql
-- Экспорт для интеграции с другими системами (JSON)
COPY (
    SELECT 
        JSON_BUILD_OBJECT(
            'id', id,
            'fullName', CONCAT(фамилия, ' ', имя),
            'email', email,
            'city', город,
            'registrationDate', дата_регистрации,
            'isActive', активен,
            'totalOrders', (SELECT COUNT(*) FROM заказы WHERE id_клиента = клиенты.id),
            'totalAmount', (SELECT COALESCE(SUM(общая_сумма), 0) FROM заказы WHERE id_клиента = клиенты.id)
        ) AS json_record
    FROM клиенты
    WHERE активен = TRUE
) TO '/exports/clients_api_format.json';
```

---

## Глава 66: Работа с Python и PostgreSQL

### Введение

Python часто используется для автоматизации задач работы с базами данных, анализа данных и интеграции систем. PostgreSQL отлично интегрируется с Python через различные библиотеки, позволяя разработчикам эффективно работать с данными. В этой главе мы рассмотрим основы работы с PostgreSQL из Python, включая подключение, выполнение запросов, обработку результатов и лучшие практики.

### Установка и настройка

#### Основные библиотеки

Самые популярные библиотеки для работы с PostgreSQL в Python:

1. `psycopg2` - классическая библиотека для PostgreSQL
2. `SQLAlchemy` - ORM и инструменты работы с БД
3. `asyncpg` - асинхронная библиотека для PostgreSQL

```python
# Установка основных библиотек
# pip install psycopg2-binary sqlalchemy pandas

import psycopg2
from psycopg2.extras import RealDictCursor
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
import pandas as pd
```

### Подключение к базе данных

#### Базовое подключение с psycopg2

```python
import psycopg2
from psycopg2.extras import RealDictCursor

def создать_соединение():
    """Создание соединения с базой данных"""
    try:
        connection = psycopg2.connect(
            host="localhost",
            database="ваша_база",
            user="ваш_пользователь",
            password="ваш_пароль",
            port="5432"
        )
        return connection
    except psycopg2.Error as e:
        print(f"Ошибка подключения к PostgreSQL: {e}")
        return None

def выполнить_запрос(запрос, параметры=None):
    """Выполнение SQL запроса"""
    connection = создать_соединение()
    if connection is None:
        return None
        
    try:
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        cursor.execute(запрос, параметры)
        результат = cursor.fetchall()
        connection.commit()
        return результат
    except psycopg2.Error as e:
        print(f"Ошибка выполнения запроса: {e}")
        connection.rollback()
        return None
    finally:
        if connection:
            cursor.close()
            connection.close()
```

#### Подключение с использованием контекстных менеджеров

```python
from contextlib import contextmanager

@contextmanager
def получить_соединение():
    """Контекстный менеджер для соединения"""
    connection = None
    try:
        connection = psycopg2.connect(
            host="localhost",
            database="курс_sql",
            user="postgres",  # замените на вашего пользователя
            password="ваш_пароль",
            port="5432"
        )
        yield connection
    except psycopg2.Error as e:
        if connection:
            connection.rollback()
        raise e
    finally:
        if connection:
            connection.close()

# Пример использования
def получить_активных_клиентов():
    """Получить список активных клиентов"""
    with получить_соединение() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT id, фамилия, имя, email, город
                FROM клиенты
                WHERE активен = TRUE
                ORDER BY фамилия
            """)
            результат = cursor.fetchall()
            return результат
```

### Выполнение различных типов запросов

#### SELECT запросы

```python
def получить_отчет_по_городам():
    """Получить отчет по количеству клиентов по городам"""
    with получить_соединение() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            query = """
                SELECT 
                    город,
                    COUNT(*) AS количество_клиентов,
                    COUNT(CASE WHEN (SELECT COUNT(*) FROM заказы WHERE id_клиента = клиенты.id) > 0 THEN 1 END) AS клиенты_с_заказами
                FROM клиенты
                GROUP BY город
                ORDER BY количество_клиентов DESC
            """
            cursor.execute(query)
            результат = cursor.fetchall()
            return результат

# Использование результата
результаты = получить_отчет_по_городам()
for строка in результаты[:5]:  # первые 5 результатов
    print(f"Город: {строка['город']}, Клиентов: {строка['количество_клиентов']}")
```

#### INSERT запросы

```python
def добавить_клиента(фамилия, имя, email, город):
    """Добавить нового клиента"""
    with получить_соединение() as conn:
        with conn.cursor() as cursor:
            query = """
                INSERT INTO клиенты (фамилия, имя, email, город, дата_регистрации, активен)
                VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, TRUE)
                RETURNING id
            """
            cursor.execute(query, (фамилия, имя, email, город))
            новый_id = cursor.fetchone()[0]
            conn.commit()
            return новый_id

# Пример использования
новый_клиент_id = добавить_клиента("Иванов", "Петр", "petr.ivanov@example.com", "Москва")
print(f"Добавлен клиент с ID: {новый_клиент_id}")
```

#### UPDATE запросы

```python
def обновить_информацию_клиента(client_id, **обновления):
    """Обновить информацию о клиенте"""
    допустимые_поля = {'фамилия', 'имя', 'email', 'город'}
    обновляемые_поля = {k: v for k, v in обновления.items() if k in допустимые_поля}
    
    if not обновляемые_поля:
        print("Нет полей для обновления")
        return False
        
    set_clause = ", ".join([f"{key} = %s" for key in обновляемые_поля.keys()])
    values = list(обновляемые_поля.values()) + [client_id]
    
    query = f"UPDATE клиенты SET {set_clause} WHERE id = %s"
    
    with получить_соединение() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, values)
            conn.commit()
            
            if cursor.rowcount > 0:
                print(f"Обновлен клиент с ID: {client_id}")
                return True
            else:
                print(f"Клиент с ID: {client_id} не найден")
                return False

# Пример использования
успех = обновить_информацию_клиента(
    1, 
    email="новый.email@example.com", 
    город="Санкт-Петербург"
)
```

#### DELETE запросы

```python
def удалить_клиента(client_id):
    """Удалить клиента (деактивировать, а не физически)"""
    with получить_соединение() as conn:
        with conn.cursor() as cursor:
            # Сначала проверим, есть ли у клиента заказы
            cursor.execute("SELECT COUNT(*) FROM заказы WHERE id_клиента = %s", (client_id,))
            количество_заказов = cursor.fetchone()[0]
            
            if количество_заказов > 0:
                # Деактивировать клиента
                cursor.execute("UPDATE клиенты SET активен = FALSE WHERE id = %s", (client_id,))
                print(f"Клиент с ID {client_id} деактивирован (имеет заказы)")
            else:
                # Физически удалить клиента
                cursor.execute("DELETE FROM клиенты WHERE id = %s", (client_id,))
                print(f"Клиент с ID {client_id} удален")
            
            conn.commit()
            return True

# Пример использования
удалить_клиента(999)  # замените на реальный ID
```

### Работа с пандой (pandas)

```python
import pandas as pd

def загрузить_данные_в_pandas():
    """Загрузка данных в DataFrame"""
    with получить_соединение() as conn:
        query = """
            SELECT 
                к.id,
                к.фамилия,
                к.имя,
                к.город,
                COUNT(з.id) AS количество_заказов,
                COALESCE(SUM(з.общая_сумма), 0) AS общая_сумма
            FROM клиенты к
            LEFT JOIN заказы з ON к.id = з.id_клиента
            GROUP BY к.id, к.фамилия, к.имя, к.город
            ORDER BY общая_сумма DESC
        """
        df = pd.read_sql_query(query, conn)
        return df

# Использование
df = загрузить_данные_в_pandas()
print(df.head())
print(f"Всего клиентов: {len(df)}")

# Анализ данных
top_customers = df.nlargest(10, 'общая_сумма')
print("\nТоп-10 клиентов по общей сумме заказов:")
print(top_customers[['фамилия', 'имя', 'город', 'общая_сумма']])
```

### Пакетная обработка данных

#### Массовая вставка данных

```python
def массовая_вставка_клиентов(список_клиентов):
    """Массовая вставка клиентов"""
    with получить_соединение() as conn:
        with conn.cursor() as cursor:
            query = """
                INSERT INTO клиенты (фамилия, имя, email, город, дата_регистрации, активен)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            # Подготовка данных
            данные = [
                (c['фамилия'], c['имя'], c['email'], c['город'], c.get('дата_регистрации', 'NOW()'), c.get('активен', True))
                for c in список_клиентов
            ]
            
            # Использование executemany для эффективной вставки
            cursor.executemany(query, данные)
            conn.commit()
            
            print(f"Вставлено {cursor.rowcount} клиентов")
            return cursor.rowcount

# Пример использования
новые_клиенты = [
    {"фамилия": "Петров", "имя": "Алексей", "email": "alex.petrov@example.com", "город": "СПб"},
    {"фамилия": "Сидорова", "имя": "Мария", "email": "maria.sidorova@example.com", "город": "Новосибирск"},
    {"фамилия": "Козлов", "имя": "Дмитрий", "email": "dmitry.kozlov@example.com", "город": "Екатеринбург"}
]

массовая_вставка_клиентов(новые_клиенты)
```

#### Чтение больших объемов данных по частям

```python
def читать_данные_порционно(размер_порции=1000):
    """Чтение данных порционно для обработки больших объемов"""
    offset = 0
    while True:
        with получить_соединение() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                query = """
                    SELECT id, фамилия, имя, email, город
                    FROM клиенты
                    ORDER BY id
                    LIMIT %s OFFSET %s
                """
                cursor.execute(query, (размер_порции, offset))
                результат = cursor.fetchall()
                
                if not результат:
                    break
                    
                # Обработка порции данных
                yield результат
                offset += размер_порции
                print(f"Обработано {offset} записей...")

# Использование
for порция in читать_данные_порционно(500):
    print(f"Обработка порции из {len(порция)} записей")
    # Делаем что-то с порцией данных
    for клиент in порция:
        # Обработка отдельного клиента
        pass
```

### Создание аналитических отчетов

```python
def создать_ежедневный_отчет():
    """Создание ежедневного аналитического отчета"""
    with получить_соединение() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            # Основной отчет по продажам
            query = """
                WITH daily_stats AS (
                    SELECT 
                        CURRENT_DATE AS отчетная_дата,
                        COUNT(*) AS всего_заказов,
                        SUM(общая_сумма) AS общая_выручка,
                        AVG(общая_сумма) AS средний_чек,
                        COUNT(DISTINCT id_клиента) AS уникальных_клиентов
                    FROM заказы
                    WHERE дата_заказа = CURRENT_DATE
                ),
                top_categories AS (
                    SELECT 
                        т.категория,
                        COUNT(*) AS заказов,
                        SUM(з.общая_сумма) AS выручка
                    FROM заказы з
                    JOIN заказы_товары zt ON з.id = zt.id_заказа
                    JOIN товары т ON zt.id_товара = т.id
                    WHERE з.дата_заказа = CURRENT_DATE
                    GROUP BY т.категория
                    ORDER BY выручка DESC
                    LIMIT 5
                )
                SELECT ds.*, tc.*
                FROM daily_stats ds
                CROSS JOIN top_categories tc
            """
            cursor.execute(query)
            результат = cursor.fetchall()
            
            # Сохранение в файл
            import json
            from datetime import datetime
            
            отчет = {
                "дата_формирования": str(datetime.now()),
                "отчетная_дата": str(результат[0]['отчетная_дата']) if результат else str(datetime.now().date()),
                "основные_показатели": {
                    "всего_заказов": результат[0]['всего_заказов'] if результат else 0,
                    "общая_выручка": float(результат[0]['общая_выручка']) if результат and результат[0]['общая_выручка'] else 0.0,
                    "средний_чек": float(результат[0]['средний_чек']) if результат and результат[0]['средний_чек'] else 0.0,
                    "уникальных_клиентов": результат[0]['уникальных_клиентов'] if результат else 0
                },
                "топ_категории": [
                    {
                        "категория": row['категория'],
                        "заказов": row['заказов'],
                        "выручка": float(row['выручка'])
                    }
                    for row in результат
                ] if результат else []
            }
            
            # Сохранение отчета
            with open(f'/reports/daily_report_{datetime.now().strftime("%Y%m%d")}.json', 'w', encoding='utf-8') as f:
                json.dump(отчет, f, ensure_ascii=False, indent=2, default=str)
            
            return отчет

# Пример использования
ежедневный_отчет = создать_ежедневный_отчет()
print(f"Отчет за {ежедневный_отчет['отчетная_дата']}")
print(f"Выручка: {ежедневный_отчет['основные_показатели']['общая_выручка']}")
```

### Использование SQLAlchemy

#### Базовая настройка

```python
from sqlalchemy import create_engine, Column, Integer, String, Numeric, Date, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

Base = declarative_base()

class Клиент(Base):
    __tablename__ = 'клиенты'
    
    id = Column(Integer, primary_key=True)
    фамилия = Column(String(50), nullable=False)
    имя = Column(String(50), nullable=False)
    email = Column(String(100), unique=True)
    город = Column(String(50))
    дата_регистрации = Column(Date)
    активен = Column(Boolean, default=True)
    
    # Связь с заказами
    заказы = relationship("Заказ", back_populates="клиент")

class Заказ(Base):
    __tablename__ = 'заказы'
    
    id = Column(Integer, primary_key=True)
    id_клиента = Column(Integer, ForeignKey('клиенты.id'))
    дата_заказа = Column(Date)
    общая_сумма = Column(Numeric(12, 2))
    статус = Column(String(20), default='новый')
    
    # Связь с клиентом
    клиент = relationship("Клиент", back_populates="заказы")

# Создание движка
engine = create_engine('postgresql://username:password@localhost/название_базы')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def получить_сессию():
    """Получить сессию SQLAlchemy"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Пример использования SQLAlchemy
def работа_с_sqlalchemy():
    """Пример работы с SQLAlchemy"""
    db = SessionLocal()
    try:
        # Получение клиентов
        клиенты = db.query(Клиент).filter(Клиент.активен == True).all()
        
        # Создание нового клиента
        новый_клиент = Клиент(
            фамилия="Новый",
            имя="Клиент",
            email="new.client@example.com",
            город="Москва",
            дата_регистрации=datetime.now().date()
        )
        db.add(новый_клиент)
        db.commit()
        db.refresh(новый_клиент)
        
        print(f"Создан клиент: {новый_клиент.фамилия} {новый_клиент.имя}")
        
        # Создание заказа для клиента
        заказ = Заказ(
            id_клиента=новый_клиент.id,
            дата_заказа=datetime.now().date(),
            общая_сумма=15000.00,
            статус="новый"
        )
        db.add(заказ)
        db.commit()
        
    finally:
        db.close()
```

### Обработка ошибок и логирование

```python
import logging
from functools import wraps

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/logs/db_operations.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def handle_db_errors(func):
    """Декоратор для обработки ошибок БД"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except psycopg2.IntegrityError as e:
            logger.error(f"Ограничение целостности: {e}")
            raise
        except psycopg2.DataError as e:
            logger.error(f"Ошибка данных: {e}")
            raise
        except psycopg2.OperationalError as e:
            logger.error(f"Операционная ошибка: {e}")
            raise
        except Exception as e:
            logger.error(f"Неизвестная ошибка: {e}")
            raise
    return wrapper

@handle_db_errors
def безопасная_вставка_данных(данные):
    """Безопасная вставка данных с обработкой ошибок"""
    # Реализация функции
    pass
```

### Практические примеры интеграции

#### Импорт данных из CSV файла

```python
import csv

def импорт_из_csv(путь_к_файлу):
    """Импорт клиентов из CSV файла"""
    with open(путь_к_файлу, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        
        клиенты_для_вставки = []
        for row in reader:
            клиент = {
                'фамилия': row.get('фамилия', '').strip().title(),
                'имя': row.get('имя', '').strip().title(),
                'email': row.get('email', '').strip().lower(),
                'город': row.get('город', '').strip().title()
            }
            
            # Валидация данных
            if клиент['email'] and '@' in клиент['email']:
                клиенты_для_вставки.append(клиент)
    
    # Вставка в БД
    with получить_соединение() as conn:
        with conn.cursor() as cursor:
            query = """
                INSERT INTO клиенты (фамилия, имя, email, город, дата_регистрации, активен)
                VALUES (%(фамилия)s, %(имя)s, %(email)s, %(город)s, CURRENT_TIMESTAMP, TRUE)
                ON CONFLICT (email) DO UPDATE SET
                    фамилия = EXCLUDED.фамилия,
                    имя = EXCLUDED.имя,
                    город = EXCLUDED.город
            """
            
            cursor.executemany(query, клиенты_для_вставки)
            conn.commit()
            
            logger.info(f"Импортировано {len(клиенты_для_вставки)} клиентов из {путь_к_файлу}")
```

#### Создание автоматической задачи

```python
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime

def создать_ежедневный_отчет_автоматически():
    """Автоматическое создание ежедневного отчета"""
    try:
        отчет = создать_ежедневный_отчет()
        logger.info(f"Ежедневный отчет создан: {отчет['отчетная_дата']}")
    except Exception as e:
        logger.error(f"Ошибка при создании ежедневного отчета: {e}")

# Настройка планировщика
scheduler = BackgroundScheduler()
scheduler.add_job(
    func=создать_ежедневный_отчет_автоматически,
    trigger="cron",
    hour=23,
    minute=59,
    id='daily_report_job',
    name='Ежедневный отчет продаж'
)

# Запуск планировщика
# scheduler.start()
```

### Заключение главы

Интеграция Python с PostgreSQL открывает широкие возможности для автоматизации, анализа данных и создания сложных приложений. Использование контекстных менеджеров, корректная обработка ошибок, эффективная работа с большими объемами данных и применение современных библиотек позволяют создавать надежные и эффективные решения для работы с базами данных.

---

## Глава 67: Безопасность и управление пользователями

### Введение

Безопасность базы данных - критически важный аспект управления данными. Правильная настройка пользователей, их привилегий и прав доступа защищает данные от несанкционированного доступа и обеспечивает целостность информации. PostgreSQL предоставляет мощные средства для управления безопасностью, включая систему ролей, разграничение прав доступа и аудит.

### Архитектура безопасности PostgreSQL

PostgreSQL использует систему ролей (roles) вместо пользователей и групп. Роль может быть как пользователем ( LOGIN ), так и группой (без LOGIN), и может обладать различными привилегиями.

#### Основные понятия

1. **Роли (Roles)** - основная единица управления доступом
2. **Пользователи** - роли с атрибутом LOGIN
3. **Группы** - роли без атрибута LOGIN, используемые для управления правами
4. **Привилегии** - разрешения на выполнение операций (SELECT, INSERT, UPDATE, DELETE и т.д.)
5. **ACL (Access Control Lists)** - списки контроля доступа

### Создание и управление ролями

#### Создание пользователей

```sql
-- Создание обычного пользователя
CREATE ROLE аналитик LOGIN PASSWORD 'secure_password_123';

-- Создание пользователя с дополнительными атрибутами
CREATE ROLE разработчик LOGIN
    PASSWORD 'dev_password_456'
    VALID UNTIL '2024-12-31'  -- срок действия
    CONNECTION LIMIT 5;       -- ограничение соединений

-- Создание суперпользователя (осторожно!)
CREATE ROLE администратор LOGIN
    PASSWORD 'super_secure_password'
    SUPERUSER;

-- Создание пользователя с правом создания баз данных
CREATE ROLE db_creator LOGIN
    PASSWORD 'db_creation_password'
    CREATEDB;

-- Создание пользователя с правом создания других ролей
CREATE ROLE role_manager LOGIN
    PASSWORD 'role_management_password'
    CREATEROLE;
```

#### Управление атрибутами ролей

```sql
-- Изменение пароля
ALTER ROLE аналитик PASSWORD 'new_secure_password_456';

-- Изменение срока действия
ALTER ROLE разработчик VALID UNTIL '2025-12-31';

-- Проверка атрибутов роли
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolcanlogin, rolconnlimit, rolvaliduntil
FROM pg_roles
WHERE rolname = 'аналитик';
```

### Управление группами и членством

#### Создание групп

```sql
-- Создание группы
CREATE ROLE группа_аналитики;

-- Добавление пользователя в группу
GRANT группа_аналитики TO аналитик;

-- Добавление нескольких пользователей в группу
GRANT группа_аналитики TO аналитик, мл_аналитик, стажер;
```

#### Управление членством

```sql
-- Проверка членства
SELECT 
    role.rolname AS роль,
    member.rolname AS участник
FROM pg_auth_members m
JOIN pg_roles role ON m.roleid = role.oid
JOIN pg_roles member ON m.member = member.oid
WHERE role.rolname = 'группа_аналитики';

-- Удаление из группы
REVOKE группа_аналитики FROM стажер;
```

### Привилегии и разграничение доступа

#### Основные типы привилегий

1. **SELECT** - просмотр данных
2. **INSERT** - вставка данных
3. **UPDATE** - обновление данных
4. **DELETE** - удаление данных
5. **TRUNCATE** - очистка таблицы
6. **REFERENCES** - создание внешних ключей
7. **TRIGGER** - создание триггеров

#### Назначение привилегий на таблицы

```sql
-- Предоставление SELECT права на таблицу
GRANT SELECT ON клиенты TO аналитик;

-- Предоставление нескольких прав
GRANT SELECT, INSERT, UPDATE ON клиенты TO разработчик;

-- Предоставление всех прав
GRANT ALL PRIVILEGES ON клиенты TO администратор;

-- Предоставление права на все существующие и будущие таблицы в схеме
GRANT SELECT ON ALL TABLES IN SCHEMA public TO аналитик;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO аналитик;

-- Отзыв прав
REVOKE INSERT, UPDATE ON клиенты FROM разработчик;
REVOKE ALL PRIVILEGES ON клиенты FROM аналитик;
```

#### Привилегии на схемы

```sql
-- Создание схемы для отдела
CREATE SCHEMA отдел_продаж;

-- Предоставление прав на схему
GRANT USAGE ON SCHEMA отдел_продаж TO группа_менеджеров;

-- Предоставление прав на создание объектов в схеме
GRANT CREATE ON SCHEMA отдел_продаж TO менеджер;

-- Передача владельца таблицы
ALTER TABLE заказы OWNER TO отдел_продаж;
```

#### Привилегии на столбцы

```sql
-- Предоставление доступа только к определенным столбцам
-- Это можно сделать через представления
CREATE VIEW клиенты_публичные AS
SELECT id, фамилия, имя, город
FROM клиенты;

GRANT SELECT ON клиенты_публичные TO аналитик;
```

### Практические примеры настройки безопасности

#### Пример 1: Настройка ролей для веб-приложения

```sql
-- Создание роли для веб-приложения
CREATE ROLE веб_приложение LOGIN PASSWORD 'app_password_789';

-- Создание роли для чтения данных
CREATE ROLE чтение_данных;

-- Создание роли для записи данных
CREATE ROLE запись_данных;

-- Назначение прав роли чтения
GRANT CONNECT ON DATABASE курс_sql TO чтение_данных;
GRANT USAGE ON SCHEMA public TO чтение_данных;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO чтение_данных;

-- Назначение прав роли записи
GRANT CONNECT ON DATABASE курс_sql TO запись_данных;
GRANT USAGE ON SCHEMA public TO запись_данных;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO запись_данных;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO запись_данных;

-- Добавление веб-приложения в роли
GRANT чтение_данных TO веб_приложение;
-- GRANT запись_данных TO веб_приложение; -- только при необходимости записи
```

#### Пример 2: Настройка безопасности для разных отделов

```sql
-- Создание отделов
CREATE ROLE отдел_продаж;
CREATE ROLE отдел_маркетинга;
CREATE ROLE отдел_финансов;

-- Создание пользователей
CREATE ROLE менеджер_продаж LOGIN PASSWORD 'sales_pass';
CREATE ROLE маркетолог LOGIN PASSWORD 'marketing_pass';
CREATE ROLE бухгалтер LOGIN PASSWORD 'finance_pass';

-- Добавление пользователей в группы
GRANT отдел_продаж TO менеджер_продаж;
GRANT отдел_маркетинга TO маркетолог;
GRANT отдел_финансов TO бухгалтер;

-- Настройка прав для отдела продаж
GRANT USAGE ON SCHEMA public TO отдел_продаж;
GRANT SELECT, INSERT, UPDATE ON клиенты TO отдел_продаж;
GRANT SELECT, INSERT, UPDATE ON заказы TO отдел_продаж;
GRANT SELECT ON товары TO отдел_продаж;

-- Настройка прав для отдела маркетинга
GRANT USAGE ON SCHEMA public TO отдел_маркетинга;
GRANT SELECT ON клиенты TO отдел_маркетинга;
GRANT SELECT ON заказы TO отдел_маркетинга;
GRANT SELECT ON товары TO отдел_маркетинга;
-- Ограниченный доступ к чувствительным данным
CREATE VIEW клиенты_маркетинг AS
SELECT id, фамилия, имя, город, дата_регистрации
FROM клиенты;
GRANT SELECT ON клиенты_маркетинг TO отдел_маркетинга;

-- Настройка прав для отдела финансов
GRANT USAGE ON SCHEMA public TO отдел_финансов;
GRANT SELECT ON заказы TO отдел_финансов;
GRANT SELECT ON клиенты TO отдел_финансов;
-- Полный доступ к финансовой информации
```

### Виды привилегий для разных объектов

#### Привилегии на последовательности

```sql
-- Предоставление прав на последовательность
GRANT USAGE, SELECT ON SEQUENCE клиенты_id_seq TO разработчик;

-- Предоставление всех прав
GRANT ALL PRIVILEGES ON SEQUENCE клиенты_id_seq TO администратор;
```

#### Привилегии на функции

```sql
-- Предоставление права выполнения функции
GRANT EXECUTE ON FUNCTION подсчет_клиентов_по_городу(varchar) TO аналитик;

-- Предоставление права выполнения всех функций в схеме
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO отдел_аналитики;
```

#### Привилегии на представления

```sql
-- Создание защищенного представления
CREATE VIEW заказы_аналитика AS
SELECT 
    з.id,
    к.фамилия,
    к.имя,
    к.город,
    з.дата_заказа,
    з.общая_сумма,
    з.статус
FROM заказы з
JOIN клиенты к ON з.id_клиента = к.id
WHERE к.активен = TRUE;

-- Предоставление доступа к представлению
GRANT SELECT ON заказы_аналитика TO аналитик;
```

### Безопасность на уровне строк (RLS)

Row Level Security (RLS) позволяет контролировать доступ к отдельным строкам таблицы.

```sql
-- Включение RLS для таблицы
ALTER TABLE клиенты ENABLE ROW LEVEL SECURITY;

-- Создание политики для аналитиков - только их регион
CREATE POLICY policy_аналитик_регионы ON клиенты
FOR SELECT
TO аналитик
USING (город = (
    SELECT регион FROM пользователи_настройки 
    WHERE пользователь = CURRENT_USER
));

-- Создание политики для обычного доступа
CREATE POLICY policy_обычный_доступ ON клиенты
FOR ALL
TO PUBLIC
USING (активен = TRUE);

-- Создание таблицы настроек пользователей (для примера)
CREATE TABLE пользователи_настройки (
    пользователь NAME PRIMARY KEY,
    регион VARCHAR(50),
    дата_создания TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Аудит и мониторинг

#### Настройка логирования

```sql
-- Эти параметры обычно устанавливаются в postgresql.conf
-- log_statement = 'mod'  -- логировать DDL и DML
-- log_min_duration_statement = 1000  -- логировать запросы дольше 1 секунды
```

#### Проверка текущих подключений и активности

```sql
-- Просмотр активных соединений
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    client_hostname,
    client_port,
    backend_start,
    state,
    query
FROM pg_stat_activity
WHERE datname = 'курс_sql';

-- Просмотр активности по ролям
SELECT 
    rolname,
    count(*) as active_connections
FROM pg_stat_activity
GROUP BY rolname;
```

### Шифрование и аутентификация

#### Проверка метода аутентификации

```sql
-- Проверка конфигурации pg_hba.conf через системные представления
SELECT * FROM pg_hba_file_rules;
```

#### Работа с SSL

```sql
-- Проверка SSL подключений
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    ssl,
    client_cert_present,
    client_dn,
    client_serial
FROM pg_stat_ssl s
JOIN pg_stat_activity a ON s.pid = a.pid;
```

### Практические советы по безопасности

#### 1. Принцип наименьших привилегий

```sql
-- ПЛОХО: предоставление всех прав всем
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO PUBLIC;

-- ХОРОШО: предоставление минимально необходимых прав
GRANT SELECT ON клиенты TO аналитик;
GRANT SELECT, INSERT ON заказы TO кассир;
```

#### 2. Использование надежных паролей

```sql
-- Установка сложных паролей
ALTER ROLE критичный_пользователь PASSWORD 'VeryComplexPassword123!';
-- Или использование внешних средств аутентификации
```

#### 3. Регулярный аудит прав доступа

```sql
-- Скрипт для аудита привилегий (выполняется периодически)
SELECT 
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
ORDER BY grantee, table_name, privilege_type;
```

#### 4. Использование ролей вместо прямого назначения прав

```sql
-- ПЛОХО: прямое назначение прав пользователям
-- GRANT SELECT ON клиенты TO пользователь1;
-- GRANT SELECT ON клиенты TO пользователь2;

-- ХОРОШО: использование групп
CREATE ROLE читатели_клиентов;
GRANT SELECT ON клиенты TO читатели_клиентов;
GRANT читатели_клиентов TO пользователь1, пользователь2;
```

### Восстановление после ошибок безопасности

#### Сброс прав доступа

```sql
-- Отзыв всех привилегий у пользователя
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM бывший_работник;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM бывший_работник;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM бывший_работник;

-- Удаление пользователя
-- DROP ROLE IF EXISTS бывший_работник;
```

#### Восстановление утраченных прав

```sql
-- Сценарий восстановления прав (обычно из резервной копии схемы безопасности)
CREATE ROLE восстанавливаемый_пользователь LOGIN PASSWORD 'recovery_password';
GRANT группа_аналитики TO восстанавливаемый_пользователь;
GRANT SELECT ON клиенты TO восстанавливаемый_пользователь;
```

### Заключение главы

Безопасность базы данных требует комплексного подхода, включающего:

1. Правильное управление ролями и привилегиями
2. Применение принципа наименьших привилегий
3. Регулярный аудит и мониторинг активности
4. Использование шифрования и безопасной аутентификации
5. Подготовку процедур восстановления после инцидентов

Эффективная система безопасности не только защищает данные, но и обеспечивает надежную работу системы в долгосрочной перспективе.

---

## Глава 68: Производительность и оптимизация (продолжение)

### Продвинутая оптимизация запросов

#### Оптимизация сложных JOIN

```sql
-- Сложный запрос до оптимизации
EXPLAIN ANALYZE
SELECT 
    к.фамилия,
    к.имя,
    к.город,
    COUNT(з.id) AS количество_заказов,
    SUM(з.общая_сумма) AS общая_сумма
FROM клиенты к
LEFT JOIN заказы з ON к.id = з.id_клиента
LEFT JOIN товары t ON EXISTS (  -- сложное условие без эффективного JOIN
    SELECT 1 FROM заказы_товары zt 
    WHERE zt.id_заказа = з.id AND zt.id_товара = t.id
)
WHERE к.активен = TRUE
  AND з.дата_заказа >= '2023-01-01'
GROUP BY к.id, к.фамилия, к.имя, к.город
HAVING COUNT(з.id) > 0
ORDER BY общая_сумма DESC;

-- Оптимизированный запрос
EXPLAIN ANALYZE
WITH клиенты_с_заказами AS (
    SELECT 
        к.id,
        к.фамилия,
        к.имя,
        к.город,
        з.id AS заказ_id,
        з.общая_сумма
    FROM клиенты к
    INNER JOIN заказы з ON к.id = з.id_клиента
    WHERE к.активен = TRUE
      AND з.дата_заказа >= '2023-01-01'
)
SELECT 
    фамилия,
    имя,
    город,
    COUNT(заказ_id) AS количество_заказов,
    SUM(общая_сумма) AS общая_сумма
FROM клиенты_с_заказами
GROUP BY id, фамилия, имя, город
ORDER BY общая_сумма DESC;
```

#### Оптимизация подзапросов

```sql
-- Неоптимизированный запрос с коррелированными подзапросами
EXPLAIN ANALYZE
SELECT 
    фамилия,
    имя,
    (SELECT COUNT(*) FROM заказы WHERE id_клиента = клиенты.id) AS количество_заказов,
    (SELECT SUM(общая_сумма) FROM заказы WHERE id_клиента = клиенты.id) AS общая_сумма
FROM клиенты
WHERE активен = TRUE;

-- Оптимизированный запрос с JOIN
EXPLAIN ANALYZE
SELECT 
    к.фамилия,
    к.имя,
    COALESCE(стат.количество_заказов, 0) AS количество_заказов,
    COALESCE(стат.общая_сумма, 0) AS общая_сумма
FROM клиенты к
LEFT JOIN (
    SELECT 
        id_клиента,
        COUNT(*) AS количество_заказов,
        SUM(общая_сумма) AS общая_сумма
    FROM заказы
    GROUP BY id_клиента
) AS стат ON к.id = стат.id_клиента
WHERE к.активен = TRUE;
```

### Использование оконных функций для оптимизации

#### Замена коррелированных подзапросов оконными функциями

```sql
-- Замена подзапроса для получения ранжирования
EXPLAIN ANALYZE
-- Неоптимизированно:
SELECT 
    фамилия,
    имя,
    общая_сумма,
    (SELECT COUNT(*) FROM заказы z2 WHERE z2.общая_сумма > заказы.общая_сумма) + 1 AS ранг
FROM заказы
JOIN клиенты ON заказы.id_клиента = клиенты.id
LIMIT 100;

-- Оптимизированно с оконной функцией:
EXPLAIN ANALYZE
SELECT 
    к.фамилия,
    к.имя,
    з.общая_сумма,
    RANK() OVER (ORDER BY з.общая_сумма DESC) AS ранг
FROM заказы з
JOIN клиенты к ON з.id_клиента = к.id
LIMIT 100;
```

#### Использование оконных функций для скользящих вычислений

```sql
-- Скользящее среднее за 7 дней
EXPLAIN ANALYZE
SELECT 
    дата_заказа,
    COUNT(*) AS заказов_в_день,
    SUM(общая_сумма) AS выручка_в_день,
    -- Скользящее среднее за 7 дней
    AVG(SUM(общая_сумма)) OVER (
        ORDER BY дата_заказа
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS среднее_за_7_дней
FROM заказы
WHERE дата_заказа >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY дата_заказа
ORDER BY дата_заказа;
```

### Оптимизация агрегации

#### GROUP BY с фильтрацией

```sql
-- Оптимизация с предварительной фильтрацией
EXPLAIN ANALYZE
-- Неоптимизированный запрос:
SELECT 
    к.город,
    COUNT(*) AS количество_клиентов
FROM клиенты к
LEFT JOIN заказы з ON к.id = з.id_клиента
WHERE к.активен = TRUE
GROUP BY к.город
HAVING COUNT(з.id) > 0;

-- Оптимизированный запрос:
EXPLAIN ANALYZE
SELECT 
    к.город,
    COUNT(з.id) AS количество_клиентов
FROM (
    SELECT id, фамилия, имя, город
    FROM клиенты
    WHERE активен = TRUE
) к
INNER JOIN заказы з ON к.id = з.id_клиента
GROUP BY к.город;
```

#### Оптимизация COUNT(DISTINCT)

```sql
-- COUNT(DISTINCT) может быть медленным
EXPLAIN ANALYZE
SELECT 
    дата_заказа,
    COUNT(DISTINCT id_клиента) AS уникальных_клиентов,
    COUNT(*) AS всего_заказов
FROM заказы
WHERE дата_заказа BETWEEN '2023-01-01' AND '2023-12-31'
GROUP BY дата_заказа
ORDER BY дата_заказа;

-- Альтернатива с подзапросом (иногда быстрее):
EXPLAIN ANALYZE
SELECT 
    дата_заказа,
    (SELECT COUNT(DISTINCT id_клиента) FROM заказы WHERE дата_заказа = заказы_групп.дата_заказа) AS уникальных_клиентов,
    COUNT(*) AS всего_заказов
FROM (
    SELECT дата_заказа, COUNT(*) AS всего_заказов
    FROM заказы
    WHERE дата_заказа BETWEEN '2023-01-01' AND '2023-12-31'
    GROUP BY дата_заказа
) AS заказы_групп;
```

### Продвинутая оптимизация индексов

#### Индексы на выражениях

```sql
-- Индекс на выражении для частых фильтров
CREATE INDEX idx_клиенты_lower_email ON клиенты (LOWER(email));
CREATE INDEX idx_заказы_месяц ON заказы (EXTRACT(YEAR FROM дата_заказа), EXTRACT(MONTH FROM дата_заказа));
CREATE INDEX idx_клиенты_возраст ON клиенты ((EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM дата_рождения)));

-- Запрос, который будет использовать индекс на выражении
EXPLAIN ANALYZE
SELECT * FROM клиенты WHERE LOWER(email) = 'ivanov@example.com';

EXPLAIN ANALYZE
SELECT COUNT(*) FROM заказы 
WHERE EXTRACT(YEAR FROM дата_заказа) = 2023 AND EXTRACT(MONTH FROM дата_заказа) = 12;
```

#### Частичные индексы

```sql
-- Частичные индексы для часто используемых фильтров
CREATE INDEX idx_активные_клиенты_город ON клиенты (город) WHERE активен = TRUE;
CREATE INDEX idx_новые_заказы_дата ON заказы (дата_заказа DESC) WHERE статус = 'новый';
CREATE INDEX idx_дорогие_товары_цена ON товары (цена DESC) WHERE цена > 50000;

-- Эти индексы будут использоваться для соответствующих запросов
EXPLAIN ANALYZE
SELECT * FROM клиенты WHERE активен = TRUE AND город = 'Москва';

EXPLAIN ANALYZE
SELECT * FROM заказы WHERE статус = 'новый' ORDER BY дата_заказа DESC LIMIT 10;
```

#### Покрывающие индексы (с INCLUDE)

```sql
-- Покрывающий индекс (в PostgreSQL с версии 11+)
-- Столбцы в INCLUDE не используются в условиях, но возвращаются в результате
CREATE INDEX idx_заказы_покрывающий ON заказы (id_клиента, статус) INCLUDE (общая_сумма, дата_заказа);

-- Запрос, который может использовать покрывающий индекс
EXPLAIN ANALYZE
SELECT id, общая_сумма, дата_заказа
FROM заказы 
WHERE id_клиента = 1 AND статус = 'новый';
```

### Использование материализованных представлений

#### Оптимизация аналитических запросов

```sql
-- Создание материализованного представления для анализа
CREATE MATERIALIZED VIEW аналитика_по_месяцам AS
SELECT 
    EXTRACT(YEAR FROM дата_заказа) AS год,
    EXTRACT(MONTH FROM дата_заказа) AS месяц,
    к.город,
    COUNT(*) AS количество_заказов,
    SUM(общая_сумма) AS общая_выручка,
    AVG(общая_сумма) AS средний_чек,
    COUNT(DISTINCT id_клиента) AS уникальных_клиентов
FROM заказы
JOIN клиенты к ON заказы.id_клиента = к.id
WHERE дата_заказа >= '2022-01-01'
GROUP BY 
    EXTRACT(YEAR FROM дата_заказа),
    EXTRACT(MONTH FROM дата_заказа),
    к.город;

-- Индекс на материализованном представлении
CREATE INDEX idx_аналитика_месяц_город ON аналитика_по_месяцам (год, месяц, город);

-- Использование материализованного представления
EXPLAIN ANALYZE
SELECT * FROM аналитика_по_месяцам 
WHERE год = 2023 AND город = 'Москва'
ORDER BY месяц;

-- Обновление материализованного представления
-- REFRESH MATERIALIZED VIEW аналитика_по_месяцам;
```

### Оптимизация с помощью партицирования

#### Создание партицированных таблиц

```sql
-- Пример партицирования по диапазону (дате)
CREATE TABLE заказы_партицированные (
    id SERIAL,
    id_клиента INTEGER NOT NULL,
    дата_заказа DATE NOT NULL,
    общая_сумма NUMERIC(12,2),
    статус VARCHAR(20) DEFAULT 'новый'
) PARTITION BY RANGE (дата_заказа);

-- Создание партиций
CREATE TABLE заказы_2023_01 PARTITION OF заказы_партицированные
FOR VALUES FROM ('2023-01-01') TO ('2023-02-01');

CREATE TABLE заказы_2023_02 PARTITION OF заказы_партицированные
FOR VALUES FROM ('2023-02-01') TO ('2023-03-01');

CREATE TABLE заказы_2023_03 PARTITION OF заказы_партицированные
FOR VALUES FROM ('2023-03-01') TO ('2023-04-01');

-- Запрос будет использовать только нужные партиции
EXPLAIN ANALYZE
SELECT * FROM заказы_партицированные 
WHERE дата_заказа BETWEEN '2023-02-01' AND '2023-02-28';
```

### Параметры настройки производительности

#### Настройки планировщика запросов

```sql
-- Эта информация обычно указывается в postgresql.conf
-- random_page_cost = 1.1  -- для SSD
-- effective_cache_size = 4GB  -- объем RAM, доступный для кеширования
-- seq_page_cost = 1.0  -- стоимость последовательного чтения

-- Временная настройка на уровне сессии
SET random_page_cost = 1.1;
SET enable_indexscan = ON;
SET enable_seqscan = ON;
SET enable_nestloop = ON;
SET enable_hashjoin = ON;
SET enable_mergejoin = ON;

-- Проверка текущих значений
SHOW random_page_cost;
SHOW effective_cache_size;
```

#### Запуск ANALYZE для обновления статистики

```sql
-- Обновление статистики для оптимизатора
ANALYZE клиенты;
ANALYZE заказы;
ANALYZE товары;

-- Обновление статистики для конкретных столбцов
ANALYZE клиенты (email, город, активен);

-- Автоматическое обновление статистики (настраивается в postgresql.conf)
-- default_statistics_target = 100
```

### Оптимизация больших таблиц

#### Использование LIMIT и OFFSET эффективно

```sql
-- Плохо для больших OFFSET:
-- SELECT * FROM заказы ORDER BY id LIMIT 10 OFFSET 100000;

-- Лучше использовать курсор или ключевое поле:
SELECT * FROM заказы 
WHERE id > 100000 
ORDER BY id 
LIMIT 10;

-- Или использовать оконные функции:
WITH нумерованные AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY id) AS rn
    FROM заказы
)
SELECT * FROM нумерованные WHERE rn BETWEEN 100001 AND 100010;
```

#### Удаление старых данных эффективно

```sql
-- Удаление старых данных партиями
DO $$
DECLARE
    удалено INTEGER := 0;
    за_итерацию INTEGER := 1000;
BEGIN
    LOOP
        DELETE FROM заказы 
        WHERE дата_заказа < CURRENT_DATE - INTERVAL '2 years'
        LIMIT за_итерацию;
        
        GET DIAGNOSTICS удалено = ROW_COUNT;
        
        EXIT WHEN удалено < за_итерацию;
        COMMIT;
    END LOOP;
END $$;
```

### Мониторинг производительности

#### Использование pg_stat_statements

```sql
-- Включение расширения для мониторинга запросов
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Просмотр самых медленных запросов
SELECT 
    query,
    mean_time,
    calls,
    total_time,
    rows,
    mean_time * calls AS estimated_total_time
FROM pg_stat_statements 
ORDER BY mean_time DESC
LIMIT 10;

-- Просмотр запросов с наибольшим количеством вызовов
SELECT 
    query,
    calls,
    total_time,
    mean_time
FROM pg_stat_statements 
ORDER BY calls DESC
LIMIT 10;

-- Сброс статистики
-- SELECT pg_stat_statements_reset();
```

#### Мониторинг использования индексов

```sql
-- Проверка использования индексов
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Поиск неиспользуемых индексов
SELECT 
    indexrelname AS unused_index,
    schemaname,
    tablename
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY schemaname, tablename;
```

### Практические рецепты оптимизации

#### Рецепт 1: Оптимизация отчетов

```sql
-- Для аналитических отчетов создаем оптимизированные представления
CREATE MATERIALIZED VIEW отчет_по_городам_ежедневный AS
SELECT 
    к.город,
    COUNT(DISTINCT CASE WHEN дата_заказа = CURRENT_DATE THEN к.id END) AS новых_клиентов_сегодня,
    COUNT(CASE WHEN дата_заказа = CURRENT_DATE THEN 1 END) AS заказов_сегодня,
    SUM(CASE WHEN дата_заказа = CURRENT_DATE THEN общая_сумма ELSE 0 END) AS выручка_сегодня,
    COUNT(DISTINCT CASE WHEN дата_заказа >= CURRENT_DATE - INTERVAL '7 days' THEN к.id END) AS активных_за_неделю
FROM клиенты к
LEFT JOIN заказы з ON к.id = з.id_клиента
GROUP BY к.город;

-- Использование в отчете
EXPLAIN ANALYZE
SELECT * FROM отчет_по_городам_ежедневный ORDER BY выручка_сегодня DESC;
```

#### Рецепт 2: Оптимизация поиска

```sql
-- Для поиска по нескольким полям создаем составной индекс
CREATE INDEX idx_клиенты_поиск_составной ON клиенты (LOWER(фамилия), LOWER(имя), LOWER(email));

-- Используем функциональный индекс для поиска
CREATE INDEX idx_товары_поиск_полный ON товары 
USING gin (to_tsvector('russian', наименование || ' ' || COALESCE(описание, '')));

-- Запрос с полнотекстовым поиском
SELECT *, ts_rank(to_tsvector('russian', наименование || ' ' || COALESCE(описание, '')), plainto_tsquery('russian', 'смартфон apple')) AS rank
FROM товары
WHERE to_tsvector('russian', наименование || ' ' || COALESCE(описание, '')) @@ plainto_tsquery('russian', 'смартфон apple')
ORDER BY rank DESC
LIMIT 20;
```

#### Рецепт 3: Оптимизация агрегации

```sql
-- Создание вспомогательной таблицы для часто используемой агрегации
CREATE TABLE клиенты_статистика (
    id_клиента INTEGER PRIMARY KEY,
    количество_заказов INTEGER DEFAULT 0,
    общая_сумма NUMERIC(12,2) DEFAULT 0,
    средний_чек NUMERIC(12,2) DEFAULT 0,
    последний_заказ DATE,
    дата_обновления TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Процедура обновления статистики
CREATE OR REPLACE FUNCTION обновить_статистику_клиентов(client_id INTEGER DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    IF client_id IS NULL THEN
        -- Обновляем всех клиентов
        INSERT INTO клиенты_статистика (id_клиента, количество_заказов, общая_сумма, средний_чек, последний_заказ)
        SELECT 
            к.id,
            COUNT(з.id) AS количество_заказов,
            COALESCE(SUM(з.общая_сумма), 0) AS общая_сумма,
            CASE 
                WHEN COUNT(з.id) > 0 THEN AVG(з.общая_сумма)
                ELSE 0
            END AS средний_чек,
            MAX(з.дата_заказа) AS последний_заказ
        FROM клиенты к
        LEFT JOIN заказы з ON к.id = з.id_клиента
        GROUP BY к.id
        ON CONFLICT (id_клиента) DO UPDATE SET
            количество_заказов = EXCLUDED.количество_заказов,
            общая_сумма = EXCLUDED.общая_сумма,
            средний_чек = EXCLUDED.средний_чек,
            последний_заказ = EXCLUDED.последний_заказ,
            дата_обновления = CURRENT_TIMESTAMP;
    ELSE
        -- Обновляем конкретного клиента
        <<update_client>>
        LOOP
            UPDATE клиенты_статистика SET
                (количество_заказов, общая_сумма, средний_чек, последний_заказ, дата_обновления) = (
                    SELECT 
                        COUNT(з.id),
                        COALESCE(SUM(з.общая_сумма), 0),
                        CASE WHEN COUNT(з.id) > 0 THEN AVG(з.общая_сумма) ELSE 0 END,
                        MAX(з.дата_заказа),
                        CURRENT_TIMESTAMP
                    FROM заказы з
                    WHERE з.id_клиента = client_id
                )
            WHERE id_клиента = client_id;
            
            IF NOT FOUND THEN
                -- Если записи не было, вставляем новую
                INSERT INTO клиенты_статистика (id_клиента, количество_заказов, общая_сумма, средний_чек, последний_заказ)
                SELECT 
                    client_id,
                    COUNT(з.id),
                    COALESCE(SUM(з.общая_сумма), 0),
                    CASE WHEN COUNT(з.id) > 0 THEN AVG(з.общая_сумма) ELSE 0 END,
                    MAX(з.дата_заказа)
                FROM заказы з
                WHERE з.id_клиента = client_id;
            END IF;
            EXIT update_client;
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Теперь запросы к статистике будут быстрыми
EXPLAIN ANALYZE
SELECT к.фамилия, к.имя, ст.количество_заказов, ст.общая_сумма
FROM клиенты_статистика ст
JOIN клиенты к ON ст.id_клиента = к.id
WHERE ст.общая_сумма > 100000
ORDER BY ст.общая_сумма DESC;
```

### Заключение главы

Оптимизация производительности - это не разовое действие, а непрерывный процесс. Эффективная оптимизация включает:

1. Правильное проектирование структуры данных
2. Оптимальное использование индексов
3. Правильные SQL-запросы
4. Регулярное обновление статистики
5. Мониторинг и анализ медленных запросов
6. Адаптацию к изменяющимся паттернам использования

Ключ к успеху - понимание характера нагрузки на систему и постоянное внимание к производительности на всех этапах разработки и эксплуатации.

---

## Глава 69: Практические проекты (начало)

### Введение

Практические проекты позволяют объединить все изученные концепции SQL в реальных сценариях. В этой главе мы рассмотрим несколько проектов, которые демонстрируют применение SQL на практике, включая создание структуры базы данных, написание сложных запросов, оптимизацию и создание аналитических отчетов.

### Проект 1: Система управления заказами интернет-магазина

#### Описание проекта

Создадим полную систему управления заказами интернет-магазина, включая таблицы клиентов, товаров, заказов, оплаты и доставки.

#### 1. Создание структуры базы данных

```sql
-- Таблица клиентов
CREATE TABLE клиенты (
    id SERIAL PRIMARY KEY,
    фамилия VARCHAR(50) NOT NULL,
    имя VARCHAR(50) NOT NULL,
    отчество VARCHAR(50),
    email VARCHAR(100) UNIQUE NOT NULL,
    телефон VARCHAR(20),
    дата_рождения DATE,
    дата_регистрации TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    адрес_доставки TEXT,
    индивидуальная_скидка NUMERIC(5,2) DEFAULT 0,
    активен BOOLEAN DEFAULT TRUE,
    верифицирован BOOLEAN DEFAULT FALSE
);

-- Таблица категорий товаров
CREATE TABLE категории (
    id SERIAL PRIMARY KEY,
    название VARCHAR(100) NOT NULL UNIQUE,
    описание TEXT,
    родительская_категория INTEGER REFERENCES категории(id),
    активна BOOLEAN DEFAULT TRUE
);

-- Таблица товаров
CREATE TABLE товары (
    id SERIAL PRIMARY KEY,
    артикул VARCHAR(30) UNIQUE NOT NULL,
    название VARCHAR(200) NOT NULL,
    описание TEXT,
    id_категории INTEGER REFERENCES категории(id),
    цена NUMERIC(10,2) NOT NULL CHECK (цена > 0),
    себестоимость NUMERIC(10,2) CHECK (себестоимость >= 0),
    количество_на_складе INTEGER DEFAULT 0 CHECK (количество_на_складе >= 0),
    минимальный_заказ INTEGER DEFAULT 1,
    вес NUMERIC(8,3) CHECK (вес > 0),
    габариты JSONB,  -- {"длина": 10, "ширина": 5, "высота": 3}
    атрибуты JSONB,  -- гибкие характеристики товара
    дата_добавления TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    активен BOOLEAN DEFAULT TRUE,
    популярность INTEGER DEFAULT 0  -- для сортировки
);

-- Таблица заказов
CREATE TABLE заказы (
    id SERIAL PRIMARY KEY,
    id_клиента INTEGER NOT NULL REFERENCES клиенты(id) ON DELETE RESTRICT,
    дата_создания TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    дата_обновления TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    дата_подтверждения DATE,
    дата_доставки DATE,
    общая_сумма NUMERIC(12,2) NOT NULL DEFAULT 0,
    сумма_доставки NUMERIC(8,2) DEFAULT 0,
    сумма_товаров NUMERIC(12,2) GENERATED ALWAYS AS (общая_сумма - сумма_доставки) STORED,
    скидка_процент NUMERIC(5,2) DEFAULT 0 CHECK (скидка_процент >= 0 AND скидка_процент <= 100),
    скидка_сумма NUMERIC(10,2) GENERATED ALWAYS AS (общая_сумма * скидка_процент / 100) STORED,
    статус_заказа VARCHAR(20) NOT NULL DEFAULT 'новый' CHECK (статус_заказа IN ('новый', 'подтвержден', 'оплачен', 'собирается', 'в_доставке', 'доставлен', 'отменен')),
    приоритет INTEGER DEFAULT 3 CHECK (приоритет BETWEEN 1 AND 5),
    комментарий_клиента TEXT,
    внутренний_комментарий TEXT,
    метки JSONB,
    валюта VARCHAR(3) DEFAULT 'RUB'
);

-- Таблица позиций заказа
CREATE TABLE позиции_заказа (
    id SERIAL PRIMARY KEY,
    id_заказа INTEGER NOT NULL REFERENCES заказы(id) ON DELETE CASCADE,
    id_товара INTEGER NOT NULL REFERENCES товары(id) ON DELETE RESTRICT,
    количество INTEGER NOT NULL CHECK (количество > 0),
    цена_на_момент NUMERIC(10,2) NOT NULL CHECK (цена_на_момент > 0),
    скидка_на_позицию NUMERIC(5,2) DEFAULT 0 CHECK (скидка_на_позицию >= 0 AND скидка_на_позицию <= 100),
    CONSTRAINT uk_заказ_товар UNIQUE (id_заказа, id_товара)
);

-- Таблица способов оплаты
CREATE TABLE способы_оплаты (
    id SERIAL PRIMARY KEY,
    название VARCHAR(50) NOT NULL,
    тип_оплаты VARCHAR(20) NOT NULL CHECK (тип_оплаты IN ('картой', 'наличные', 'счет', 'электронный кошелек', 'кредит')),
    активен BOOLEAN DEFAULT TRUE
);

-- Таблица оплат
CREATE TABLE оплаты (
    id SERIAL PRIMARY KEY,
    id_заказа INTEGER NOT NULL REFERENCES заказы(id) ON DELETE CASCADE,
    id_способа_оплаты INTEGER NOT NULL REFERENCES способы_оплаты(id),
    сумма NUMERIC(12,2) NOT NULL,
    дата_платежа TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    статус_платежа VARCHAR(20) NOT NULL DEFAULT 'ожидает' CHECK (статус_платежа IN ('ожидает', 'обрабатывается', 'успешно', 'отменен', 'ошибка')),
    транзакция_номер VARCHAR(100),
    детали_платежа JSONB
);

-- Таблица статусов заказа и изменений
CREATE TABLE история_статусов_заказа (
    id SERIAL PRIMARY KEY,
    id_заказа INTEGER NOT NULL REFERENCES заказы(id) ON DELETE CASCADE,
    старый_статус VARCHAR(20),
    новый_статус VARCHAR(20) NOT NULL,
    дата_изменения TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    комментарий TEXT,
    изменен_пользователем VARCHAR(100)
);

-- Индексы для оптимизации
CREATE INDEX idx_клиенты_email ON клиенты(LOWER(email));
CREATE INDEX idx_клиенты_регистрация ON клиенты(дата_регистрации DESC);
CREATE INDEX idx_товары_категория ON товары(id_категории);
CREATE INDEX idx_товары_артикул ON товары(LOWER(артикул));
CREATE INDEX idx_товары_цена ON товары(цена);
CREATE INDEX idx_заказы_клиент ON заказы(id_клиента);
CREATE INDEX idx_заказы_статус ON заказы(статус_заказа);
CREATE INDEX idx_заказы_дата ON заказы(дата_создания DESC);
CREATE INDEX idx_заказы_сумма ON заказы(общая_сумма DESC);
CREATE INDEX idx_позиции_заказа_заказ ON позиции_заказа(id_заказа);
CREATE INDEX idx_оплаты_заказ ON оплаты(id_заказа);
CREATE INDEX idx_история_статусов_заказ ON история_статусов_заказа(id_заказа);
```

#### 2. Наполнение тестовыми данными

```sql
-- Вставка категорий
INSERT INTO категории (название, описание) VALUES
('Электроника', 'Электронные устройства и аксессуары'),
('Одежда', 'Одежда и обувь'),
('Дом и сад', 'Товары для дома и сада'),
('Книги', 'Книги и литературные товары'),
('Спорт и отдых', 'Спортивные товары и инвентарь');

-- Вставка товаров
INSERT INTO товары (артикул, название, описание, id_категории, цена, количество_на_складе) VALUES
('EL-001', 'Смартфон iPhone 14', 'Смартфон Apple iPhone 14, 128 ГБ, Midnight', 1, 89990.00, 15),
('EL-002', 'Ноутбук Dell Inspiron', 'Ноутбук Dell Inspiron 15, Intel Core i5, 8 ГБ ОЗУ', 1, 55990.00, 8),
('OD-001', 'Кроссовки Nike Air', 'Спортивные кроссовки Nike Air Max', 2, 12990.00, 25),
('HS-001', 'Кофеварка DeLonghi', 'Капсульная кофеварка DeLonghi, черная', 3, 25990.00, 6),
('BK-001', 'Книга "Изучаем SQL"', 'Полное руководство по SQL', 4, 1490.00, 50);

-- Вставка клиентов
INSERT INTO клиенты (фамилия, имя, email, телефон, адрес_доставки) VALUES
('Иванов', 'Иван', 'ivanov@example.com', '+7(901)123-45-67', 'г. Москва, ул. Тверская, д. 1, кв. 1'),
('Петрова', 'Мария', 'petrova@example.com', '+7(902)234-56-78', 'г. Санкт-Петербург, пр. Невский, д. 2, кв. 2'),
('Сидоров', 'Андрей', 'sidorov@example.com', '+7(903)345-67-89', 'г. Новосибирск, ул. Кирова, д. 3, кв. 3');
```

#### 3. Запросы для анализа данных

```sql
-- Запрос 1: Отчет по топ-10 клиентам по общей сумме заказов
CREATE VIEW топ_клиенты_по_заказам AS
SELECT 
    к.id,
    к.фамилия,
    к.имя,
    к.email,
    COUNT(з.id) AS количество_заказов,
    SUM(з.общая_сумма) AS общая_сумма,
    AVG(з.общая_сумма) AS средний_чек,
    MAX(з.дата_создания) AS последний_заказ,
    CASE 
        WHEN SUM(з.общая_сумма) > 200000 THEN 'VIP'
        WHEN SUM(з.общая_сумма) > 100000 THEN 'Премиум'
        WHEN COUNT(з.id) >= 5 THEN 'Постоянный'
        ELSE 'Обычный'
    END AS категория_клиента
FROM клиенты к
LEFT JOIN заказы з ON к.id = з.id_клиента
GROUP BY к.id, к.фамилия, к.имя, к.email
ORDER BY общая_сумма DESC;

-- Запрос 2: Аналитика по товарам
CREATE VIEW аналитика_по_товарам AS
SELECT 
    т.id,
    т.артикул,
    т.название,
    т.цена,
    т.количество_на_складе,
    к.название AS категория,
    COALESCE(продажи.количество_продано, 0) AS продано_единиц,
    COALESCE(продажи.доход, 0) AS доход_от_продаж,
    COALESCE(рейтинг.средняя_оценка, 0) AS средняя_оценка
FROM товары т
LEFT JOIN категории к ON т.id_категории = к.id
LEFT JOIN (
    SELECT 
        id_товара,
        SUM(количество) AS количество_продано,
        SUM(количество * цена_на_момент) AS доход
    FROM позиции_заказа
    JOIN заказы ON позиции_заказа.id_заказа = заказы.id
    WHERE заказы.статус_заказа IN ('доставлен', 'оплачен')
    GROUP BY id_товара
) AS продажи ON т.id = продажи.id_товара
ORDER BY доход_от_продаж DESC;

-- Запрос 3: Ежедневная аналитика
CREATE VIEW ежедневная_аналитика AS
SELECT 
    дата_создания::date AS дата,
    COUNT(*) AS количество_заказов,
    SUM(общая_сумма) AS общая_выручка,
    AVG(общая_сумма) AS средний_чек,
    COUNT(DISTINCT id_клиента) AS уникальных_клиентов,
    COUNT(*) FILTER (WHERE статус_заказа = 'новый') AS новых_заказов,
    COUNT(*) FILTER (WHERE статус_заказа = 'доставлен') AS доставленных
FROM заказы
WHERE дата_создания::date = CURRENT_DATE
GROUP BY дата_создания::date;
```

#### 4. Функции и процедуры для бизнес-логики

```sql
-- Функция для расчета скидки клиента
CREATE OR REPLACE FUNCTION расчет_скидки_клиента(client_id INTEGER)
RETURNS NUMERIC AS $$
DECLARE
    общая_сумма NUMERIC;
    количество_заказов INTEGER;
    индивидуальная_скидка NUMERIC;
    итоговая_скидка NUMERIC;
BEGIN
    -- Получаем индивидуальную скидку
    SELECT индивидуальная_скидка INTO индивидуальная_скидка
    FROM клиенты WHERE id = client_id;
    
    -- Получаем общую сумму заказов клиента
    SELECT COALESCE(SUM(общая_сумма), 0), COUNT(*) INTO общая_сумма, количество_заказов
    FROM заказы WHERE id_клиента = client_id AND статус_заказа != 'отменен';
    
    -- Расчет скидки на основе общей суммы и количества заказов
    итоговая_скидка := индивидуальная_скидка;
    
    IF общая_сумма > 200000 THEN
        итоговая_скидка := GREATEST(итоговая_скидка, 15.0);
    ELSIF общая_сумма > 100000 THEN
        итоговая_скидка := GREATEST(итоговая_скидка, 10.0);
    ELSIF количество_заказов > 10 THEN
        итоговая_скидка := GREATEST(итоговая_скидка, 7.0);
    ELSIF количество_заказов > 5 THEN
        итоговая_скидка := GREATEST(итоговая_скидка, 5.0);
    END IF;
    
    RETURN итоговая_скидка;
END;
$$ LANGUAGE plpgsql;

-- Процедура для создания заказа
CREATE OR REPLACE FUNCTION создать_заказ(
    client_id INTEGER,
    items JSONB,  -- [{"id_товара": 1, "количество": 2}, ...]
    delivery_fee NUMERIC DEFAULT 0
)
RETURNS INTEGER AS $$
DECLARE
    order_id INTEGER;
    item RECORD;
    total_amount NUMERIC := 0;
    discount_percent NUMERIC;
    position_total NUMERIC;
BEGIN
    -- Рассчитываем скидку клиента
    discount_percent := расчет_скидки_клиента(client_id);
    
    -- Создаем заказ
    INSERT INTO заказы (id_клиента, сумма_доставки, скидка_процент, статус_заказа)
    VALUES (client_id, COALESCE(delivery_fee, 0), discount_percent, 'новый')
    RETURNING id INTO order_id;
    
    -- Добавляем позиции в заказ
    FOR item IN SELECT * FROM jsonb_to_recordset(items) AS x(id_товара INTEGER, количество INTEGER)
    LOOP
        -- Получаем текущую цену товара
        SELECT цена INTO position_total FROM товары WHERE id = item.id_товара;
        
        IF position_total IS NULL THEN
            RAISE EXCEPTION 'Товар с ID % не найден', item.id_товара;
        END IF;
        
        position_total := position_total * item.количество;
        total_amount := total_amount + position_total;
        
        -- Вставляем позицию
        INSERT INTO позиции_заказа (id_заказа, id_товара, количество, цена_на_момент)
        VALUES (order_id, item.id_товара, item.количество, 
                (SELECT цена FROM товары WHERE id = item.id_товара));
    END LOOP;
    
    -- Обновляем общую сумму заказа с учетом скидки
    total_amount := total_amount + COALESCE(delivery_fee, 0);
    total_amount := total_amount * (1 - discount_percent / 100);
    
    UPDATE заказы SET общая_сумма = total_amount WHERE id = order_id;
    
    RETURN order_id;
END;
$$ LANGUAGE plpgsql;
```

#### 5. Триггеры для обеспечения целостности

```sql
-- Триггер для обновления даты обновления заказа
CREATE OR REPLACE FUNCTION обновить_дату_заказа()
RETURNS TRIGGER AS $$
BEGIN
    NEW.дата_обновления = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_заказы_обновление
    BEFORE UPDATE ON заказы
    FOR EACH ROW
    EXECUTE FUNCTION обновить_дату_заказа();

-- Триггер для обновления популярности товара
CREATE OR REPLACE FUNCTION обновить_популярность_товара()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE товары SET популярность = популярность + NEW.количество
        WHERE id = NEW.id_товара;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE товары SET популярность = популярность - OLD.количество + NEW.количество
        WHERE id = NEW.id_товара;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE товары SET популярность = популярность - OLD.количество
        WHERE id = OLD.id_товара;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_позиции_обновление_популярности
    AFTER INSERT OR UPDATE OR DELETE ON позиции_заказа
    FOR EACH ROW
    EXECUTE FUNCTION обновить_популярность_товара();

-- Триггер для проверки наличия товара на складе
CREATE OR REPLACE FUNCTION проверить_наличие_товара()
RETURNS TRIGGER AS $$
DECLARE
    current_stock INTEGER;
BEGIN
    SELECT количество_на_складе INTO current_stock
    FROM товары WHERE id = NEW.id_товара;
    
    IF current_stock < NEW.количество THEN
        RAISE EXCEPTION 'Недостаточно товара "%" на складе. Запрошено: %, доступно: %', 
               (SELECT название FROM товары WHERE id = NEW.id_товара),
               NEW.количество, 
               current_stock;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_позиции_проверка_наличия
    BEFORE INSERT OR UPDATE ON позиции_заказа
    FOR EACH ROW
    EXECUTE FUNCTION проверить_наличие_товара();
```

### Заключение проекта 1

Этот проект демонстрирует:

1. Правильную структуру БД с нормализацией
2. Использование ограничений и проверок
3. Создание представлений для аналитики
4. Реализацию бизнес-логики через функции
5. Обеспечение целостности данных через триггеры
6. Оптимизацию через индексы
7. Практическое применение всех изученных SQL-конструкций

### Проект 2: Система аналитики продаж (начало)

#### Описание проекта

Создадим систему аналитики продаж с продвинутыми отчетами и KPI метриками.

#### 1. Создание вспомогательных таблиц

```sql
-- Таблица для хранения KPI
CREATE TABLE kpi_метрики (
    id SERIAL PRIMARY KEY,
    дата_расчета DATE NOT NULL,
    название_метрики VARCHAR(100) NOT NULL,
    значение NUMERIC NOT NULL,
    категория VARCHAR(50),
    описание TEXT
);

-- Таблица для хранения ежедневной статистики (для производительности)
CREATE TABLE ежедневная_статистика (
    дата DATE PRIMARY KEY,
    новые_клиенты INTEGER DEFAULT 0,
    новые_заказы INTEGER DEFAULT 0,
    общая_выручка NUMERIC DEFAULT 0,
    средний_чек NUMERIC DEFAULT 0,
    конверсия_заказов NUMERIC DEFAULT 0,
    индекс_удовлетворенности INTEGER DEFAULT 0
);

-- Создание материализованного представления для анализа
CREATE MATERIALIZED VIEW аналитика_по_периодам AS
SELECT 
    дата_создания::date AS дата,
    COUNT(*) AS заказов,
    SUM(общая_сумма) AS выручка,
    AVG(общая_сумма) AS средний_чек,
    COUNT(*) * 100.0 / (SELECT COUNT(*) FROM заказы WHERE дата_создания::date = дата_создания::date) AS доля_от_суммы,
    COUNT(DISTINCT id_клиента) AS уникальных_клиентов
FROM заказы
GROUP BY дата_создания::date;
```

#### 2. Функции для аналитики

```sql
-- Функция для расчета основных метрик
CREATE OR REPLACE FUNCTION рассчитать_бизнес_метрики(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    метрика VARCHAR(100),
    значение NUMERIC,
    изменение_в_процентах NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH текущий_период AS (
        SELECT 
            COUNT(*) AS заказов,
            SUM(общая_сумма) AS выручка,
            AVG(общая_сумма) AS средний_чек,
            COUNT(DISTINCT id_клиента) AS уникальных_клиентов
        FROM заказы
        WHERE дата_создания::date BETWEEN start_date AND end_date
    ),
    предыдущий_период AS (
        SELECT 
            COUNT(*) AS заказов,
            SUM(общая_сумма) AS выручка,
            AVG(общая_сумма) AS средний_чек,
            COUNT(DISTINCT id_клиента) AS уникальных_клиентов
        FROM заказы
        WHERE дата_создания::date BETWEEN (start_date - (end_date - start_date)) AND (start_date - INTERVAL '1 day')
    )
    SELECT 'Количество заказов'::VARCHAR, cp.заказов::NUMERIC, 
           ((cp.заказов - COALESCE(pp.заказов, 0)) * 100.0 / NULLIF(pp.заказов, 0))::NUMERIC
    FROM текущий_период cp
    LEFT JOIN предыдущий_период pp ON TRUE
    
    UNION ALL
    
    SELECT 'Выручка'::VARCHAR, cp.выручка::NUMERIC,
           ((cp.выручка - COALESCE(pp.выручка, 0)) * 100.0 / NULLIF(pp.выручка, 0))::NUMERIC
    FROM текущий_период cp
    LEFT JOIN предыдущий_период pp ON TRUE
    
    UNION ALL
    
    SELECT 'Средний чек'::VARCHAR, cp.средний_чек::NUMERIC,
           ((cp.средний_чек - COALESCE(pp.средний_чек, 0)) * 100.0 / NULLIF(pp.средний_чек, 0))::NUMERIC
    FROM текущий_период cp
    LEFT JOIN предыдущий_период pp ON TRUE;
    
END;
$$ LANGUAGE plpgsql;
```

### Заключение главы

Практические проекты позволяют объединить все изученные концепции SQL в комплексных решениях. Они помогают понять, как различные элементы SQL работают вместе в реальных приложениях:

1. Создание оптимальной структуры базы данных
2. Реализация бизнес-логики через функции и триггеры
3. Обеспечение целостности данных
4. Создание аналитических представлений
5. Оптимизация производительности
6. Обеспечение безопасности
7. Настройка мониторинга и аудита

---