# Справочник Типичных Ошибок SQL

Этот документ поможет вам избежать самых распространенных ошибок, которые делают начинающие и даже опытные SQL разработчики.

---

## 1. NULL Handling (САМАЯ ЧАСТАЯ ОШИБКА!)

### ❌ НЕПРАВИЛЬНО
```sql
-- NULL никогда не равно NULL
SELECT * FROM users WHERE age = NULL;        -- 0 результатов ❌
SELECT * FROM users WHERE age != NULL;       -- 0 результатов ❌
SELECT * FROM users WHERE age <> NULL;       -- 0 результатов ❌

-- Хуже: в условиях с AND/OR
SELECT * FROM users WHERE age = NULL OR city = 'Moscow';  -- Некорректно
```

### ✅ ПРАВИЛЬНО
```sql
-- Используйте IS NULL или IS NOT NULL
SELECT * FROM users WHERE age IS NULL;       -- Правильно ✅
SELECT * FROM users WHERE age IS NOT NULL;   -- Правильно ✅

-- В сложных условиях
SELECT * FROM users WHERE age IS NOT NULL AND city = 'Moscow';
SELECT * FROM users WHERE age IS NULL OR city = 'Moscow';

-- Используйте COALESCE для обработки NULL в выводе
SELECT name, COALESCE(phone, 'Не указан') AS phone FROM users;
```

### ПОЧЕМУ?
- NULL означает "неизвестное значение", а не пустую строку
- Сравнение с NULL всегда возвращает NULL (неизвестно)
- SQL логика: NULL = NULL → NULL (неизвестно), не TRUE

---

## 2. SELECT * Вместо Явного Списка Столбцов

### ❌ НЕПРАВИЛЬНО
```sql
SELECT * FROM users;                    -- Медленно и неопределенно
SELECT * FROM users WHERE age > 25;     -- Передает ненужные данные
SELECT * FROM orders LIMIT 10;          -- Может вернуть неожиданные столбцы
```

### ✅ ПРАВИЛЬНО
```sql
SELECT user_id, name, email, phone FROM users;
SELECT user_id, name, age FROM users WHERE age > 25;
SELECT order_id, user_id, total FROM orders LIMIT 10;
```

### ПОЧЕМУ?
- Производительность: меньше данных, меньше сетевой нагрузки
- Читаемость: ясно, какие данные нам нужны
- Стабильность: если добавлен новый столбец, код не ломается
- Индексирование: БД может использовать более эффективные индексы

---

## 3. LIMIT Без ORDER BY

### ❌ НЕПРАВИЛЬНО
```sql
SELECT * FROM users LIMIT 10;  -- Какие 10 пользователей? Непредсказуемо!
```

### ✅ ПРАВИЛЬНО
```sql
-- Топ 10 по дате регистрации
SELECT user_id, name FROM users 
ORDER BY created_at DESC 
LIMIT 10;

-- Первые 10 по алфавиту
SELECT user_id, name FROM users 
ORDER BY name ASC 
LIMIT 10;
```

### ПОЧЕМУ?
- Без ORDER BY результаты неопределенны
- Разные версии БД могут вернуть разные строки
- Для пользователя непредсказуемый результат - это ошибка

---

## 4. Ошибки в WHERE Условиях

### ❌ НЕПРАВИЛЬНО
```sql
-- Сравнение с NULL
WHERE amount = NULL;

-- Строки и числа
WHERE age = '25';  -- Может работать, но нестабильно

-- Даты в неправильном формате
WHERE date = '01/05/2024';  -- Может быть американский формат (май) или европейский (январь)

-- LIKE без подстановочных знаков
WHERE name LIKE 'John';  -- Только точное совпадение

-- OR без скобок (приоритет AND выше OR)
WHERE status = 'active' OR status = 'pending' AND type = 'urgent';
-- Интерпретируется как: (status = 'active') OR (status = 'pending' AND type = 'urgent')
```

