// src/ui/i18n.mjs — every word the interface says, in both languages (6.2b, plans/06).
// [NOT-TESTED]
//
// The owner asked for Russian AND English with a switch (interview #003 Q8 = Б), Russian by default.
// The dictionary exists from the FIRST string rather than being retrofitted, because retrofitting
// i18n means visiting every line of markup again — cheap as discipline now, expensive later.
//
// The harder requirement is the other one, and it applies to every value below, in his capitals:
// «ОЧЕНЬ ЮЗЕР ФРЕНДЛИ, С ЗАЩИТАМИ ОТ ДУРАКА, НАПИСАННЫЙ ПОПУЛЯРНЫМ ПРОСТЫМ ДЛЯ ПОНИМАНИЯ ЯЗЫКОМ,
// АКАДЕМИЧЕСКИМ, БЕЗ ЖАРГОНИЗМОВ И СЛЕНГА». So the rules for writing a string here are:
//
//   · name what the person gets, not what the program does («Изучаю папку», not «Сканирование»);
//   · no computer words: no «сканирование», «хеш», «EXIF», «dry-run», «бэкап» without explanation;
//   · say what is safe BEFORE saying what is possible — this product's whole promise is that
//     nothing is lost;
//   · a refusal explains what to do next, never only what went wrong.

/** The default, and the one the owner reads. */
export const DEFAULT_LANG = 'ru';

