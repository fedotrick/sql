# SQL Best Practices и Руководство по Написанию Качественного Кода

## Введение

Этот документ содержит лучшие практики для написания SQL запросов, которые будут отличаться производительностью, читаемостью и поддерживаемостью.

---

## 1. Выбор Столбцов (SELECT)

### ❌ ПЛОХО
```sql
SELECT * FROM users;
SELECT * FROM users WHERE age > 25;
SELECT * FROM products WHERE category = 'electronics';
```

### ✅ ХОРОШО
```sql
SELECT user_id, first_name, last_name, email FROM users;
SELECT user_id, first_name, age FROM users WHERE age > 25;
SELECT product_id, name, price FROM products WHERE category = 'electronics';
```

### ПОЧЕМУ?
- Явное указание столбцов улучшает производительность (меньше передается данных)
- Делает код более читаемым и понятным
- Защищает код от ошибок при добавлении новых столбцов
- Помогает оптимизировать индексы

---

## 2. Фильтрация Данных (WHERE)

### ❌ ПЛОХО
```sql
-- Получаем все данные в приложение и фильтруем там
SELECT * FROM orders;

-- Сравнение с NULL используя =
SELECT * FROM users WHERE middle_name = NULL;

-- Функция в WHERE без индекса
SELECT * FROM users WHERE UPPER(last_name) = 'SMITH';

-- Сложные условия без скобок
SELECT * FROM orders WHERE date > '2024-01-01' AND status = 'pending' OR type = 'rush';
```

### ✅ ХОРОШО
```sql
-- Фильтруем на уровне БД
SELECT * FROM orders WHERE created_at > '2024-01-01';

-- Правильно проверяем на NULL
SELECT * FROM users WHERE middle_name IS NULL;
SELECT * FROM users WHERE middle_name IS NOT NULL;

-- Избегаем функций на столбцах в WHERE
SELECT * FROM users WHERE last_name = 'Smith';

-- Явные скобки для ясности
SELECT * FROM orders 
WHERE date > '2024-01-01' 
  AND (status = 'pending' OR type = 'rush');
```

### ОБЩИЕ ОШИБКИ

| Ошибка | Правильное Решение |
|--------|-------------------|
| `WHERE col = NULL` | `WHERE col IS NULL` |
| `WHERE col != NULL` | `WHERE col IS NOT NULL` |
| `WHERE col <> NULL` | `WHERE col IS NOT NULL` |
| `WHERE UPPER(col) = 'X'` | `WHERE col = 'X'` (если данные уже в верхнем регистре) |
| `WHERE date = '2024-01-01'` | `WHERE date >= '2024-01-01' AND date < '2024-01-02'` |

---

## 3. Использование JOIN'ов

### ❌ ПЛОХО
```sql
-- Вложенные подзапросы вместо JOIN
SELECT * FROM users WHERE user_id IN (
    SELECT user_id FROM orders WHERE created_at > '2024-01-01'
);

-- Декартово произведение (забытое условие JOIN)
SELECT * FROM users, orders;

-- Неспецифицированные условия JOIN
SELECT * FROM users, orders WHERE users.id = orders.user_id;
```

### ✅ ХОРОШО
```sql
-- Явный INNER JOIN
SELECT u.user_id, u.name, o.order_id, o.total
FROM users u
INNER JOIN orders o ON u.user_id = o.user_id
WHERE o.created_at > '2024-01-01';

-- Явно указываем нужные столбцы
SELECT 
    u.user_id, 
    u.name, 
    COUNT(o.order_id) AS order_count
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.name;
```

### ТИПЫ JOIN'ов

```sql
-- INNER JOIN - только совпадающие записи
SELECT a.id, b.id FROM table_a a
INNER JOIN table_b b ON a.id = b.a_id;

-- LEFT JOIN - все записи слева + совпадающие справа
SELECT a.id, b.id FROM table_a a
LEFT JOIN table_b b ON a.id = b.a_id;

-- RIGHT JOIN - совпадающие слева + все записи справа
SELECT a.id, b.id FROM table_a a
RIGHT JOIN table_b b ON a.id = b.a_id;

-- FULL OUTER JOIN - все записи из обеих таблиц
SELECT a.id, b.id FROM table_a a
FULL OUTER JOIN table_b b ON a.id = b.a_id;

-- CROSS JOIN - декартово произведение
SELECT a.id, b.id FROM table_a a
CROSS JOIN table_b b;
```