### ✅ ПРАВИЛЬНО
```sql
-- NULL правильно
WHERE amount IS NULL;
WHERE amount IS NOT NULL;

-- Числа как числа
WHERE age = 25;

-- Даты в ISO формате
WHERE date >= '2024-01-05' AND date < '2024-01-06';

-- LIKE с подстановочными знаками
WHERE name LIKE '%John%';    -- Содержит John
WHERE name LIKE 'John%';     -- Начинается с John
WHERE name LIKE '%John';     -- Заканчивается на John

-- OR с явными скобками
WHERE (status = 'active' OR status = 'pending') AND type = 'urgent';
WHERE status IN ('active', 'pending') AND type = 'urgent';  -- Еще лучше
```

### ПОЧЕМУ?
- IS NULL правильно проверяет NULL
- Числа как числа используют индексы
- Даты в ISO формате независимы от локали
- LIKE без % работает как =
- Скобки делают намерения ясными

---

## 5. GROUP BY Ошибки

### ❌ НЕПРАВИЛЬНО
```sql
-- Неагрегированный столбец в SELECT
SELECT department, employee_id, AVG(salary) FROM employees GROUP BY department;
-- Ошибка: employee_id не в GROUP BY и не в агрегатной функции

-- HAVING без GROUP BY
SELECT department FROM employees HAVING AVG(salary) > 50000;
-- Ошибка: нет GROUP BY

-- Фильтрация агрегатов в WHERE
SELECT department, AVG(salary) FROM employees 
WHERE AVG(salary) > 50000  -- Ошибка: агрегаты не в WHERE!
GROUP BY department;
```

### ✅ ПРАВИЛЬНО
```sql
-- Все столбцы в SELECT либо в GROUP BY, либо в агрегате
SELECT department, AVG(salary) FROM employees GROUP BY department;

-- HAVING для фильтрации групп
SELECT department, AVG(salary) FROM employees 
GROUP BY department 
HAVING AVG(salary) > 50000;

-- WHERE для строк, HAVING для групп
SELECT department, AVG(salary) FROM employees 
WHERE salary > 30000  -- Фильтруем строки
GROUP BY department 
HAVING AVG(salary) > 50000;  -- Фильтруем группы
```

### ПОЧЕМУ?
- SQL требует, чтобы все неагрегированные столбцы были в GROUP BY
- HAVING работает с группами, WHERE с строками
- Это предотвращает неоднозначные результаты

---

## 6. JOIN Ошибки

### ❌ НЕПРАВИЛЬНО
```sql
-- Забыли условие ON
SELECT * FROM users, orders;  -- Декартово произведение, огромный результат!

-- Неправильное условие JOIN
SELECT * FROM users u
LEFT JOIN orders o ON u.id = o.id;  -- Должно быть user_id, не id!

-- SELECT * с JOIN (какие столбцы откуда?)
SELECT * FROM users u JOIN orders o ON u.id = o.user_id;

-- INNER JOIN когда нужен LEFT JOIN
SELECT u.name, COUNT(o.id) FROM users u
INNER JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name;
-- Не будут показаны пользователи без заказов
```

### ✅ ПРАВИЛЬНО
```sql
-- Явное условие JOIN
SELECT u.user_id, u.name, o.order_id FROM users u
INNER JOIN orders o ON u.user_id = o.user_id;

-- Явное указание столбцов
SELECT u.user_id, u.name, o.order_id, o.total
FROM users u
INNER JOIN orders o ON u.user_id = o.user_id;

-- LEFT JOIN для включения всех пользователей
SELECT u.user_id, u.name, COUNT(o.order_id) AS order_count
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.name
ORDER BY order_count DESC;

-- Быстрая проверка: сколько строк?
SELECT COUNT(*) FROM users;  -- 1000
SELECT COUNT(*) FROM orders;  -- 5000
SELECT COUNT(*) FROM users u INNER JOIN orders o ON u.user_id = o.user_id;  -- ~3000
SELECT COUNT(*) FROM users u LEFT JOIN orders o ON u.user_id = o.user_id;  -- ~1000
```

### ПОЧЕМУ?
- Забытое ON условие создает декартово произведение (огромно!)
- LEFT JOIN включает все строки слева, даже без совпадения
- INNER JOIN только совпадающие строки
- Явный список столбцов понимается, откуда каждый

---

## 7. UPDATE и DELETE Без WHERE (ОЧЕНЬ ОПАСНО!)

