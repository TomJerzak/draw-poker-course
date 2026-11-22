# Kurs Pokera

Przeglądarkowa gra ucząca pokera pięciokartowego dobieranego (5-card draw) w trybie solo, przeciwko botom.
Kurs składa się z 14 lekcji i zakłada, że uczeń nie zna pokera. Kolejne lekcje wprowadzają po jednej nowej
zasadzie. W skład kursu wchodzą:

- pokazowe rozdanie z objaśnieniem każdego kroku,
- ćwiczenia „znajdź układ”,
- quizy z wyjaśnieniem wyniku,
- licytacja wprowadzana w trzech krokach,
- egzamin oceniający decyzje, a nie szczęście.

Pojęcia mają dymki ze słowniczka, a ściąga z układami jest zawsze pod ręką. Po kursie dostępna jest wolna gra.

Wersja online znajduje się pod adresem: <https://draw-poker-course.web.app>

## Technologie

- [React 18](https://react.dev) – interfejs gry
- [TypeScript](https://www.typescriptlang.org) – cały kod, łącznie z silnikiem gry
- [Vite](https://vite.dev) – serwer deweloperski i budowanie wersji produkcyjnej
- [Vitest](https://vitest.dev) – testy automatyczne
- [Firebase Hosting](https://firebase.google.com/docs/hosting) – publikacja strony

## Wymagania

Node.js 22.12 lub nowszy (wersje 22, 24 albo 26+).

## Uruchomienie

Poniższe instrukcje służą do pracy nad kursem. Wykorzystanie kodu lub treści poza przeglądaniem wymaga zgody autora –
szczegóły w sekcji [Licencja](#licencja).

```bash
npm install
npm run dev      # http://localhost:5179 (stały port – patrz niżej)
npm test         # testy silnika, botów i lekcji
npm run build    # statyczna wersja w dist/
npm run preview  # podgląd zbudowanej wersji pod tym samym adresem
```

Port 5179 jest ustawiony na stałe w [vite.config.ts](vite.config.ts). Postęp kursu jest zapisywany w localStorage
przeglądarki, a ten jest przypisany do adresu razem z portem – pod innym portem postęp byłby pusty. Jeśli port jest
zajęty, serwer nie wystartuje (zamiast po cichu wybrać inny) – wtedy zamknij proces, który go używa.

## Publikacja (Firebase Hosting)

Projekt Firebase: `draw-poker-course`.
Aktualizacja po zmianach: `npm run deploy` – uruchamia testy, buduje grę i wysyła ją na Firebase.
Publikacja wymaga dostępu do tego projektu. Za pierwszym razem na nowym komputerze trzeba się zalogować:
`npx firebase-tools@15.35.0 login`.

## Struktura

- `src/engine/` – karty, ocena układów, przebieg rozdania (bez Reacta)
- `src/bots/` – strategia wymiany, siła ręki, boty (łatwy / średni / trudny)
- `src/lessons/` – treść lekcji (`lessons.ts`), sesja lekcji, trener i narrator, wyjaśnienia wyników
  (`explain.ts`), słowniczek (`glossary.ts`)
- `src/ui/` – stół, karty, ćwiczenie „znajdź układ”, ściąga z układami, słowniczek, ekrany menu
- `src/App.tsx` – przechodzenie między ekranami
- `src/state/progress.ts` – zapis postępu w localStorage

## Jak dodać lekcję

Dopisz obiekt do tablicy `LESSONS` w [src/lessons/lessons.ts](src/lessons/lessons.ts). Pola opisuje typ `Lesson`
w [src/lessons/types.ts](src/lessons/types.ts). Najważniejsze to reguły gry (`rules`: ante, licytacja, wymiana),
opcjonalne reżyserowane rozdania (`scripted`: karty dla każdego miejsca, karty do dobrania, komentarze przed i po
rozdaniu), opcjonalne ćwiczenie (`drill`) oraz cel (`goal`). Test w `lessons.test.ts` automatycznie sprawdza, czy nową
lekcję da się zaliczyć, grając zgodnie z radami trenera.

Uwaga: lekcja odblokowuje się po zaliczeniu poprzedniej, a zaliczenia są zapisane w przeglądarkach uczniów pod `id`
lekcji. Nie zmieniaj `id` istniejących lekcji, bo uczniowie stracą zaliczenie. Nowe lekcje najlepiej dodawać na końcu,
bo wstawienie lekcji w środek zablokuje następne lekcje osobom, które już je przeszły.

## Licencja

Wszelkie prawa zastrzeżone – szczegóły w pliku [LICENSE](LICENSE).