export const STRINGS = Object.freeze({
  ru: {
    appTitle: 'Krinik Photo Organizer Tool (KPOT)',
    appSubtitle: 'Наведём порядок в ваших фотографиях',

    stepOf: 'Шаг %1 из %2',
    step1: 'Папка',
    step2: 'Изучаю',
    step3: 'План',
    step4: 'Готово',

    // Step 1 — choose the folder
    chooseTitle: 'С какой папкой работаем?',
    chooseHelp: 'Выберите папку, где лежат ваши фотографии и видео. Внутри неё может быть какой '
      + 'угодно беспорядок — с ним и разберёмся.',
    chooseUp: 'На уровень выше',
    chooseEmpty: 'Внутри нет вложенных папок — можно выбрать эту.',
    chooseUnreadable: 'Эту папку открыть не удалось. Вернитесь назад и выберите другую.',
    chooseSelected: 'Выбрано:',
    chooseThis: 'Работать с этой папкой',

    // Step 2 — looking
    lookTitle: 'Изучаю вашу папку',
    lookHelp: 'Сейчас ничего не меняется: я только смотрю, что за файлы внутри и когда они сняты.',

    // Step 3 — the plan
    planTitle: 'Вот что получится',
    planHelp: 'Это план. Пока вы не нажмёте кнопку, ни один файл не сдвинется с места.',
    planMoves: 'Переедет файлов',
    planStay: 'Останется на месте',
    planDuplicates: 'Найдено копий',
    planDisputed: 'Спорных случаев',
    planAwaiting: 'Папок ждут вашего решения',
    planShowFull: 'Показать подробный план',
    planHideFull: 'Свернуть подробный план',
    planNothing: 'Двигать нечего — здесь уже порядок.',

    // The one deliberate confirmation
    confirmTitle: 'Разложить файлы по годам?',
    confirmBody: 'Перемещу %1 файлов. Перед этим сделаю запасную копию, и всё можно будет вернуть '
      + 'обратно одной кнопкой.',
    confirmCancel: 'Отмена',
    confirmGo: 'Да, разложить',

    // Step 4 — done
    doneTitle: 'Готово',
    doneHelp: 'Файлы разложены по годам и порам года.',
    doneMoved: 'Перемещено файлов',
    doneOpen: 'Открыть папку',
    doneUndo: 'Вернуть всё как было',

    // The four guarantees, always visible (GOAL.md)
    guaranteeMap: 'Карта: видно, что куда переедет',
    guaranteeBackup: 'Запасная копия делается до сортировки',
    guaranteeDry: 'Сначала репетиция, без изменений',
    guaranteeUndo: 'Откат: всё возвращается назад',

    // The control panel — what the wizard gives way to once a library exists
    panelTitle: 'Ваша библиотека',
    panelHelp: 'Всё уже разложено. Отсюда можно запустить любой прогон заново, посмотреть папки и '
      + 'при желании вернуть всё назад.',
    panelRunScan: 'Посмотреть, что в папке',
    panelRunScanHelp: 'Ничего не меняет: просто заново изучает файлы.',
    panelRunPlan: 'Составить план',
    panelRunPlanHelp: 'Покажет, что и куда переехало бы сейчас.',
    panelRunApply: 'Разложить новое',
    panelRunApplyHelp: 'Разложит то, что появилось с прошлого раза.',
    panelYears: 'По годам',
    panelOpen: 'Открыть',
    panelNoYears: 'Годов пока не видно — возможно, вы ещё не запускали сортировку.',
    panelAttention: 'Требует вашего внимания',
    panelAttentionNone: 'Ничего не ждёт вашего решения.',
    panelBackToWizard: 'Работать с другой папкой',
    panelHistory: 'Что вы уже запускали',
    panelHistoryNone: 'Пока ничего не запускалось.',
    panelHistoryDry: 'репетиция, ничего не двигалось',
    panelHistoryMoved: 'перемещено файлов:',
    panelHistoryUndoable: 'можно вернуть как было',
    panelHistoryNotUndoable: 'вернуть уже нельзя',

    // Shared
    back: 'Назад',
    next: 'Дальше',
    retry: 'Попробовать снова',
    shutdown: 'Завершить работу',
    shutdownDone: 'Программа выключена. Окно можно закрыть.',
    closeSafe: 'Окно можно закрыть — работа продолжится.',
    busy: 'Сейчас уже идёт работа. Дождитесь окончания.',
    failed: 'Не получилось',
    langName: 'English',
  },

  en: {
    appTitle: 'Krinik Photo Organizer Tool (KPOT)',
    appSubtitle: 'Let us put your photographs in order',

    stepOf: 'Step %1 of %2',
    step1: 'Folder',
    step2: 'Looking',
    step3: 'Plan',
    step4: 'Done',

    chooseTitle: 'Which folder shall we work with?',
    chooseHelp: 'Pick the folder holding your photographs and videos. However disorderly it is '
      + 'inside, that is exactly what we are here to sort out.',
    chooseUp: 'Up one level',
    chooseEmpty: 'There are no folders inside — you can choose this one.',
    chooseUnreadable: 'This folder could not be opened. Go back and choose another.',
    chooseSelected: 'Chosen:',
    chooseThis: 'Use this folder',

    lookTitle: 'Looking through your folder',
    lookHelp: 'Nothing is being changed: I am only seeing what is inside and when it was taken.',

    planTitle: 'Here is what will happen',
    planHelp: 'This is a plan. Until you press the button, not a single file moves.',
    planMoves: 'Files to move',
    planStay: 'Staying where they are',
    planDuplicates: 'Copies found',
    planDisputed: 'Cases needing your eye',
    planAwaiting: 'Folders awaiting your decision',
    planShowFull: 'Show the detailed plan',
    planHideFull: 'Hide the detailed plan',
    planNothing: 'Nothing to move — this is already in order.',

    confirmTitle: 'Sort the files by year?',
    confirmBody: 'I will move %1 files. A backup is made first, and everything can be put back '
      + 'with one button.',
    confirmCancel: 'Cancel',
    confirmGo: 'Yes, sort them',

    doneTitle: 'Done',
    doneHelp: 'Your files are arranged by year and season.',
    doneMoved: 'Files moved',
    doneOpen: 'Open the folder',
    doneUndo: 'Put everything back',

    guaranteeMap: 'A map: you see what goes where',
    guaranteeBackup: 'A backup is made before sorting',
    guaranteeDry: 'A rehearsal first, changing nothing',
    guaranteeUndo: 'Undo: everything can be put back',

    panelTitle: 'Your library',
    panelHelp: 'Everything is already arranged. From here you can run anything again, look at the '
      + 'folders, and put it all back if you wish.',
    panelRunScan: 'Look at the folder',
    panelRunScanHelp: 'Changes nothing: it simply looks at the files again.',
    panelRunPlan: 'Build a plan',
    panelRunPlanHelp: 'Shows what would move where right now.',
    panelRunApply: 'Arrange what is new',
    panelRunApplyHelp: 'Arranges whatever has appeared since last time.',
    panelYears: 'By year',
    panelOpen: 'Open',
    panelNoYears: 'No years yet — you may not have run the sorting.',
    panelAttention: 'Needs your attention',
    panelAttentionNone: 'Nothing is waiting for your decision.',
    panelBackToWizard: 'Work with another folder',
    panelHistory: 'What you have run so far',
    panelHistoryNone: 'Nothing has been run yet.',
    panelHistoryDry: 'a rehearsal, nothing was moved',
    panelHistoryMoved: 'files moved:',
    panelHistoryUndoable: 'can be put back',
    panelHistoryNotUndoable: 'can no longer be put back',

    back: 'Back',
    next: 'Next',
    retry: 'Try again',
    shutdown: 'Shut the program down',
    shutdownDone: 'The program is off. You can close this window.',
    closeSafe: 'You can close this window — the work continues.',
    busy: 'Work is already under way. Please wait for it to finish.',
    failed: 'That did not work',
    langName: 'Русский',
  },
});

/** Every key must exist in every language — a missing string is a blank space in someone's window. */
export function missingKeys() {
  const langs = Object.keys(STRINGS);
  const all = new Set(langs.flatMap((l) => Object.keys(STRINGS[l])));
  const missing = [];
  for (const lang of langs) {
    for (const key of all) if (!(key in STRINGS[lang])) missing.push(`${lang}.${key}`);
  }
  return missing.sort();
}