### ❌ ОЧЕНЬ ОПАСНО!!!
```sql
UPDATE users SET status = 'inactive';  
-- Обновили ВСЕ пользователей! Отменить невозможно!

DELETE FROM orders;
-- Удалили ВСЕ заказы! Отменить невозможно!

UPDATE products SET price = price * 1.1;
-- Увеличили цену на всех товарах! Даже тех, которые не хотели!
```

### ✅ ПРАВИЛЬНО
```sql
-- Явно указываем, что обновляем
UPDATE users SET status = 'inactive' WHERE created_at < '2020-01-01';

-- Проверяем сначала, сколько строк будет обновлено
SELECT COUNT(*) FROM users WHERE created_at < '2020-01-01';  -- 45 строк - OK

-- Потом выполняем UPDATE
UPDATE users SET status = 'inactive' WHERE created_at < '2020-01-01';

-- Для DELETE ВСЕГДА сначала SELECT
SELECT COUNT(*) FROM orders WHERE total < 100;  -- 5 строк
DELETE FROM orders WHERE total < 100;

-- С транзакцией (если поддерживается)
BEGIN;
DELETE FROM orders WHERE total < 100;
-- Проверяем результат в другой сессии
-- Если ОК: COMMIT; Если нет: ROLLBACK;
```

### ПРАВИЛО
```
Всегда пиши:
1. SELECT с тем же WHERE
2. Проверь количество и содержимое
3. ПОТОМ выполняй UPDATE/DELETE
```

---

## 8. Функции на Индексированных Столбцах

### ❌ НЕПРАВИЛЬНО (Медленно!)
```sql
-- Индекс на колонку не используется
WHERE YEAR(created_at) = 2024;
WHERE UPPER(name) = 'JOHN';
WHERE amount * 1.1 > 1000;
WHERE DATE(timestamp) = '2024-01-05';
```

### ✅ ПРАВИЛЬНО (Быстро!)
```sql
-- Используем диапазон дат
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01';

-- Данные уже в правильном регистре или используем ILIKE (PostgreSQL)
WHERE name = 'John';  -- Если данные хранятся так
WHERE name ILIKE 'john';  -- PostgreSQL case-insensitive

-- Переносим функцию в другую часть
WHERE amount > 1000 / 1.1;

-- Используем дату, а не timestamp функцию
WHERE created_at::date = '2024-01-05';  -- PostgreSQL
WHERE DATE(created_at) = '2024-01-05';  -- MySQL/Oracle
```

### ПОЧЕМУ?
- Функция на каждой строке = полное сканирование таблицы
- Диапазоны используют индексы
- YEAR(date) = 2024 может сканировать 365 дней!

---

## 9. DISTINCT Использованная Неправильно

### ❌ НЕПРАВИЛЬНО
```sql
SELECT DISTINCT * FROM users;  -- Очень медленно, результат как SELECT *

-- Забыли столбцы
SELECT DISTINCT id, name, email FROM users;  -- Удаляет дубли по всем трем столбцам
-- Что если у человека несколько email'ов?
```

### ✅ ПРАВИЛЬНО
```sql
-- Только нужные столбцы
SELECT DISTINCT city FROM users ORDER BY city;

-- Или используй GROUP BY
SELECT city FROM users GROUP BY city ORDER BY city;

-- Если нужны все данные уникально по одному столбцу, используй DISTINCT ON (PostgreSQL)
SELECT DISTINCT ON (user_id) user_id, email, name FROM user_emails;
```

### ПОЧЕМУ?
- DISTINCT замедляет запрос
- GROUP BY часто быстрее для той же цели
- Нужно четко понимать, по каким столбцам ищешь уникальные значения

---

## 10. Типы Данных

### ❌ НЕПРАВИЛЬНО
```sql
-- Сравнение разных типов (может работать, но нестабильно)
WHERE age = '25';         -- Число сравнивается со строкой
WHERE created_at = '2024-01-05';  -- Timestamp сравнивается со строкой

-- Использование текста для чисел
phone VARCHAR;  -- Телефон как строка, но потом сортируем как текст
-- "+79991234567" идет ДО "+799", потому что '7' > '9' в строках!
```

### ✅ ПРАВИЛЬНО
```sql
-- Правильные типы данных
WHERE age = 25;           -- Число как число
WHERE created_at::date = '2024-01-05';  -- Явное преобразование типа

-- Правильные типы в CREATE TABLE
phone VARCHAR(20);        -- Может быть строкой
age INTEGER;              -- Число
created_at TIMESTAMP;     -- Дата и время
salary DECIMAL(10, 2);    -- Деньги с двумя знаками
```

