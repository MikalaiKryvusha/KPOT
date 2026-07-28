<p align="center">
  <img src="assets/KPOT.jpg" alt="KPOT — Krinik Photo Organizer Tool" width="420">
</p>

# KPOT — Krinik Photo Organizer Tool

![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-all%20phases%20work%20·%20sorted%20a%20real%20archive-brightgreen)
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

### Status

🚧 **All four phases work end to end, and the tool has now sorted a real archive.** Verified by
171 green tests *and* by a supervised run on a 3 397-file / 13 GB sample of a genuinely messy
551 GB collection.

```
kpot scan <dir>               what each file is, and when it was taken — with the evidence
kpot plan <dir>               the pre-sort master plan you read BEFORE anything moves
kpot apply --dry-run <dir>    full rehearsal, zero writes
kpot apply <dir>              the sort — refuses to start without a verified backup
kpot rollback <run-id> <dir>  everything back where it was
```

**On that real run:** 3 154 files sorted in 7 seconds, 0 failures, and the multiset of SHA-256
content hashes was *identical* before and after — nothing lost, nothing invented. The rollback
rehearsal restores all 3 154 files and 495 folders.

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
- **Idempotent** — sorting an already-sorted library moves nothing.
- Grounded in real chaos: [prior-art research](researches/01_prior_art.md) ·
  [real-archive survey](researches/02_real_archive_survey.md) ·
  [the first real run](researches/03_first_real_run.md), which found four bugs no synthetic fixture had.

Still ahead: a tagged release; then, at the owner's word, pixel-level search for a lost photo's
original ([plan 02](plans/02_lost_photo_family.md), steps 2–3).

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

### Статус

🚧 **Все четыре фазы работают от начала до конца, и инструмент уже разобрал настоящий архив.**
Проверено 171 зелёным тестом *и* контролируемым прогоном на выборке из 3 397 файлов / 13 ГБ,
взятой из по-настоящему захламлённой коллекции на 551 ГБ.

```
kpot scan <dir>               что за файл и когда снят — вместе с уликами
kpot plan <dir>               пред-сортировочный мастер-план: читаете ДО того, как что-то тронется
kpot apply --dry-run <dir>    полная репетиция, ноль записей
kpot apply <dir>              сортировка — не начнётся без проверенного бэкапа
kpot rollback <run-id> <dir>  всё возвращается как было
```

**Тот самый прогон:** 3 154 файла разложены за 7 секунд, 0 сбоев, а множество SHA-256 содержимого
до и после — *идентично*: ничего не потеряно и ничего не выдумано. Репетиция отката возвращает все
3 154 файла и 495 папок.

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
- **Идемпотентность** — сортировка уже разобранной библиотеки не двигает ничего.
- Опирается на реальный хаос: [исследование готовых решений](researches/01_prior_art.md) ·
  [обзор реального архива](researches/02_real_archive_survey.md) ·
  [первый настоящий прогон](researches/03_first_real_run.md), который нашёл четыре бага, невидимых
  ни одной синтетической фикстуре.

Впереди: релиз с тегом; затем, по слову владельца, — поиск оригинала потерявшегося фото по
пикселям ([план 02](plans/02_lost_photo_family.md), шаги 2–3).


Дорожная карта: `MASTER_PLAN.md` · текущее состояние: `STATUS.md`.

### Технологии

Чистый Node.js ≥ 20, ESM (`.mjs`), без сборки, почти без зависимостей. Windows-first (длинные пути,
кириллица, зарезервированные имена — полноценно), переносимый по замыслу. Разрабатывается автономно
ИИ-агентами под фреймворком [KAIF](https://github.com/MikalaiKryvusha/KAIF) под управлением
видения владельца.

### Лицензия

MIT © 2026 Mikalai Kryvusha (KOT KRINIK)
