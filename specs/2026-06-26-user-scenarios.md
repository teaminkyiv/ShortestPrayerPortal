# User Scenarios — Admin Panel

**Date:** 2026-06-26  
**Связан с:** `2026-06-26-admin-panel-prd.md`  
**Назначение:** Основа для BDD / Behavior тестов. Каждый сценарий содержит Acceptance Criteria в формате Given / When / Then.

---

## US-1 — Вход в систему

### Scenario 1.1: Успешный вход с верным паролем

```
Given пользователь открывает /admin/login
When он вводит верный пароль и нажимает "Войти"
Then устанавливается httpOnly session cookie
And пользователь перенаправляется на /admin
```

**Acceptance Criteria:**
- Cookie установлена с флагами `httpOnly`, `secure`, `sameSite=strict`
- Время жизни cookie — 7 дней
- Редирект на `/admin` происходит после успешного входа

---

### Scenario 1.2: Неверный пароль

```
Given пользователь открывает /admin/login
When он вводит неверный пароль и нажимает "Войти"
Then отображается сообщение "Неверный пароль"
And cookie не устанавливается
And пользователь остаётся на /admin/login
```

**Acceptance Criteria:**
- Сообщение об ошибке не уточняет что именно неверно
- Форма не очищается (пользователь видит что ввёл)

---

### Scenario 1.3: Доступ к защищённому роуту без сессии

```
Given у пользователя нет валидной session cookie
When он переходит на /admin или любой /admin/* роут (кроме /admin/login)
Then он перенаправляется на /admin/login
```

**Acceptance Criteria:**
- Middleware перехватывает запрос до рендера страницы
- Редирект работает для всех вложенных путей: `/admin`, `/admin/testimonies`, `/admin/testimonies/[id]`

---

### Scenario 1.4: Истечение сессии

```
Given пользователь был авторизован, но cookie истекла (> 7 дней)
When он переходит на любой /admin/* роут
Then он перенаправляется на /admin/login
```

---

### Scenario 1.5: Выход из системы `[deferred: не в MVP]`

> Явная кнопка logout и роут `/admin/logout` не реализуются в MVP. Сессия завершается автоматически по истечении 7 дней.

---

## US-2 — Dashboard

### Scenario 2.1: Отображение счётчиков

```
Given пользователь авторизован и открывает /admin
When страница загружается
Then он видит три счётчика: "new", "summarized", "published"
And счётчик "new" выделен красным/оранжевым если значение > 0
```

**Acceptance Criteria:**
- Счётчики отражают актуальные данные из `testimony_reviews`
- Если `new` = 0 — счётчик отображается без выделения

---

### Scenario 2.2: Таблица последних свидетельств

```
Given пользователь авторизован и открывает /admin
When страница загружается
Then он видит таблицу последних 20 свидетельств
And каждая строка содержит: Telegram ID, язык, дату завершения, статус
And строки отсортированы по дате (новые сначала)
```

**Acceptance Criteria:**
- Максимум 20 строк на Dashboard
- Свидетельства со статусом `finished` в `testimonies` и без записи в `testimony_reviews` не отображаются (они попадают через webhook)
- Дата — `testimonies.created_at`

---

## US-3 — Список свидетельств

### Scenario 3.1: Фильтр по статусу

```
Given пользователь на /admin/testimonies
When он выбирает фильтр "new"
Then в таблице отображаются только свидетельства со статусом "new" в testimony_reviews
```

**Acceptance Criteria:**
- Доступные фильтры: `all`, `new`, `summarized`, `published`
- По умолчанию: `all`
- Фильтр отражается в URL query param (`?status=new`) для возможности поделиться ссылкой

---

### Scenario 3.2: Пагинация

```
Given на /admin/testimonies более 20 свидетельств
When пользователь открывает страницу
Then отображаются первые 20 записей
And доступны кнопки пагинации
When он переходит на страницу 2
Then отображаются следующие 20 записей
```

**Acceptance Criteria:**
- 20 записей per page
- Текущая страница отражается в URL (`?page=2`)

---

### Scenario 3.3: Сортировка

```
Given пользователь на /admin/testimonies
When страница загружается
Then записи отсортированы по testimonies.created_at DESC (новые сначала)
```

---

## US-4 — Просмотр сырых чанков

### Scenario 4.1: Отображение чанков на детальной странице

