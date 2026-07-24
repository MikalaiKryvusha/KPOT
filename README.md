# KPOT — Krinik Photo Organizer Tool

[🇬🇧 English](#english) · [🇷🇺 Русский](#русский)

![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-Phase%201%20·%20research-orange)
![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen)
![Platform](https://img.shields.io/badge/platform-Windows--first-blue)
![Framework](https://img.shields.io/badge/powered%20by-KAIF%201.5-purple)

---

## English

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

🚧 **Early development.** The tool is not usable yet (every phase reports "not implemented", exit
code 3). What already exists and is verified by tests (15/15 green):

- [Prior-art research](researches/01_prior_art.md) — what we reuse (`exifreader`, `node:crypto`)
  vs. write ourselves (MP4/MOV date parser, evidence-based date resolver, all product logic).
- [Real-archive survey](researches/02_real_archive_survey.md) — anonymized study of a real 71 000-file
  / 551 GB messy archive: the filename-pattern zoo, name hazards and duplicate rates the tool must
  survive. Fixtures are built from this catalog, the real archive is never touched by tests.
- All product decisions closed by the owner ([interview #001](interviews/interview_001_extractor_seasons_policies.md)):
  pure-JS metadata extraction, five season buckets, `видео/` + `аудио/` subdirs, junk quarantine
  with provenance, rename-based moves.
- [CLI skeleton](bin/kpot.mjs) — `scan` / `plan` / `apply --dry-run` / `rollback` dispatch with a
  stable exit-code contract · [fixture generator](tests/fixtures/make.mjs) — deterministic messy tree
  with 25 planted chaos cases + ground-truth manifest · [season mapping](src/plan/season.mjs).

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

🚧 **Ранняя разработка.** Инструментом пользоваться пока нельзя (каждая фаза отвечает «не
реализовано», код выхода 3). Что уже существует и проверено тестами (15/15 зелёных):

- [Исследование готовых решений](researches/01_prior_art.md) — что берём готовое (`exifreader`,
  `node:crypto`), что пишем сами (парсер дат MP4/MOV, резолвер даты по уликам, вся продуктовая логика).
- [Обзор реального архива](researches/02_real_archive_survey.md) — обезличенное исследование
  настоящего бардака на 71 000 файлов / 551 ГБ: зоопарк паттернов имён, опасные имена и доля
  дубликатов, которые инструмент обязан пережить. Тестовые фикстуры строятся по этому каталогу,
  реальный архив тестами не затрагивается.
- Все продуктовые решения закрыты владельцем ([интервью #001](interviews/interview_001_extractor_seasons_policies.md)):
  чистый JS для метаданных, пять сезонов, подпапки `видео/` и `аудио/`, карантин мусора с записью
  происхождения, перемещения переименованием.
- [Скелет CLI](bin/kpot.mjs) — диспетчер `scan` / `plan` / `apply --dry-run` / `rollback` со
  стабильным контрактом кодов выхода · [генератор фикстур](tests/fixtures/make.mjs) —
  детерминированное «бардачное» дерево из 25 случаев хаоса с эталоном ответов ·
  [маппинг сезонов](src/plan/season.mjs).

Дорожная карта: `MASTER_PLAN.md` · текущее состояние: `STATUS.md`.

### Технологии

Чистый Node.js ≥ 20, ESM (`.mjs`), без сборки, почти без зависимостей. Windows-first (длинные пути,
кириллица, зарезервированные имена — полноценно), переносимый по замыслу. Разрабатывается автономно
ИИ-агентами под фреймворком [KAIF](https://github.com/MikalaiKryvusha/KAIF) под управлением
видения владельца.

### Лицензия

MIT © 2026 Mikalai Kryvusha (KOT KRINIK)