---

## 4. Агрегирование и Группировка

### ❌ ПЛОХО
```sql
-- Нет GROUP BY, но есть неагрегированный столбец
SELECT department, employee_id, salary FROM salaries;

-- DISTINCT вместо GROUP BY
SELECT DISTINCT department FROM salaries;

-- Агрегирование без ORDER BY
SELECT department, AVG(salary) FROM salaries GROUP BY department;

-- HAVING без GROUP BY
SELECT department, AVG(salary) FROM salaries HAVING AVG(salary) > 50000;
```

### ✅ ХОРОШО
```sql
-- Правильная группировка
SELECT 
    department, 
    COUNT(*) AS employee_count,
    AVG(salary) AS avg_salary,
    MIN(salary) AS min_salary,
    MAX(salary) AS max_salary
FROM salaries
GROUP BY department
ORDER BY avg_salary DESC;

-- HAVING для фильтрации групп
SELECT 
    department,
    COUNT(*) AS employee_count,
    AVG(salary) AS avg_salary
FROM salaries
GROUP BY department
HAVING COUNT(*) > 5 AND AVG(salary) > 50000
ORDER BY avg_salary DESC;
```

### ПРАВИЛО: Все столбцы в SELECT должны быть либо в GROUP BY, либо в функции агрегирования

```sql
-- ПЛОХО (department не в GROUP BY)
SELECT department, employee_name, AVG(salary) FROM salaries GROUP BY department;

-- ХОРОШО
SELECT department, AVG(salary) FROM salaries GROUP BY department;
```

---

## 5. Порядок Сортировки и Ограничение

### ❌ ПЛОХО
```sql
-- LIMIT без ORDER BY - непредсказуемый результат
SELECT * FROM users LIMIT 10;

-- Сортировка по нескольким столбцам без явного направления
SELECT * FROM orders ORDER BY status, created_at;

-- ORDER BY с неправильным типом данных
SELECT * FROM products ORDER BY price; -- если цена хранится как текст
```

### ✅ ХОРОШО
```sql
-- LIMIT с явным ORDER BY
SELECT user_id, name, created_at 
FROM users 
ORDER BY created_at DESC 
LIMIT 10;

-- Явное направление сортировки
SELECT order_id, status, created_at 
FROM orders 
ORDER BY status ASC, created_at DESC;

-- Использование OFFSET для пагинации
SELECT user_id, name 
FROM users 
ORDER BY created_at DESC 
LIMIT 10 OFFSET 20;  -- Показать записи с 21 по 30
```

---

## 6. Использование CTE (Common Table Expressions)

### ❌ ПЛОХО
```sql
-- Глубоко вложенные подзапросы (spaghetti code)
SELECT * FROM (
    SELECT * FROM (
        SELECT * FROM users WHERE age > 25
    ) sub1
    WHERE status = 'active'
) sub2;
```

### ✅ ХОРОШО
```sql
-- Читаемый CTE
WITH active_users AS (
    SELECT user_id, name, age 
    FROM users 
    WHERE age > 25 AND status = 'active'
)
SELECT user_id, name, age 
FROM active_users
ORDER BY age DESC;

-- Несколько CTE
WITH active_orders AS (
    SELECT order_id, user_id, total
    FROM orders
    WHERE status = 'completed'
),
high_value_orders AS (
    SELECT order_id, user_id, total
    FROM active_orders
    WHERE total > 1000
)
SELECT u.name, COUNT(h.order_id) AS high_value_count
FROM users u
LEFT JOIN high_value_orders h ON u.user_id = h.user_id
GROUP BY u.user_id, u.name;
```

---

## 7. Использование Индексов

### ❌ ПЛОХО
```sql
-- Поиск по неиндексированному столбцу
SELECT * FROM users WHERE email = 'test@example.com'; -- email не индексирован

-- Функция на индексированном столбце
SELECT * FROM users WHERE YEAR(created_at) = 2024;

-- OR с неиндексированными столбцами
SELECT * FROM users WHERE UPPER(name) = 'JOHN' OR age > 30;
```