```
Given пользователь открывает /admin/testimonies/[id]
When страница загружается
Then он видит все чанки свидетельства в хронологическом порядке
And каждый чанк содержит порядковый номер и временную метку (created_at)
```

**Acceptance Criteria:**
- Чанки загружаются из таблицы `chunks` по `testimony_id`
- Порядок — по `chunks.created_at` ASC
- Если чанков нет — отображается сообщение "Нет сообщений"

---

### Scenario 4.2: Метаданные свидетельства

```
Given пользователь открывает /admin/testimonies/[id]
When страница загружается
Then он видит: Telegram ID пользователя, язык, дату создания, текущий статус
```

---

## US-5 — AI Summary

### Scenario 5.1: Генерация summary для нового свидетельства

```
Given свидетельство имеет статус "new" и ai_summary = null
When редактор нажимает "Generate Summary"
Then кнопка блокируется и показывает spinner
When генерация завершается
Then отображается текст summary
And статус меняется на "summarized"
And поле summarizedAt заполняется
```

**Acceptance Criteria:**
- Summary генерируется из всех чанков с учётом языка пользователя (`users.language`)
- Кнопка недоступна во время запроса
- При ошибке API — показывается toast, статус не меняется

---

### Scenario 5.2: Регенерация summary

```
Given свидетельство имеет статус "summarized" и ai_summary заполнен
When редактор нажимает "Regenerate"
Then генерируется новый summary
And старый summary заменяется новым
And статус остаётся "summarized"
```

**Acceptance Criteria:**
- Кнопка "Regenerate" доступна при наличии существующего summary
- Подтверждение перед перезаписью не требуется (MVP)

---

## US-6 — Редактирование и публикация

### Scenario 6.1: Сохранение черновика

```
Given редактор на странице свидетельства вводит текст в поле editedVersion
When он нажимает "Save draft"
Then текст сохраняется в testimony_reviews.editedVersion
And статус не меняется
And показывается уведомление "Сохранено"
```

**Acceptance Criteria:**
- Кнопка "Save draft" доступна при любом статусе кроме `published`
- Сохранение не меняет `status`, `publishedAt`, `publishedBy`

---

### Scenario 6.2: Публикация свидетельства

```
Given редактор заполнил поле editedVersion
When он нажимает "Publish"
Then статус меняется на "published"
And publishedAt заполняется текущим временем
And publishedBy заполняется значением "admin"
And все поля становятся read-only
```

**Acceptance Criteria:**
- Кнопка "Publish" недоступна если editedVersion пустой
- После публикации кнопки "Save draft" и "Publish" исчезают
- Отображается: "Опубликовано: [дата]"

---

### Scenario 6.3: Pre-fill из AI summary

```
Given свидетельство имеет ai_summary
When редактор открывает страницу свидетельства
Then поле editedVersion предзаполнено текстом ai_summary
```

**Acceptance Criteria:**
- Pre-fill происходит только если editedVersion ещё не заполнен вручную
- Если editedVersion уже есть — показывается editedVersion, не summary

---

### Scenario 6.4: Просмотр опубликованного свидетельства

```
Given свидетельство имеет статус "published"
When редактор открывает его страницу
Then все поля отображаются в режиме read-only
And видна дата публикации (publishedAt)
```

---

## US-9 — Webhook от бота

### Scenario 9.1: Успешное создание testimony_review

```
Given бот завершает свидетельство (testimonies.status = 'finished')
When бот отправляет POST /api/webhooks/testimony-finished
  с телом { "testimonyId": "<uuid>" }
  и заголовком X-Webhook-Secret: <WEBHOOK_SECRET>
Then в testimony_reviews создаётся запись со статусом "new"
And возвращается HTTP 200
```

**Acceptance Criteria:**
- Если запись для этого `testimonyId` уже существует — возвращается 200 (idempotent, без ошибки)
- `testimony_id` должен существовать в таблице `testimonies`

---

### Scenario 9.2: Неверный webhook secret

```
Given бот отправляет POST /api/webhooks/testimony-finished
  с неверным или отсутствующим X-Webhook-Secret
Then возвращается HTTP 401
And запись в testimony_reviews не создаётся
```

**Acceptance Criteria:**
- Endpoint не раскрывает причину отказа в теле ответа

---

### Scenario 9.3: Несуществующий testimonyId

```
Given бот отправляет POST /api/webhooks/testimony-finished
  с testimonyId которого нет в таблице testimonies
Then возвращается HTTP 404
And запись в testimony_reviews не создаётся
```
