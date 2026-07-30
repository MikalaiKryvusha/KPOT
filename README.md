<p align="center">
  <img src="assets/KPOT.jpg" alt="KPOT — Krinik Photo Organizer Tool" width="420">
</p>

# KPOT — Krinik Photo Organizer Tool

![License](https://img.shields.io/badge/license-MIT-green)
![Release](https://img.shields.io/badge/release-0.2%20«Obvius%20KPOT»-blue)
![Interface](https://img.shields.io/badge/интерфейс-окно%20·%20командная%20строка-brightgreen)
![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen)
![Platform](https://img.shields.io/badge/platform-Windows--first-blue)

---

## Русский

[Read in English →](#english)

**KPOT** — программа для приведения домашнего фото-видео архива в хронологический порядок.
Программа определяет, когда снят каждый файл, находит одинаковые копии и раскладывает файлы по
каталогам года и поры года, сохраняя имена файлов и осмысленные названия каталогов.

Работа с программой возможна двумя способами:

- **графический интерфейс** в окне браузера — управление мышью, ввод команд не требуется. Интернет
  не нужен: программа работает на компьютере пользователя и не обращается к сети;
- **интерфейс командной строки** — те же действия отдельными командами.

Оба способа вызывают один и тот же исполнитель, поэтому результат работы не зависит от выбранного
способа.

Настоящий документ является руководством пользователя.

---

## 1. Назначение

### 1.1. Основные положения

1. Исходным материалом является каталог с фотографиями и видеозаписями произвольной структуры,
   включая каталоги со случайными названиями, выгрузки с телефонов и фотоаппаратов, загрузки из
   мессенджеров и копии одного снимка под разными именами в разных каталогах.
2. Результатом работы является **библиотека** — дерево каталогов, в котором каждый файл размещён в
   каталоге года съёмки и каталоге поры года.
3. Дата съёмки устанавливается по уликам, содержащимся в самих файлах и в их окружении, по правилам
   раздела 6. Если установить дату не удалось, то файл размещается в каталоге `ПРОЧЕЕ`, и вымышленная
   дата ему не назначается.
4. Перемещение файла выполняется средствами файловой системы. Копирование с последующим удалением не
   применяется, поэтому объём обрабатываемых данных влияет на время работы незначительно.
5. Программа не изменяет содержимое файлов и не изменяет их метаданные. Единственным действием над
   файлом пользователя является его перемещение.
6. Программа работает на одном компьютере. Доступ с других устройств не предусмотрен.

### 1.2. Границы применения

1. Просмотр изображений не входит в состав программы: там, где требуется взгляд, интерфейс открывает
   каталог средствами операционной системы.
2. Редактирование, конвертация, изменение размера и прочая обработка изображений не выполняются.
3. Отправка данных в сеть не выполняется ни при каких условиях.

---

## 2. Установка и запуск

### 2.1. Основные положения

1. Программа поставляется двумя способами: портативным пакетом и пакетом npm. Портативный пакет
   предназначен для пользователя, не работающего с командной строкой.
2. Установка в системном смысле не выполняется: программа не вносит записей в реестр, не требует
   прав администратора и не устанавливает служб.

### 2.2. Запуск портативного пакета

Портативный пакет предназначен для операционной системы Windows и содержит собственную среду
выполнения, поэтому установка каких-либо других программ не требуется.

1. Загрузить пакет
   **[KPOT-0.2.0-win-x64.zip](https://github.com/MikalaiKryvusha/KPOT/releases/download/v0.2/KPOT-0.2.0-win-x64.zip)**
   (33 МБ).
2. Распаковать каталог целиком в любое место.
3. Запустить файл **`KPOT.cmd`** двойным щелчком.
4. Дождаться открытия окна браузера. Дальнейшая работа выполняется по правилам раздела 7.

При первом запуске программа предлагает разместить ярлык на рабочем столе. Ярлык создаётся только
по согласию пользователя.

### 2.3. Предупреждение операционной системы при первом запуске

1. Файлы, распакованные из загруженного архива, получают признак «файл получен из сети». При запуске
   такого файла Windows может вывести окно **«Открыть файл — предупреждение системы безопасности»**.
2. Появление данного окна означает, что файл загружен, а не создан на этом компьютере. Для
   продолжения работы следует нажать кнопку **«Запустить»**.
3. Посторонних программ пакет не содержит. В состав пакета входят текстовые файлы программы и
   официальный файл `node.exe`, подписанный OpenJS Foundation.

### 2.4. Запуск из командной строки

Требуется Node.js версии 20 или выше. Сборка не выполняется, нативные модули отсутствуют, число
зависимостей времени выполнения равняется двум.

```bash
# установка из релиза
npm i -g https://github.com/MikalaiKryvusha/KPOT/releases/download/v0.2/kpot-0.2.0.tgz
kpot --help

# либо запуск из исходных текстов
git clone https://github.com/MikalaiKryvusha/KPOT.git && cd KPOT && npm i
node bin/kpot.mjs --help
```

Команда `kpot ui` открывает то же окно, что и портативный пакет.

---

## 3. Устройство библиотеки

### 3.1. Основные положения

1. Библиотека размещается в том же каталоге, который был указан для разбора. Второй каталог не
   создаётся и копия архива не делается.
2. Имена файлов сохраняются. Осмысленные названия каталогов сохраняются: если файлы лежали в
   каталоге с содержательным названием, то данное название переносится вместе с ними.
3. Каталог года содержит каталоги пор года. Перечень пор года и их границы приведены в Таблице 1.

Таблица 1 — Поры года и соответствующие им месяцы

| Каталог поры года | Месяцы |
|---|---|
| `Зима начало года` | январь, февраль |
| `Весна` | март, апрель, май |
| `Лето` | июнь, июль, август |
| `Осень` | сентябрь, октябрь, ноябрь |
| `Зима конец года` | декабрь |

Две зимы разделены намеренно: при таком разделении содержимое каталога года читается в
хронологическом порядке.

### 3.2. Служебные каталоги

Перечень служебных каталогов библиотеки приведён в Таблице 2.

Таблица 2 — Служебные каталоги библиотеки

| Каталог | Назначение |
|---|---|
| `<год>/прочее` | год съёмки установлен, пора года не установлена |
| `ПРОЧЕЕ` | дату съёмки установить не удалось |
| `ПРОЧЕЕ/_дубликаты` | вторые и последующие копии одного файла; происхождение каждой копии сохраняется в её имени |
| `ПРОЧЕЕ/_мусор` | системные файлы операционной системы: `Thumbs.db`, `desktop.ini` и прочее |
| `НА_РАЗБОР` | каталоги, о которых требуется решение пользователя (раздел 3.3) |
| `НОВОЕ` | каталог для пополнения библиотеки (раздел 9) |
| `.kpot-runs` | служебные данные программы: карты, резервные копии, журналы прогонов |

Файлы, не являющиеся фотографиями, видеозаписями или звукозаписями, не перемещаются. Такие файлы
остаются на своих местах и перечисляются в отчёте.

### 3.3. Каталоги, требующие решения пользователя

1. Если название каталога не позволяет установить, создан ли данный каталог пользователем или
   программой, то содержимое такого каталога не разбирается, а сам каталог помещается в `НА_РАЗБОР`
   с сохранением исходной структуры.
2. Каталог помещается в `НА_РАЗБОР` только в том случае, если его разбор действительно привёл бы к
   рассеиванию содержимого по библиотеке.
3. Перечень таких каталогов записывается программой в файл `.kpot-runs/папки-на-согласование.txt`.
   Против каждого каталога после знака `=` указывается одно из двух решений: **`сортировать`** —
   разобрать содержимое по годам и порам года наравне с остальными файлами; **`как есть`** —
   оставить каталог в `НА_РАЗБОР` целиком, не разбирая.
4. После указания решений программа запускается повторно. Записанные решения сохраняются между
   прогонами.

### 3.4. Расписка

1. После выполненной сортировки в корне библиотеки размещается текстовый файл
   **`KPOT — что здесь сделано.txt`**.
2. Расписка содержит перечень прогонов, действующих в настоящее время, дату и время каждого прогона,
   число перемещённых файлов и порядок возврата каждого прогона.
3. По наличию расписки программа определяет, разбиралась ли данная папка ранее. Если расписка
   отсутствует, то папка считается неразобранной.
4. Прогон, возвращённый по правилам раздела 4.5, удаляется из расписки. Если возвращены все
   прогоны, то расписка удаляется целиком.
5. Удаление расписки пользователем допускается. Фотографии при этом не изменяются; программа
   предложит начать разбор с самого начала.

---

## 4. Порядок работы

### 4.1. Основные положения

1. Работа состоит из четырёх фаз: изучение, план, сортировка, возврат. Фазы выполняются в указанном
   порядке.
2. Фазы изучения и плана не изменяют архив. Данные фазы записывают только в служебный каталог
   `.kpot-runs`.
3. Перемещение файлов выполняется исключительно в фазе сортировки и исключительно по явной команде
   пользователя.

### 4.2. Изучение

1. Программа обходит дерево каталогов и определяет тип каждого файла.
2. Тип файла определяется по его содержимому, а не по расширению. Расширение является ненадёжным
   признаком: в реальных архивах встречаются действительные изображения с произвольным расширением.
3. Для каждого файла в отдельности собираются улики о дате съёмки по правилам раздела 6.
4. Одинаковые копии определяются по содержимому файлов, а не по их именам.

### 4.3. План

1. Результатом фазы является **пред-сортировочный мастер-план** — документ, описывающий все
   предстоящие действия до того, как выполнено первое из них.
2. План содержит: число найденных файлов; число файлов, подлежащих перемещению; целевое размещение
   каждого файла и улику, на основании которой оно назначено; перечень одинаковых копий; перечень
   спорных случаев; перечень совпадений имён; перечень каталогов, которые опустеют; перечень
   каталогов, требующих решения пользователя.
3. Ни один файл в фазе плана не перемещается.

### 4.4. Сортировка

1. Сортировка выполняет ровно те действия, которые описаны в плане.
2. Сортировка не начинается до создания проверенной резервной копии по правилам раздела 5.
3. Репетиция сортировки выполняется тем же кодом, что и настоящая сортировка, с отключённой записью.
   Вторая реализация не применяется, поэтому расхождение репетиции с настоящим прогоном исключено.
4. Каждое намерение записывается в журнал до его исполнения. Прерванный прогон допускается
   продолжить; после продолжения один возврат по-прежнему отменяет прогон целиком.
5. Сортировка уже разобранной библиотеки не перемещает ничего.

### 4.5. Возврат

1. Возврат восстанавливает состояние архива, предшествовавшее указанному прогону: файлы
   возвращаются на прежние места, а каталоги, удалённые при сортировке, создаются заново.
2. Возврат выполняется по идентификатору прогона. Идентификатор приведён в отчёте о сортировке и в
   расписке.
3. Возврат допускается выполнить как из окна программы, так и из командной строки.

---

## 5. Гарантии безопасности

### 5.1. Основные положения

Перемещение файлов не выполняется до тех пор, пока не выполнены все четыре условия:

1. **Карта.** Составлен план с указанием целевого размещения каждого файла и улики, на основании
   которой данное размещение назначено.
2. **Резервная копия.** Создан перечень всех файлов и всех каталогов, а также моментальный снимок
   архива на жёстких ссылках. Снимок на жёстких ссылках не занимает места на диске.
3. **Репетиция.** Выполнен полный прогон без единой записи.
4. **Путь возврата.** Отчёт о сортировке содержит идентификатор прогона, по которому выполняется
   возврат.

### 5.2. Проверка возможности создания снимка

1. Возможность создания жёстких ссылок проверяется опытом, а не предположением.
2. Если файловая система не поддерживает жёсткие ссылки — например, exFAT или FAT32, — то прогон
   останавливается и требует явного указания ключа `--allow-no-snapshot`.
3. При работе с указанным ключом структура архива остаётся восстановимой, а содержимое файлов
   защиты не имеет. Указание данного ключа является решением пользователя.

### 5.3. Спорные случаи

1. Спорным является случай, при котором улики о дате съёмки противоречат друг другу.
2. Спорные случаи не разрешаются молча. Каждый спорный случай приводится в плане с перечислением
   всех улик, включая отвергнутые.
3. Решение по спорному случаю принимает пользователь.

---

## 6. Установление даты съёмки

### 6.1. Основные положения

1. Датой съёмки является дата, подтверждённая уликой. Дата, не подтверждённая уликой, датой съёмки
   не считается.
2. Улики упорядочены по достоверности. Перечень улик приведён в Таблице 3 в порядке убывания
   достоверности.
3. Для каждого файла в отдельности сохраняется как принятая улика, так и все отвергнутые улики.
4. Время изменения файла в файловой системе решающего значения не имеет: массовое копирование
   архива изменяет данное время у всех файлов одновременно.
5. Если ни одна улика не найдена, то результатом является «дата не установлена». Данный результат
   является полноценным ответом, и файл размещается в каталоге `ПРОЧЕЕ`.

Таблица 3 — Перечень источников даты съёмки в порядке убывания достоверности

| № | Источник | Описание |
|---|---|---|
| 1 | `exif-original` | момент съёмки, записанный фотоаппаратом в метаданные EXIF |
| 2 | `derived-original` | момент съёмки оригинала, унаследованный по точному совпадению идентификаторов XMP `DocumentID` и `DerivedFrom` |
| 3 | `pixel-original` | момент съёмки оригинала, унаследованный после нахождения данного оригинала по пикселям (раздел 6.3) |
| 4 | `filename-timestamp` | полная дата и время, записанные устройством в имя файла |
| 5 | `container-created` | дата создания, записанная в контейнер видеозаписи MP4 или MOV |
| 6 | `filename-epoch` | время в формате unix, записанное в имя файла |
| 7 | `exif-modify` | дата изменения в метаданных EXIF |
| 8 | `sidecar` | метаданные файла-спутника `THM` или `XMP`, унаследованные медиафайлом |
| 9 | `dirname` | год и пора года в названии одного из родительских каталогов |
| 10 | `filename-year` | год в имени файла без указания месяца и дня |
| 11 | `family` | предположение по семейству фотоаппарата: соседние файлы того же фотоаппарата дают один год |
| 12 | `dir-cohort` | предположение по соседям: файлы того же каталога, дата которых установлена достоверно |
| 13 | `editor-save` | дата сохранения файла графическим редактором; является верхней границей «снято не позже» и решающего значения не имеет |
| 14 | `fs-mtime` | время изменения файла в файловой системе |

### 6.2. Отклонение недостоверных заявок

1. Заявленный год ранее 1990 достоверным не считается: бытовая цифровая фотография в указанное
   время не существовала.
2. Заявка сброшенных часов фотоаппарата — например, «1 января, 00:25» — отклоняется только в том
   случае, если сама коллекция доказывает ошибку часов: заявленный год ниже самого раннего года,
   съёмка которого в архиве действительно присутствует.
3. Одна лишь форма заявки ошибку не доказывает: настоящая новогодняя фотография имеет ту же форму.
   При отсутствии доказательства ошибки заявка сохраняется.

### 6.3. Установление даты по пикселям

1. Если графический редактор удалил из файла дату съёмки, то допускается установление даты по
   оригиналу, найденному среди соседних файлов.
2. Круг кандидатов ограничивается файлами того же фотоаппарата и той же геометрии кадра. Кандидаты
   ранжируются блочным хешем изображения; финалисты перепроверяются на увеличенном разрешении.
3. Дата оригинала наследуется только в том случае, если победитель решительно опережает лучшего
   кандидата из другого дня. Абсолютный порог не применяется.
4. Если оригинал в архиве отсутствует, то дата не устанавливается. Отчёт всегда называет файл, у
   которого дата заимствована, и пользователь вправе данное решение отвергнуть.
5. Установление даты по пикселям является единственной фазой, декодирующей изображения, и наиболее
   продолжительной по времени. Отключение выполняется ключом `--no-pixels`.

---

## 7. Работа в окне

### 7.1. Основные положения

1. Окно программы открывается командой `kpot ui` либо запуском файла `KPOT.cmd` из портативного
   пакета.
2. Программа поднимает локальный сервер на адресе `127.0.0.1`, порт 5768. Если порт занят, то
   выбирается свободный порт.
3. Обращения принимаются только с данного компьютера. Каждый запуск выдаёт разовый пропуск, который
   передаётся в открываемой ссылке.
4. Браузер открывается после того, как сервер начал принимать обращения.
5. Одновременно работает один экземпляр программы. Повторный запуск открывает окно уже работающего
   экземпляра.
6. Закрытие вкладки браузера сортировку не останавливает: прогон продолжается, и его состояние
   доступно при следующем открытии окна.
7. Завершение работы выполняется кнопкой **«Завершить работу»**.

### 7.2. Выбор экрана

Программа открывает один из двух экранов. Выбор экрана определяется наличием расписки (раздел 3.4):

1. Если расписка отсутствует, то открывается **мастер**.
2. Если расписка присутствует, то открывается **пульт управления**.

### 7.3. Мастер

Мастер проводит первый разбор в четыре шага:

1. Выбор каталога.
2. Изучение каталога программой.
3. Чтение плана, изложенного числами.
4. Подтверждение сортировки. До подтверждения не перемещается ни один файл.

Четыре гарантии безопасности (раздел 5) отображаются на экране на протяжении всех шагов.

### 7.4. Пульт управления

Пульт управления содержит:

- три прогона, каждый из которых допускается запустить повторно в любой момент: изучение, план,
  сортировка;
- перечень случаев, требующих решения пользователя;
- перечень годов библиотеки со ссылкой на открытие каталога средствами операционной системы;
- каталог `НОВОЕ` с указанием числа ожидающих файлов (раздел 9);
- историю выполненных прогонов.

Каждая строка истории, возврат которой возможен, содержит кнопку **«Вернуть как было»**. Возврат
выполняется после подтверждения, в котором указаны идентификатор прогона и число файлов.

---

## 8. Работа в командной строке

### 8.1. Основные положения

1. Перечень команд приведён в Таблице 4, перечень ключей — в Таблице 5.
2. Стандартный вывод содержит только результат работы. Ход выполнения выводится в поток ошибок.
3. Коды завершения: `0` — успешно; `1` — ошибка; `2` — ошибка вызова.
4. До выполнения команды `apply` программа не записывает ничего за пределами служебного каталога
   `.kpot-runs`.

Таблица 4 — Команды

| Команда | Действие |
|---|---|
| `kpot scan <каталог>` | изучение дерева каталогов и сбор улик о дате съёмки |
| `kpot plan <каталог>` | построение пред-сортировочного мастер-плана |
| `kpot apply <каталог>` | выполнение плана |
| `kpot apply --dry-run <каталог>` | репетиция без единой записи |
| `kpot rollback <идентификатор> <каталог>` | возврат архива в состояние до указанного прогона |
| `kpot ui` | открытие окна программы в браузере |

Таблица 5 — Ключи

| Ключ | Действие |
|---|---|
| `--json` | вывод плана в машиночитаемом виде вместо отчёта |
| `--dry-run` | репетиция тем же кодом с отключённой записью |
| `--allow-no-snapshot` | продолжение работы на файловой системе без жёстких ссылок (раздел 5.2) |
| `--no-cache` | повторное вычисление всех хешей без использования сохранённых результатов |
| `--no-pixels` | отключение установления даты по пикселям (раздел 6.3) |
| `--resume` | продолжение прерванного прогона вместо начала нового |
| `-h`, `--help` | вывод справки |
| `-v`, `--version` | вывод версии |

### 8.2. Пример последовательности команд

```bash
kpot plan D:\Фотографии              # прочитать план; ни один файл не тронут
kpot apply --dry-run D:\Фотографии   # репетиция; ни один файл не тронут
kpot apply D:\Фотографии             # сортировка
kpot rollback run-20260729-141204-22687e D:\Фотографии   # возврат
```

---

## 9. Пополнение библиотеки

### 9.1. Основные положения

1. Каталог `НОВОЕ` является единственным местом внутри библиотеки, предназначенным для размещения
   новых файлов.
2. Пополнение выполняется той же сортировкой, что и первичный разбор, и подчиняется тем же
   гарантиям безопасности.
3. Файлы, уже размещённые в библиотеке, при пополнении не перемещаются.
4. Если файл, помещённый в каталог `НОВОЕ`, является копией файла, уже размещённого в библиотеке,
   то в библиотеке остаётся размещённый ранее файл, а вновь принесённая копия помещается в
   `ПРОЧЕЕ/_дубликаты`.

---

## 10. Ограничения текущей версии

1. Портативный пакет собран для Windows архитектуры x64. Исходные тексты переносимы, однако
   проверка выполняется только на Windows.
2. Тихий первый запуск не гарантируется: возможен вывод окна, описанного в разделе 2.3. Проверка на
   заведомо чистом компьютере не выполнялась.
3. Миниатюры изображений не отображаются. Просмотр выполняется средствами операционной системы.
4. Установление даты по пикселям при отсутствии оригинала в архиве допускает ошибку. По результатам
   160 контрольных испытаний ошибочными оказались 2 случая из 80.
5. Ветвь установления даты из файлов `.xmp` проверена только на подготовленных данных.
6. Ярлык на рабочем столе собственного значка не имеет.

---

## Технологии

Node.js версии 20 и выше, стандарт ESM. Сборка не выполняется, нативные модули отсутствуют. Число
зависимостей времени выполнения равняется двум: `exifreader` и `jpeg-js`. Портативный пакет содержит
официальную среду выполнения Node.js, подписанную OpenJS Foundation.

## Лицензия

MIT — см. [LICENSE](LICENSE).

---
---

<a name="english"></a>

## English

[Читать по-русски →](#русский)

**KPOT** is a program for bringing a home photo and video archive into chronological order. The
program establishes when each file was taken, finds identical copies, and arranges the files into
directories of the year and the season, preserving file names and meaningful directory names.

The program is operated in either of two ways:

- **a graphical interface** in a browser window — operated with a mouse, requiring no typed
  commands. No internet connection is needed: the program runs on the user's computer and makes no
  network requests;
- **a command-line interface** — the same actions issued as separate commands.

Both ways call the same executor, therefore the result of the work does not depend on the way
chosen.

The present document is the user manual.

---

## 1. Purpose

### 1.1. General provisions

1. The source material is a directory of photographs and video recordings of arbitrary structure,
   including directories with arbitrary names, dumps from telephones and cameras, downloads from
   messengers, and copies of one shot under different names in different directories.
2. The result of the work is a **library** — a directory tree in which every file is placed in the
   directory of the year it was taken and the directory of the season.
3. The date of capture is established from evidence contained in the files themselves and in their
   surroundings, in accordance with section 6. If the date cannot be established, the file is placed
   in the `ПРОЧЕЕ` directory, and no invented date is assigned to it.
4. A file is moved by means of the file system. Copying followed by deletion is not applied,
   therefore the volume of data processed affects the running time only slightly.
5. The program does not alter the contents of files and does not alter their metadata. The only
   action performed upon a user's file is moving it.
6. The program runs on a single computer. Access from other devices is not provided.

### 1.2. Limits of application

1. Image viewing is not part of the program: where an eye is required, the interface opens the
   directory by means of the operating system.
2. Editing, conversion, resizing and other image processing are not performed.
3. Transmission of data to the network is not performed under any circumstances.

---

## 2. Installation and start-up

### 2.1. General provisions

1. The program is supplied in two ways: as a portable package and as an npm package. The portable
   package is intended for a user who does not work with the command line.
2. Installation in the system sense is not performed: the program makes no registry entries,
   requires no administrator rights and installs no services.

### 2.2. Starting the portable package

The portable package is intended for the Windows operating system and contains its own runtime,
therefore no other program needs to be installed.

1. Download the package
   **[KPOT-0.2.0-win-x64.zip](https://github.com/MikalaiKryvusha/KPOT/releases/download/v0.2/KPOT-0.2.0-win-x64.zip)**
   (33 MB).
2. Unpack the whole directory to any location.
3. Start the file **`KPOT.cmd`** by a double click.
4. Wait for the browser window to open. Further work is performed in accordance with section 7.

On the first start the program offers to place a shortcut on the desktop. The shortcut is created
only with the user's consent.

### 2.3. The operating system warning on the first start

1. Files unpacked from a downloaded archive receive the mark "file obtained from the network". When
   such a file is started, Windows may display the window **«Открыть файл — предупреждение системы
   безопасности»** ("Open File — Security Warning").
2. The appearance of this window means that the file was downloaded rather than created on this
   computer. To continue, the button **«Запустить»** ("Run") is to be pressed.
3. The package contains no foreign program. It comprises the text files of the program and the
   official `node.exe` file signed by the OpenJS Foundation.

### 2.4. Starting from the command line

Node.js version 20 or higher is required. No build is performed, native modules are absent, and the
number of runtime dependencies equals two.

```bash
# installation from the release
npm i -g https://github.com/MikalaiKryvusha/KPOT/releases/download/v0.2/kpot-0.2.0.tgz
kpot --help

# or running from source
git clone https://github.com/MikalaiKryvusha/KPOT.git && cd KPOT && npm i
node bin/kpot.mjs --help
```

The command `kpot ui` opens the same window as the portable package.

---

## 3. Structure of the library

### 3.1. General provisions

1. The library is placed in the same directory that was designated for sorting. A second directory
   is not created and a copy of the archive is not made.
2. File names are preserved. Meaningful directory names are preserved: if files lay in a directory
   with a substantive name, that name is carried over together with them.
3. A year directory contains season directories. The seasons and their boundaries are given in
   Table 1.

Table 1 — Seasons and the months corresponding to them

| Season directory | Months |
|---|---|
| `Зима начало года` (winter, start of year) | January, February |
| `Весна` (spring) | March, April, May |
| `Лето` (summer) | June, July, August |
| `Осень` (autumn) | September, October, November |
| `Зима конец года` (winter, end of year) | December |

The two winters are separated deliberately: with such a separation the contents of a year directory
are read in chronological order.

### 3.2. Service directories

The service directories of the library are given in Table 2.

Table 2 — Service directories of the library

| Directory | Purpose |
|---|---|
| `<year>/прочее` | the year is established, the season is not |
| `ПРОЧЕЕ` | the date of capture could not be established |
| `ПРОЧЕЕ/_дубликаты` | second and subsequent copies of one file; the origin of each copy is preserved in its name |
| `ПРОЧЕЕ/_мусор` | system files of the operating system: `Thumbs.db`, `desktop.ini` and the like |
| `НА_РАЗБОР` | directories requiring a decision by the user (section 3.3) |
| `НОВОЕ` | the directory for replenishing the library (section 9) |
| `.kpot-runs` | service data of the program: maps, backups, run journals |

Files that are not photographs, video recordings or sound recordings are not moved. Such files
remain in their places and are listed in the report.

### 3.3. Directories requiring a decision by the user

1. If the name of a directory does not permit establishing whether that directory was created by the
   user or by a program, the contents of such a directory are not sorted, and the directory itself
   is placed in `НА_РАЗБОР` with its original structure preserved.
2. A directory is placed in `НА_РАЗБОР` only in the case where sorting it would in fact scatter its
   contents across the library.
3. The list of such directories is written by the program into the file
   `.kpot-runs/папки-на-согласование.txt`. Against each directory, after the `=` sign, one of two
   decisions is stated: **`сортировать`** ("sort") — sort the contents by years and seasons on a par
   with the remaining files; **`как есть`** ("as is") — leave the directory in `НА_РАЗБОР` in its
   entirety, unsorted.
4. After the decisions have been stated, the program is started again. Recorded decisions are
   preserved between runs.

### 3.4. The receipt

1. After a sort has been performed, the text file **`KPOT — что здесь сделано.txt`** is placed in
   the root of the library.
2. The receipt contains the list of runs in effect at the present time, the date and time of each
   run, the number of files moved, and the procedure for undoing each run.
3. By the presence of the receipt the program establishes whether this folder has been sorted
   before. If the receipt is absent, the folder is considered unsorted.
4. A run undone in accordance with section 4.5 is removed from the receipt. If all runs are undone,
   the receipt is deleted entirely.
5. Deletion of the receipt by the user is permitted. The photographs are not altered thereby; the
   program will offer to begin sorting from the start.

---

## 4. Order of work

### 4.1. General provisions

1. The work consists of four phases: examination, plan, sorting, undo. The phases are performed in
   the order stated.
2. The phases of examination and plan do not alter the archive. These phases write only into the
   `.kpot-runs` service directory.
3. Files are moved exclusively in the sorting phase and exclusively upon an explicit command from
   the user.

### 4.2. Examination

1. The program traverses the directory tree and determines the type of each file.
2. The type of a file is determined by its contents, not by its extension. An extension is an
   unreliable indication: real archives contain valid images bearing an arbitrary extension.
3. For each file separately, evidence of the date of capture is collected in accordance with
   section 6.
4. Identical copies are determined by the contents of files, not by their names.

### 4.3. The plan

1. The result of the phase is the **pre-sort master plan** — a document describing every forthcoming
   action before the first of them is performed.
2. The plan contains: the number of files found; the number of files subject to moving; the target
   placement of each file and the evidence on the basis of which that placement was assigned; the
   list of identical copies; the list of disputed cases; the list of name collisions; the list of
   directories that will be emptied; the list of directories requiring a decision by the user.
3. No file is moved in the plan phase.

### 4.4. Sorting

1. Sorting performs exactly those actions that are described in the plan.
2. Sorting does not begin until a verified backup has been created in accordance with section 5.
3. A rehearsal of the sort is performed by the same code as the actual sort, with writing disabled.
   A second implementation is not applied, therefore a divergence between the rehearsal and the
   actual run is excluded.
4. Every intent is written into a journal before it is executed. An interrupted run is permitted to
   be continued; after continuation a single undo still reverses the run in its entirety.
5. Sorting an already sorted library moves nothing.

### 4.5. Undo

1. Undo restores the state of the archive preceding the run indicated: files are returned to their
   former places, and directories removed during sorting are created anew.
2. Undo is performed by the identifier of the run. The identifier is given in the sorting report and
   in the receipt.
3. Undo is permitted to be performed both from the program window and from the command line.

---

## 5. Safety guarantees

### 5.1. General provisions

Files are not moved until all four conditions have been fulfilled:

1. **A map.** A plan has been composed stating the target placement of each file and the evidence on
   the basis of which that placement was assigned.
2. **A backup.** A list of all files and all directories has been created, together with a snapshot
   of the archive on hard links. A snapshot on hard links occupies no space on the disk.
3. **A rehearsal.** A full run has been performed without a single write.
4. **A path of undo.** The sorting report contains the identifier of the run by which undo is
   performed.

### 5.2. Verification that a snapshot can be made

1. The ability to create hard links is verified by trial, not by assumption.
2. If the file system does not support hard links — for example, exFAT or FAT32 — the run stops and
   requires the `--allow-no-snapshot` option to be stated explicitly.
3. When working with the said option the structure of the archive remains restorable, while the
   contents of files have no protection. Stating this option is a decision of the user.

### 5.3. Disputed cases

1. A disputed case is a case in which the evidence of the date of capture contradicts itself.
2. Disputed cases are not resolved silently. Every disputed case is given in the plan with all the
   evidence enumerated, including the evidence overruled.
3. The decision on a disputed case is taken by the user.

---

## 6. Establishing the date of capture

### 6.1. General provisions

1. The date of capture is a date confirmed by evidence. A date not confirmed by evidence is not
   considered a date of capture.
2. Evidence is ordered by reliability. The evidence is given in Table 3 in decreasing order of
   reliability.
3. For each file separately, both the evidence accepted and all the evidence overruled are
   preserved.
4. The file modification time in the file system is not decisive: a bulk copy of an archive alters
   that time for all files at once.
5. If no evidence is found, the result is "the date is not established". This result is a full
   answer, and the file is placed in the `ПРОЧЕЕ` directory.

Table 3 — Sources of the date of capture in decreasing order of reliability

| No. | Source | Description |
|---|---|---|
| 1 | `exif-original` | the moment of capture written by the camera into the EXIF metadata |
| 2 | `derived-original` | the moment of capture of the original, inherited by an exact match of the XMP `DocumentID` and `DerivedFrom` identifiers |
| 3 | `pixel-original` | the moment of capture of the original, inherited after finding that original by its pixels (section 6.3) |
| 4 | `filename-timestamp` | the full date and time written by the device into the file name |
| 5 | `container-created` | the creation date written into an MP4 or MOV video container |
| 6 | `filename-epoch` | unix time written into the file name |
| 7 | `exif-modify` | the modification date in the EXIF metadata |
| 8 | `sidecar` | the metadata of a `THM` or `XMP` twin file, inherited by the media file |
| 9 | `dirname` | the year and season in the name of one of the parent directories |
| 10 | `filename-year` | a year in the file name without a month and a day |
| 11 | `family` | an assumption by camera family: neighbouring files of the same camera yield one year |
| 12 | `dir-cohort` | an assumption by neighbours: files of the same directory whose date is established reliably |
| 13 | `editor-save` | the date on which the file was saved by a graphics editor; constitutes the upper bound "taken no later than" and is not decisive |
| 14 | `fs-mtime` | the file modification time in the file system |

### 6.2. Rejection of unreliable claims

1. A claimed year earlier than 1990 is not considered reliable: consumer digital photography did not
   exist at that time.
2. A claim of a reset camera clock — for example, "1 January, 00:25" — is rejected only in the case
   where the collection itself proves the clock to be in error: the claimed year is below the
   earliest year of which the archive does in fact contain photographs.
3. The shape of a claim alone proves no error: a genuine New Year photograph has the same shape. In
   the absence of proof of error the claim is retained.

### 6.3. Establishing a date by pixels

1. If a graphics editor has removed the date of capture from a file, the date is permitted to be
   established from the original found among neighbouring files.
2. The circle of candidates is limited to files of the same camera and the same frame geometry.
   Candidates are ranked by a block-mean hash of the image; the finalists are re-checked at an
   increased resolution.
3. The date of the original is inherited only in the case where the winner is decisively ahead of
   the best candidate from another day. An absolute threshold is not applied.
4. If the original is absent from the archive, the date is not established. The report always names
   the file from which a date was borrowed, and the user is entitled to reject that decision.
5. Establishing a date by pixels is the only phase that decodes images and the longest in duration.
   It is switched off by the `--no-pixels` option.

---

## 7. Work in the window

### 7.1. General provisions

1. The program window is opened by the command `kpot ui` or by starting the `KPOT.cmd` file from the
   portable package.
2. The program raises a local server at the address `127.0.0.1`, port 5768. If the port is occupied,
   a free port is chosen.
3. Requests are accepted only from this computer. Each start-up issues a single-use pass, which is
   conveyed in the link that is opened.
4. The browser is opened after the server has begun to accept requests.
5. One instance of the program runs at a time. A repeated start opens the window of the instance
   already running.
6. Closing the browser tab does not stop the sorting: the run continues, and its state is available
   when the window is next opened.
7. Work is terminated by the button **«Завершить работу»** ("Shut down").

### 7.2. Choice of screen

The program opens one of two screens. The choice of screen is determined by the presence of the
receipt (section 3.4):

1. If the receipt is absent, the **guide** is opened.
2. If the receipt is present, the **dashboard** is opened.

### 7.3. The guide

The guide conducts the first sorting in four steps:

1. Selection of the directory.
2. Examination of the directory by the program.
3. Reading of the plan, set out in figures.
4. Confirmation of the sort. Not a single file is moved before confirmation.

The four safety guarantees (section 5) are displayed on the screen throughout all the steps.

### 7.4. The dashboard

The dashboard contains:

- the three runs, each of which is permitted to be started again at any moment: examination, plan,
  sorting;
- the list of cases requiring a decision by the user;
- the list of the years of the library with a link opening the directory by means of the operating
  system;
- the `НОВОЕ` directory with the number of files awaiting sorting (section 9);
- the history of the runs performed.

Every row of the history whose undo is possible contains the button **«Вернуть как было»** ("Put it
back"). Undo is performed after a confirmation stating the identifier of the run and the number of
files.

---

## 8. Work at the command line

### 8.1. General provisions

1. The commands are given in Table 4, the options in Table 5.
2. Standard output contains the result of the work alone. The progress of execution is written to
   the error stream.
3. Exit codes: `0` — success; `1` — error; `2` — usage error.
4. Until the `apply` command is executed, the program writes nothing outside the `.kpot-runs`
   service directory.

Table 4 — Commands

| Command | Action |
|---|---|
| `kpot scan <dir>` | examination of the directory tree and collection of evidence of the date of capture |
| `kpot plan <dir>` | construction of the pre-sort master plan |
| `kpot apply <dir>` | execution of the plan |
| `kpot apply --dry-run <dir>` | a rehearsal without a single write |
| `kpot rollback <run-id> <dir>` | return of the archive to the state preceding the run indicated |
| `kpot ui` | opening of the program window in the browser |

Table 5 — Options

| Option | Action |
|---|---|
| `--json` | output of the plan in machine-readable form instead of the report |
| `--dry-run` | a rehearsal by the same code with writing disabled |
| `--allow-no-snapshot` | continuation of work on a file system without hard links (section 5.2) |
| `--no-cache` | repeated computation of all hashes without the use of saved results |
| `--no-pixels` | switching off the establishment of a date by pixels (section 6.3) |
| `--resume` | continuation of an interrupted run instead of beginning a new one |
| `-h`, `--help` | output of the help text |
| `-v`, `--version` | output of the version |

### 8.2. Example of a sequence of commands

```bash
kpot plan D:\Photographs              # read the plan; not a single file is touched
kpot apply --dry-run D:\Photographs   # rehearsal; not a single file is touched
kpot apply D:\Photographs             # the sort
kpot rollback run-20260729-141204-22687e D:\Photographs   # undo
```

---

## 9. Replenishing the library

### 9.1. General provisions

1. The `НОВОЕ` directory is the sole place inside the library intended for placing new files.
2. Replenishment is performed by the same sorting as the initial one and is subject to the same
   safety guarantees.
3. Files already placed in the library are not moved during replenishment.
4. If a file placed in the `НОВОЕ` directory is a copy of a file already placed in the library, the
   file placed earlier remains in the library, and the newly brought copy is placed in
   `ПРОЧЕЕ/_дубликаты`.

---

## 10. Limits of the present version

1. The portable package is built for Windows of the x64 architecture. The source texts are portable,
   however verification is performed on Windows only.
2. A silent first start is not guaranteed: the window described in section 2.3 may be displayed.
   Verification on a machine with the standard defences of the operating system enabled has not
   been performed.
3. Image thumbnails are not displayed. Viewing is performed by means of the operating system.
4. Establishing a date by pixels admits of error where the original is absent from the archive. By
   the results of 160 controlled trials, 2 cases out of 80 proved erroneous.
5. The branch establishing a date from `.xmp` files has been verified on prepared data only.
6. The desktop shortcut has no icon of its own.

---

## Technology

Node.js version 20 and higher, the ESM standard. No build is performed, native modules are absent.
The number of runtime dependencies equals two: `exifreader` and `jpeg-js`. The portable package
contains the official Node.js runtime signed by the OpenJS Foundation.

## Licence

MIT — see [LICENSE](LICENSE).