### ✅ ХОРОШО
```sql
-- Используем индексированные столбцы
SELECT * FROM users WHERE email = 'test@example.com';

-- Диапазон вместо функции на столбце
SELECT * FROM users 
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01';

-- Правильное использование OR
SELECT * FROM users 
WHERE id = 123 OR email = 'test@example.com';
```

---

## 8. Оптимизация с EXPLAIN и EXPLAIN ANALYZE

### Как читать план выполнения запроса:

```sql
-- Смотрим план выполнения (оценочные значения)
EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';

-- Выполняем запрос и видим фактические значения
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
```

**Ищите:**
- ❌ Sequential Scan (полное сканирование таблицы) - может быть медленно
- ✅ Index Scan (сканирование индекса) - обычно быстро
- Большое расхождение между плановыми и фактическими строками - признак проблемы

---

## 9. Форматирование и Читаемость

### ❌ ПЛОХО
```sql
SELECT u.id,u.name,u.email,o.id,o.total FROM users u INNER JOIN orders o ON u.id=o.user_id WHERE u.status='active' AND o.total>1000 ORDER BY o.total DESC LIMIT 10;
```

### ✅ ХОРОШО
```sql
SELECT 
    u.user_id,
    u.name,
    u.email,
    o.order_id,
    o.total
FROM users u
INNER JOIN orders o ON u.user_id = o.user_id
WHERE u.status = 'active' 
  AND o.total > 1000
ORDER BY o.total DESC
LIMIT 10;
```

### ПРАВИЛА ФОРМАТИРОВАНИЯ

1. **Каждое ключевое слово на новой строке:**
   - SELECT, FROM, JOIN, WHERE, GROUP BY, HAVING, ORDER BY

2. **Отступы для условий:**
   - Используйте 2-4 пробела
   - Выравнивайте условия в WHERE

3. **Используйте псевдонимы таблиц:**
   - `FROM users u` вместо `FROM users`
   - `INNER JOIN orders o ON u.id = o.user_id`

4. **Комментарии:**
   ```sql
   -- Получаем активных пользователей с крупными заказами
   SELECT u.id, u.name, COUNT(o.id) AS order_count
   FROM users u
   INNER JOIN orders o ON u.id = o.user_id
   WHERE u.status = 'active'
   GROUP BY u.id, u.name;
   ```

---

## 10. Безопасность

### ❌ ПЛОХО (SQL Injection)
```python
# Опасно!
query = f"SELECT * FROM users WHERE email = '{user_input}'"
# Если user_input = "'; DROP TABLE users; --"
```

### ✅ ХОРОШО
```python
# Используйте параметризованные запросы
query = "SELECT * FROM users WHERE email = %s"
cursor.execute(query, (user_input,))
```

---

## 11. Типичные Ошибки и Как Их Избежать

| Ошибка | Причина | Решение |
|--------|---------|---------|
| Медленные запросы | Нет индекса | Создайте индекс на столбцах в WHERE |
| Неправильные результаты JOIN | Пропущено условие ON | Проверьте условие JOIN |
| NULL значения в результатах | Использован LEFT JOIN | Используйте INNER JOIN если нужны только совпадения |
| Дублирующиеся данные | Забыт DISTINCT | Добавьте DISTINCT или GROUP BY |
| Неправильный count | COUNT(*) с NULL | Используйте COUNT(column) исключить NULL |

---

## 12. Производительность

### Checklist Оптимизации

- [ ] Использованы ли индексы в WHERE и JOIN?
- [ ] Отфильтрованы ли данные на уровне БД, а не в приложении?
- [ ] Избежаны ли функции на столбцах в WHERE?
- [ ] Используется ли LIMIT для больших наборов данных?
- [ ] Правильно ли используются JOIN вместо подзапросов?
- [ ] Удалены ли ненужные столбцы из SELECT?
- [ ] Проверены ли результаты EXPLAIN ANALYZE?

---

## Заключение

Хороший SQL код:
1. **Читаемый** - легко понять, что делает запрос
2. **Производительный** - быстро выполняется даже на большом объеме данных
3. **Поддерживаемый** - легко изменить и расширить
4. **Безопасный** - защищен от SQL injection и других атак

Практикуйте эти принципы каждый день, и ваш код будет значительно лучше!
