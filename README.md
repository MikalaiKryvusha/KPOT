<p align="center">
  <img src="assets/KPOT.jpg" alt="KPOT — Krinik Photo Organizer Tool" width="420">
</p>

# KPOT — Krinik Photo Organizer Tool

![License](https://img.shields.io/badge/license-MIT-green)
![Release](https://img.shields.io/badge/release-0.2%20«Obvius%20KPOT»-blue)
![Status](https://img.shields.io/badge/status-window%20·%20portable%20package%20·%20sorted%20a%20real%20archive-brightgreen)
![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen)
![Platform](https://img.shields.io/badge/platform-Windows--first-blue)
![Framework](https://img.shields.io/badge/powered%20by-KAIF%201.6-purple)

---

## English

[Читать по-русски →](#русский)

**KPOT — Krinik Photo Organizer Tool.** Chaos in, chronology out: a safety-first CLI tool that turns
a messy home photo/video archive into a browsable chronological library, sorted by year and season —
without ever risking a file you cannot get back.

### Why

Family photos and videos accumulate for decades: random folders with random names, dumps from old
phones and cameras, messenger downloads, duplicates of the same shot scattered under different names
across different directories. The memories are there — but you cannot *browse your life*.

KPOT scans a directory (or a whole drive), figures out **when** each photo/video was taken from
whatever evidence exists — EXIF metadata, dates encoded in filenames (`IMG_20140121_183801.jpg`,
unix-timestamp names, screenshot names…), sidecars, folder names — finds duplicates by content, and
lays everything out as:

```
Library/
├── 2013/
│   ├── Winter (start of year)/
│   ├── Spring/
│   ├── Summer/
│   ├── …
│   └── misc/            ← year is certain, season is not
├── 2014/
│   └── …
└── MISC/                ← date could not be established (never guessed silently)
```

Your custom file names and meaningful folder names survive the sort.

### Safety first — the four guarantees

KPOT **never moves a single file** until all four exist:

1. 🗺️ **A detailed map** — what goes where, and *why* (the evidence behind every date).
2. 💾 **A backup point** the source directory can be rolled back to.
3. 🧪 **A dry run** — a full simulation whose report is all-but-identical to the real run.
4. 📋 **A post-sort report** with a working rollback path.

Every ambiguous case (conflicting dates, suspicious duplicates) is documented and shown in the
pre-sort master plan — never resolved silently. Moves are filesystem *renames*, not copy+delete —
sorting half a terabyte takes minutes, not hours.

### If you don't use a terminal — the window version

KPOT has a normal interface. You point it at a folder and it walks you through, one screen at a
time; nothing on the way asks you to type a command.

**It shows you one of two screens, and it knows which by reading its own note.** Sorted this folder
before? KPOT left a small readable file in it — `KPOT — что здесь сделано.txt` — listing what it
did and how to undo it. That file is the *only* thing that makes a folder "already sorted" in
KPOT's eyes:

- **no note → the guide.** Four steps: choose the folder · KPOT looks at it · it shows you the plan
  in numbers · you press one button, and only then does anything move.
- **note present → the dashboard.** Re-run any of the three passes (look · plan · sort), see what
  needs your decision, open folders in Explorer, top up the library from the `НОВОЕ` folder, and
  undo any past run from the history.

You may delete that note — it says so in its own text. Nothing happens to your photographs; KPOT
just offers to start from the beginning again. Undo a sort and the note goes with it, because it
lists only the sorts that are *still in effect*.

**What Windows may show you the first time.** Windows can see that a file arrived from the internet
and may open a window called **«Открыть файл — предупреждение системы безопасности»** ("Open File —
Security Warning"). This is normal and means exactly one thing: the file was downloaded rather than
made on your computer. Press **«Запустить» (Run)**. The package contains no unknown program — our
own text files plus the official `node.exe`, signed by the OpenJS Foundation. KPOT needs no
internet and sends none of your photographs anywhere.

> **Where to get it.** 📦 **[KPOT-0.2.0-win-x64.zip](https://github.com/MikalaiKryvusha/KPOT/releases/download/v0.2/KPOT-0.2.0-win-x64.zip)**
> — Windows, 33 MB, no installer and no administrator rights. Unpack the folder and double-click
> `KPOT.cmd`; it carries its own Node.js, so nothing else needs installing. All releases:
> [Releases](https://github.com/MikalaiKryvusha/KPOT/releases).

### Install (command line)

Node.js ≥ 20, nothing else — no build step, no native modules, two runtime dependencies.

```bash
# from the release
npm i -g https://github.com/MikalaiKryvusha/KPOT/releases/download/v0.2/kpot-0.2.0.tgz
kpot --help
kpot ui                 # the same window interface, from a checkout or an install

# or from source
git clone https://github.com/MikalaiKryvusha/KPOT.git && cd KPOT && npm i
node bin/kpot.mjs --help
```

### Status

🎉 **Release 0.2 “Obvius KPOT”.** The tool now has a **face**: a window you drive with the mouse,
a portable package that needs neither Node nor a terminal, and a note it leaves behind saying what
it did to your folder. Verified by **294 green tests** *and* by two supervised runs on real material
taken out of a genuinely messy 551 GB collection — a 3 397-file / 13 GB sample, and a fresh
813-file / 943 MB one.

```
kpot scan <dir>               what each file is, and when it was taken — with the evidence
kpot plan <dir>               the pre-sort master plan you read BEFORE anything moves
kpot apply --dry-run <dir>    full rehearsal, zero writes
kpot apply <dir>              the sort — refuses to start without a verified backup
kpot rollback <run-id> <dir>  everything back where it was
kpot ui                       the window: a local server and a page in your browser
```

**On those real runs:** 3 154 and 813 files sorted, 0 failures either time, and the multiset of
SHA-256 content hashes was *identical* before and after — nothing lost, nothing invented. The
rollback rehearsals restore every file and every folder the sort removed.

What is behind that:

- **Dates from evidence, never from a guess** — [DateVerdict](src/meta/resolve.mjs) per file: EXIF,
  MP4/MOV `mvhd` (our own parser), filename conventions, epoch names, folder names, neighbour-cohort
  inference. Losing evidence stays visible, broken camera clocks are rejected, and *unknown* is a
  real answer instead of a plausible lie.
- **A photo editor cannot fake a capture date** — an export with no `DateTimeOriginal` is never
  shelved by its save date: that date becomes a "taken no later than" ceiling, the XMP identity
  chain (`DerivedFrom` → `DocumentID`) recovers the original's *real* date when the original is in
  the tree, and [camera-family signs](src/meta/family.mjs) (folder camera census, sensor geometry,
  neighbours' year fork) narrow the rest honestly. Measured on the real archive: 199 of 201 such
  files stop living in a false year.
- **Safety that is proven, not promised** — backup (manifest + hardlink snapshot, ~0 bytes on disk)
  before the first write; the dry run executes the *same* code path with inert effects; every intent
  is journalled before it happens; an interrupted run is resumable and one rollback still restores
  the original.
- **It asks instead of guessing** — folders whose name cannot say whether they are yours or a
  program's are set aside in `НА_РАЗБОР/`, keeping their original structure, and only when sorting
  would actually scatter them. You answer in a plain text file; answers survive between runs.
- **A file with no date of its own can borrow its twin's** — a camera writes a `.THM` thumbnail next
  to a video, and [sidecar evidence](src/meta/sidecar.mjs) reads it. That matters more than it
  sounds: AVI carries no container date at all, so on the real archive 25 videos knew only a folder
  year — and now they are dated to the second. The thumbnails themselves go to quarantine, not into
  your gallery.
- **It can find a photo's original by its pixels** — when an editor stripped the capture date, KPOT
  compares the export against the same-camera neighbours step 1 already narrowed down, and inherits
  the original's *real* date only when the best match is decisively ahead of the runner-up — never on
  a threshold ([how, and why a threshold cannot work](researches/06_pixel_original_calibration.md)).
  On one real folder it found `S8305319 +.jpg`'s original at a distance of 30 bits of 1024 with a
  margin of 284; on another, 4 of 4. Where the original is simply not in the archive, it says nothing
  — 94 of 95 such files stayed honestly undated, which is the correct answer, not a missed one.
- **A reset camera clock is not a date** — a "1 January 00:25" claim is refused only when the
  collection itself contradicts it (its year is below the earliest year the archive really holds).
  A genuine New Year photograph of exactly the same shape keeps its date; the owner's archive has 13
  of those, and all 13 are untouched.
- **Idempotent** — sorting an already-sorted library moves nothing.
- **A window, not a command line** *(new in 0.2)* — `kpot ui` serves a page on `127.0.0.1` only,
  behind a start-up token and a `Host` whitelist, opened in your browser only after the server is
  actually listening. A guide for the first flight; a dashboard afterwards, with every run
  re-launchable, folders opened in Explorer, and an **undo button on each row of the history**.
  Closing the tab does not stop a sort — a run over 70 000 files must not die with a browser window.
- **It writes down what it did** *(new in 0.2)* — after a real sort you get a plain readable
  `KPOT — что здесь сделано.txt` in the folder: which runs are still in effect, when, how many
  files, and how to undo each. It is also how KPOT knows whether it has been here before, instead of
  guessing from the shape of your folders — [bugs/06](bugs/06_DONE_messy_tree_looks_like_a_library.md)
  was exactly that guess going wrong on an archive that merely *looked* tidy.
- **A `НОВОЕ` folder for what arrives later** *(new in 0.2)* — drop new photographs in, press one
  button, and they are filed into the library that already exists; a copy already shelved always
  wins over a freshly-dropped duplicate.
- Grounded in real chaos: [prior-art research](researches/01_prior_art.md) ·
  [real-archive survey](researches/02_real_archive_survey.md) ·
  [the first real run](researches/03_first_real_run.md), which found four bugs no synthetic fixture
  had · [what a sidecar really contains](researches/04_sidecars.md).

**Shipped in 0.2: the interface** — a local web UI, delivered as a portable package (download,
unpack, done), with a wizard for the first run and a control panel afterwards. Design and delivery
were settled first: [interview 003](interviews/interview_003_interface.md), with
[clickable mock-ups](interviews/interview_003_designs.html) and the
[prior-art review](researches/07_local_ui_and_delivery.md) behind them; the plan is the
[interface epic](plans/03_interface_epic.md). **All six of its phases are done** — `kpot ui` starts
a local server and opens a window that walks you through choosing a folder, reading the plan and
sorting, with the four guarantees on screen the whole time. It calls **the same executor** the
terminal does (two implementations would let the dry run and the real run drift apart), it refuses to
sort without your explicit confirmation, and closing the browser does not stop a run. Once a library
exists the wizard steps aside for a control panel: three re-launchable runs, your years with a link
that opens each folder in Windows, and a history of what you have run — with **«Вернуть как было» on
every row that can still honour it**, behind a confirmation that names the run and the number of
files. The panel also carries the **`НОВОЕ` folder** — one legal place to drop new pictures, showing
how many are waiting, with one button that files them into the library exactly as any other sort
does. And the package itself is here: a ~33 MB ZIP carrying Node’s own signed binary plus our
`.mjs`, so no unsigned executable is ever introduced.

Roadmap: `MASTER_PLAN.md` · current state: `STATUS.md`.

### Tech

Pure Node.js ≥ 20, ESM (`.mjs`), no build step, near-zero dependencies. Windows-first (long paths,
Cyrillic names, reserved names — all first-class), portable by design. Developed autonomously by AI
agents under the [KAIF framework](https://github.com/MikalaiKryvusha/KAIF) with the owner steering
the vision.

### License

MIT © 2026 Mikalai Kryvusha (KOT KRINIK)

---

## Русский

[Read in English →](#english)

**KPOT — Krinik Photo Organizer Tool.** На входе бардак, на выходе хронология: безопасный
CLI-инструмент, который превращает захламлённый домашний фото-видео архив в удобную хронологическую
библиотеку по годам и сезонам — не рискуя ни одним файлом, который нельзя вернуть.

### Зачем

Семейные фото и видео копятся десятилетиями: случайные папки со случайными названиями, сливы со
старых телефонов и фотоаппаратов, скачанное из мессенджеров, дубликаты одного кадра под разными
именами в разных директориях. Воспоминания есть — а *листать свою жизнь* невозможно.

KPOT сканирует директорию (или целый диск), устанавливает, **когда** снят каждый кадр, по всем
доступным уликам — EXIF-метаданные, даты в именах файлов (`IMG_20140121_183801.jpg`,
unix-timestamp'ы, имена скриншотов…), сайдкары, названия папок — находит дубликаты по содержимому
и раскладывает всё так:

```
Библиотека/
├── 2013/
│   ├── Зима начало года/
│   ├── Весна/
│   ├── Лето/
│   ├── …
│   └── прочее/          ← год известен точно, сезон — нет
├── 2014/
│   └── …
└── ПРОЧЕЕ/              ← дату установить не удалось (никогда не «угадывается» молча)
```

Пользовательские имена файлов и осмысленные названия папок переживают сортировку.

### Безопасность прежде всего — четыре гарантии

KPOT **не переместит ни одного файла**, пока не существуют все четыре:

1. 🗺️ **Подробная карта** — что куда поедет и *почему* (улики за каждой датой).
2. 💾 **Точка бекапа**, к которой исходную директорию можно откатить.
3. 🧪 **Сухой прогон** — полная симуляция, отчёт которой почти 1в1 равен реальному прогону.
4. 📋 **Пост-отчёт** с рабочим путём отката.

Каждый спорный случай (конфликт дат, подозрительный дубликат) документируется и показывается в
пред-сортировочном мастер-плане — ничего не решается молча. Перемещения — это *переименования* в
файловой системе, а не копирование с удалением: сортировка полутерабайта занимает минуты, а не часы.

### Если вы не работаете с командной строкой — версия с окном

У KPOT есть обычный интерфейс. Вы указываете папку, а программа ведёт вас по шагам, по одному
экрану за раз; нигде по дороге не нужно набирать команды.

**Программа показывает один из двух экранов и понимает, какой именно, по своей же записке.** Если
эту папку уже разбирали, KPOT оставил в ней небольшой читаемый файл — `KPOT — что здесь
сделано.txt` — со списком того, что он сделал и как это вернуть назад. Только этот файл и делает
папку «уже разобранной» в глазах программы:

- **записки нет → мастер.** Четыре шага: выбрать папку · программа её изучает · показывает план в
  цифрах · вы нажимаете одну кнопку, и только после этого что-то сдвигается с места.
- **записка есть → пульт управления.** Заново запустить любой из трёх прогонов (осмотр · план ·
  сортировка), посмотреть, что ждёт вашего решения, открыть папки в проводнике, разложить новое из
  папки `НОВОЕ` и вернуть назад любой прошлый прогон из истории.

Записку можно удалить — об этом написано в ней самой. С фотографиями ничего не случится, программа
просто предложит начать разбор сначала. Если отменить сортировку, записка исчезнет вместе с ней:
в ней перечислены только те сортировки, которые *действуют сейчас*.

**Что может показать Windows при первом запуске.** Windows видит, что файл пришёл из интернета, и
может показать окно **«Открыть файл — предупреждение системы безопасности»**. Это нормально и
означает ровно одно: файл скачан, а не создан на вашем компьютере. Нажмите **«Запустить»**. Внутри
пакета нет ни одной чужой или неизвестной программы — только наши текстовые файлы и официальный
`node.exe`, подписанный OpenJS Foundation. Программе не нужен интернет, и она никуда не отправляет
ни одной вашей фотографии.

> **Где взять.** 📦 **[KPOT-0.2.0-win-x64.zip](https://github.com/MikalaiKryvusha/KPOT/releases/download/v0.2/KPOT-0.2.0-win-x64.zip)**
> — Windows, 33 МБ, без установщика и без прав администратора. Распакуйте папку и дважды щёлкните по
> `KPOT.cmd`; свой Node.js он несёт с собой, так что больше ничего ставить не нужно. Все релизы:
> [Releases](https://github.com/MikalaiKryvusha/KPOT/releases).

### Установка (командная строка)

Нужен только Node.js ≥ 20 — ни сборки, ни нативных модулей, две зависимости времени выполнения.

```bash
# из релиза
npm i -g https://github.com/MikalaiKryvusha/KPOT/releases/download/v0.2/kpot-0.2.0.tgz
kpot --help
kpot ui                 # тот же интерфейс с окном — из установки или из исходников

# или из исходников
git clone https://github.com/MikalaiKryvusha/KPOT.git && cd KPOT && npm i
node bin/kpot.mjs --help
```

### Статус

🎉 **Релиз 0.2 «Obvius KPOT».** У инструмента появилось **лицо**: окно, которым управляют мышью,
портативный пакет, которому не нужны ни Node, ни командная строка, и записка, которую программа
оставляет в папке — что именно она с ней сделала. Проверено **294 зелёными тестами** *и* двумя
контролируемыми прогонами на живом материале из по-настоящему захламлённой коллекции на 551 ГБ —
на выборке 3 397 файлов / 13 ГБ и на свежей 813 файлов / 943 МБ.

```
kpot scan <dir>               что за файл и когда снят — вместе с уликами
kpot plan <dir>               пред-сортировочный мастер-план: читаете ДО того, как что-то тронется
kpot apply --dry-run <dir>    полная репетиция, ноль записей
kpot apply <dir>              сортировка — не начнётся без проверенного бэкапа
kpot rollback <run-id> <dir>  всё возвращается как было
kpot ui                       окно: локальный сервер и страница в браузере
```

**Те самые прогоны:** 3 154 и 813 файлов разложены, 0 сбоев в обоих случаях, а множество SHA-256
содержимого до и после — *идентично*: ничего не потеряно и ничего не выдумано. Репетиции отката
возвращают каждый файл и каждую папку, которую убрала сортировка.

Что за этим стоит:

- **Дата из улик, а не из догадки** — [вердикт](src/meta/resolve.mjs) на каждый файл: EXIF, `mvhd`
  из MP4/MOV (собственный парсер), конвенции имён, epoch-имена, названия папок, вывод по соседям.
  Проигравшие улики остаются на виду, сломанные часы камер отвергаются, а «неизвестно» — это
  честный ответ, а не правдоподобная ложь.
- **Фоторедактор не подделает дату съёмки** — экспорт без `DateTimeOriginal` никогда не ложится на
  полку по дате сохранения: она становится потолком «снято не позже», цепочка XMP-идентичности
  (`DerivedFrom` → `DocumentID`) возвращает *настоящую* дату оригинала, если он есть в дереве, а
  [признаки семейства камеры](src/meta/family.mjs) (перепись камер папки, геометрия матрицы, вилка
  лет соседей) честно сужают остальное. Замер на реальном архиве: 199 из 201 такого файла перестают
  жить в ложном году.
- **Безопасность доказанная, а не обещанная** — бэкап (манифест + снимок жёсткими ссылками, ~0 байт
  на диске) до первой записи; сухой прогон идёт *тем же* кодом с отключёнными эффектами; намерение
  пишется в журнал до действия; прерванный прогон продолжается, и один откат всё равно возвращает
  исходное состояние.
- **Спрашивает, а не угадывает** — папки, по имени которых нельзя понять, ваши они или созданы
  программой, откладываются в `НА_РАЗБОР/` со своей исходной структурой — и только если сортировка
  их действительно разорвёт. Отвечаете в обычном текстовом файле, ответы сохраняются между прогонами.
- **Файл без своей даты берёт её у близнеца** — камера кладёт рядом с видео миниатюру `.THM`, и
  [доказательство из сайдкара](src/meta/sidecar.mjs) её читает. Это важнее, чем звучит: у AVI нет
  даты в контейнере вообще, поэтому на реальном архиве 25 видео знали только год папки — а теперь
  датированы до секунды. Сами миниатюры едут в карантин, а не в вашу галерею.
- **Находит оригинал фотографии по её пикселям** — если редактор стёр дату съёмки, KPOT сравнивает
  экспорт с теми же снимками той же камеры, круг которых уже сузил шаг 1, и наследует *настоящую*
  дату оригинала только когда лучший кандидат убедительно оторвался от второго — никогда по порогу
  ([как именно и почему порог не работает](researches/06_pixel_original_calibration.md)). На одной
  реальной папке нашёл оригинал `S8305319 +.jpg` с различием 30 из 1024 бит при отрыве 284; на другой
  — 4 из 4. Там, где оригинала в архиве просто нет, он молчит: 94 из 95 таких файлов честно остались
  без даты, и это правильный ответ, а не упущенный.
- **Сброшенные часы камеры — не дата** — заявке «1 января 00:25» отказывают только если сама
  коллекция ей противоречит (её год ниже того, с которого в архиве реально начинаются снимки).
  Настоящая новогодняя фотография точно такой же формы дату сохраняет: в архиве владельца их 13, и
  все 13 не тронуты.
- **Идемпотентность** — сортировка уже разобранной библиотеки не двигает ничего.
- **Окно вместо командной строки** *(новое в 0.2)* — `kpot ui` поднимает страницу только на
  `127.0.0.1`, за стартовым токеном и белым списком `Host`, и открывает браузер лишь после того, как
  сервер действительно начал слушать. Мастер на первый раз, пульт управления потом: любой прогон
  можно запустить заново, папки открываются в проводнике, а **у каждой строки истории есть кнопка
  отмены**. Закрытие вкладки не останавливает сортировку — прогон на 70 000 файлов не должен
  умирать вместе с окном браузера.
- **Программа записывает, что сделала** *(новое в 0.2)* — после настоящей сортировки в папке
  появляется читаемый файл `KPOT — что здесь сделано.txt`: какие прогоны действуют сейчас, когда,
  сколько файлов и как каждый вернуть назад. По нему же KPOT понимает, был ли он здесь раньше, —
  вместо того чтобы догадываться по виду папок. [bugs/06](bugs/06_DONE_messy_tree_looks_like_a_library.md)
  — это как раз та догадка, ошибавшаяся на архиве, который лишь *выглядел* прибранным.
- **Папка `НОВОЕ` для того, что появится потом** *(новое в 0.2)* — складываете туда свежие снимки,
  нажимаете одну кнопку, и они встают в уже собранную библиотеку; копия, которая давно лежит на
  полке, всегда выигрывает у только что принесённого дубликата.
- Опирается на реальный хаос: [исследование готовых решений](researches/01_prior_art.md) ·
  [обзор реального архива](researches/02_real_archive_survey.md) ·
  [первый настоящий прогон](researches/03_first_real_run.md), который нашёл четыре бага, невидимых
  ни одной синтетической фикстуре · [что на самом деле лежит в сайдкаре](researches/04_sidecars.md).

**Вышло в 0.2: интерфейс** — локальный веб-интерфейс, поставляемый портативным пакетом (скачал,
распаковал, готово), с мастером на первый запуск и пультом управления дальше. Дизайн и способ
поставки согласовали заранее: [интервью 003](interviews/interview_003_interface.md), к нему
[кликабельные макеты](interviews/interview_003_designs.html) и
[разведка готовых решений](researches/07_local_ui_and_delivery.md); план — 
[эпик интерфейса](plans/03_interface_epic.md). **Все шесть его фаз готовы:** команда `kpot ui`
поднимает локальный сервер и открывает окно, которое проводит вас по шагам — выбрать папку,
прочитать план, разложить, — и все четыре гарантии всё это время на экране. Окно зовёт **тот же самый
исполнитель**, что и терминал (две реализации означали бы, что сухой прогон и настоящий однажды
разойдутся), сортировка не начнётся без вашего явного подтверждения, а закрытие браузера не
останавливает работу. Когда библиотека уже собрана, мастер уступает место пульту управления: три
прогона, которые можно запустить заново, ваши годы со ссылкой «Открыть» на каждый и история того,
что вы уже запускали — с кнопкой **«Вернуть как было» в каждой строке, где её ещё можно сдержать**, и
с подтверждением, которое называет прогон и число файлов. Там же — папка **«НОВОЕ»**: одно законное
место, куда складывать новые снимки; пульт показывает, сколько их там ждёт, и одна кнопка
раскладывает их по библиотеке ровно так же, как любая другая сортировка. И сам пакет готов: ZIP
на ~33 МБ, внутри — подписанный node.exe и наши `.mjs`, так что ни одной неподписанной программы
мы не приносим.


Дорожная карта: `MASTER_PLAN.md` · текущее состояние: `STATUS.md`.

### Технологии

Чистый Node.js ≥ 20, ESM (`.mjs`), без сборки, почти без зависимостей. Windows-first (длинные пути,
кириллица, зарезервированные имена — полноценно), переносимый по замыслу. Разрабатывается автономно
ИИ-агентами под фреймворком [KAIF](https://github.com/MikalaiKryvusha/KAIF) под управлением
видения владельца.

### Лицензия

MIT © 2026 Mikalai Kryvusha (KOT KRINIK)