### ПОЧЕМУ?
- Типы обеспечивают правильное сравнение
- Индексы работают правильно
- Сортировка дает ожидаемый результат

---

## 11. IN vs = with OR

### ❌ МОЖЕТ БЫТЬ МЕДЛЕННЕЕ
```sql
WHERE status = 'active' OR status = 'pending' OR status = 'processing';
```

### ✅ БЫСТРЕЕ И ПОНЯТНЕЕ
```sql
WHERE status IN ('active', 'pending', 'processing');
```

### ДА, РАБОТАЕТ ОДИНАКОВО, НО
```sql
-- IN может использовать индексы
-- IN понимается лучше при чтении кода
-- IN работает с подзапросами
WHERE status IN (SELECT status FROM valid_statuses);
```

---

## 12. Забытые Заказы в Результатах

### ❌ НЕПРАВИЛЬНО
```sql
SELECT city, COUNT(*) FROM users;
-- Ошибка: city не в GROUP BY

-- Даже если БД это позволит:
SELECT city, name, COUNT(*) FROM users GROUP BY city;
-- Какой name вернется? Первый? Последний? Случайный?
```

### ✅ ПРАВИЛЬНО
```sql
-- Правильная группировка
SELECT city, COUNT(*) AS user_count FROM users GROUP BY city;

-- Если нужны имена людей из каждого города
SELECT city, STRING_AGG(name, ', ') AS user_names, COUNT(*) AS user_count 
FROM users 
GROUP BY city;
```

---

## Быстрая Справка: Типичные Ошибки

| # | Ошибка | Решение | Последствие |
|---|--------|---------|------------|
| 1 | `WHERE col = NULL` | `WHERE col IS NULL` | 0 результатов ❌ |
| 2 | `SELECT *` | `SELECT col1, col2` | Медленно, нестабильно |
| 3 | `LIMIT без ORDER BY` | Добавить `ORDER BY` | Непредсказуемо |
| 4 | `UPDATE без WHERE` | Добавить `WHERE` | ДА, БЕЗ СТИРАЕМ ВСЕ! |
| 5 | `DELETE без WHERE` | Добавить `WHERE` | ДА, БЕЗ УДАЛЯЕМ ВСЕ! |
| 6 | `YEAR(col) = 2024` | Использовать диапазон | Медленно, индекс не работает |
| 7 | `JOIN без ON` | Добавить `ON` условие | Декартово произведение 💥 |
| 8 | `GROUP BY неполный` | Все столбцы в GROUP BY | Ошибка SQL |
| 9 | `DISTINCT *` | Конкретные столбцы | Очень медленно |
| 10 | `WHERE в агрегате` | Использовать `HAVING` | Ошибка SQL |

---

## Как Проверить Свой Запрос?

### Перед выполнением UPDATE/DELETE:

```sql
-- Шаг 1: Проверьте SELECT с тем же WHERE
SELECT * FROM table WHERE condition;

-- Шаг 2: Посчитайте сколько строк
SELECT COUNT(*) FROM table WHERE condition;

-- Шаг 3: Посмотрите примеры
SELECT * FROM table WHERE condition LIMIT 5;

-- Шаг 4: ПОТОМ выполняйте UPDATE/DELETE
UPDATE table SET col = value WHERE condition;
```

---

## Итоговый Checklist

Перед отправкой запроса убедитесь:

- [ ] Нет WHERE col = NULL (используйте IS NULL)
- [ ] Нет SELECT * (явный список столбцов)
- [ ] Есть ORDER BY перед LIMIT
- [ ] LIMIT без ORDER BY только если порядок не важен
- [ ] JOIN имеет ON условие
- [ ] GROUP BY включает все неагрегированные столбцы
- [ ] HAVING, а не WHERE для фильтрации групп
- [ ] UPDATE/DELETE имеют WHERE (проверили количество перед выполнением!)
- [ ] Правильные типы данных в условиях
- [ ] Нет функций на индексированных столбцах в WHERE (где возможно)

---

**Помните:** Лучший способ избежать ошибок - видеть примеры ошибок других. Учитесь на чужих ошибках!
