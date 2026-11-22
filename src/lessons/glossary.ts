export interface GlossaryEntry {
  term: string;
  /** Formy słowa, które w tekstach są podświetlane jako pojęcie. */
  forms: string[];
  definition: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  // Podstawy
  { term: 'Rozdanie', forms: [], definition: 'Jedna rozgrywka: od rozdania kart do podziału puli. Gra składa się z wielu rozdań.' },
  { term: 'Ręka', forms: [], definition: 'Pięć kart, które trzyma gracz.' },
  {
    term: 'Układ',
    forms: [],
    definition: 'Kombinacja kart w ręce, np. para albo strit. Lepszy układ wygrywa. Zawsze liczy się najwyższy układ, jaki tworzą karty – kolejność układów pokazuje ściąga „Układy”.',
  },
  {
    term: 'Kolor',
    forms: [],
    definition: 'Słowo o dwóch znaczeniach: kolor karty (pik ♠, kier ♥, karo ♦, trefl ♣) albo układ Kolor – pięć kart w jednym kolorze. Kolory kart są w pokerze równe.',
  },
  { term: 'Poker', forms: [], definition: 'Nazwa gry i zarazem najwyższego układu: strit w jednym kolorze, np. 5-6-7-8-9 w karo.' },
  { term: 'Koło', forms: ['koło'], definition: 'Strit A-2-3-4-5 – as liczy się tu jako najniższa karta. To najniższy możliwy strit.' },
  {
    term: 'Otwarty strit',
    forms: ['otwarty strit'],
    definition: 'Cztery kolejne karty, które można uzupełnić z obu stron, np. 5-6-7-8 (pasuje 4 albo 9). Daje około 17% szansy na strita po wymianie jednej karty.',
  },
  {
    term: 'Kicker',
    forms: ['kicker', 'kickery', 'kickerów'],
    definition: 'Karta spoza układu, która rozstrzyga, gdy gracze mają taki sam układ – np. gdy każdy ma parę dam, wygrywa ten z wyższą pozostałą kartą.',
  },

  // Żetony i pula
  {
    term: 'Pula',
    forms: ['pula', 'puli', 'pulę', 'pulą'],
    definition: 'Wszystkie żetony postawione w rozdaniu – ante i zakłady. Zabiera je zwycięzca, a przy remisie pula jest dzielona.',
  },
  { term: 'Ante', forms: ['ante'], definition: 'Wpisowe – mała stała kwota (tu 1 żeton), którą każdy wpłaca do puli przed rozdaniem kart.' },
  { term: 'Split pot', forms: ['split pot'], definition: 'Podział puli po równo, gdy kilku graczy ma identyczne układy (remis).' },
  {
    term: 'All-in',
    forms: ['all-in'],
    definition: 'Postawienie wszystkich swoich żetonów, gdy nie starcza ich na pełną dopłatę. Gracz all-in może wygrać tylko tę część puli, do której zdążył dopłacić.',
  },

  // Przebieg rozdania
  {
    term: 'Runda licytacji',
    forms: [],
    definition: 'Gracze po kolei czekają, stawiają, sprawdzają, podbijają albo pasują. Runda kończy się, gdy każdy wykonał ruch i wszyscy, którzy nie spasowali, wpłacili tyle samo. W rozdaniu są dwie rundy: przed wymianą i po niej.',
  },
  {
    term: 'Wymiana',
    forms: [],
    definition: 'Faza między rundami licytacji: każdy może raz odrzucić od 0 do 3 kart i dostać tyle samo nowych z talii. Inni widzą, ile kart wymieniasz, ale nie jakie.',
  },
  { term: 'Stać (stand pat)', forms: ['stoisz', 'stoi', 'stój'], definition: 'Nie wymieniać żadnej karty. Zwykle świadczy o gotowym układzie (albo o blefie).' },
  {
    term: 'Showdown',
    forms: ['showdown'],
    definition: 'Odkrycie kart na końcu rozdania. Gracze, którzy nie spasowali, pokazują ręce i wygrywa najlepszy układ. Gdy wszyscy poza jednym spasowali, do showdownu nie dochodzi.',
  },
  {
    term: 'Dealer button',
    forms: ['dealer button'],
    definition: 'Żeton „D” oznaczający rozdającego. Przesuwa się co rozdanie. Licytację zaczyna gracz po lewej stronie rozdającego, a rozdający decyduje ostatni.',
  },
  {
    term: 'Fixed-limit',
    forms: ['fixed-limit'],
    definition: 'Odmiana licytacji ze stałą wysokością zakładu (tu: 2 przed wymianą, 4 po niej) i limitem 4 zakładów w rundzie.',
  },

  // Ruchy w licytacji
  {
    term: 'Check (czekanie)',
    forms: ['check'],
    definition: 'Nic nie wpłacasz i oddajesz ruch dalej. Można to zrobić tylko wtedy, gdy nikt w tej rundzie jeszcze nie postawił.',
  },
  {
    term: 'Bet (zakład)',
    forms: ['bet'],
    definition: 'Pierwszy zakład w rundzie – wpłacasz do puli stałą stawkę. Pozostali muszą wtedy dopłacić tyle samo, podbić albo spasować.',
  },
  {
    term: 'Call (sprawdzenie)',
    forms: ['call'],
    definition: 'Dopłacasz tyle, żeby Twoja wpłata w tej rundzie zrównała się z najwyższym zakładem, i zostajesz w grze.',
  },
  {
    term: 'Raise (podbicie)',
    forms: ['raise'],
    definition: 'Wyrównujesz zakład rywala i dokładasz kolejną stawkę. Pozostali muszą znowu dopłacić albo spasować.',
  },
  {
    term: 'Fold (pas)',
    forms: ['fold'],
    definition: 'Oddajesz karty i rezygnujesz z puli. Żetony już wpłacone przepadają. Nie pasuj, gdy możesz czekać za darmo.',
  },

  // Strategia
  { term: 'Outs', forms: ['outs'], definition: 'Karty w talii, które poprawią Twoją rękę do pożądanego układu – np. 9 kart w kolorze, gdy masz cztery karty do koloru.' },
  {
    term: 'Pot odds',
    forms: ['pot odds'],
    definition: 'Ile musisz dopłacić w stosunku do całej puli, o którą walczysz. Liczysz: dopłata ÷ (pula + dopłata), np. 2 ÷ (8 + 2) = 20%. Sprawdzenie opłaca się, gdy wygrywasz częściej niż ten procent. To przybliżenie, bo nie uwzględnia zakładów w dalszej części rozdania.',
  },
  { term: 'Blef', forms: ['blef', 'blefu', 'blefuje', 'blefem', 'blefuj'], definition: 'Zakład albo podbicie słabą ręką, żeby rywale spasowali – np. granie bez wymiany kart, choć nie ma się układu.' },
];

const FORM_TO_ENTRY = new Map<string, GlossaryEntry>();
GLOSSARY.forEach((e) => e.forms.forEach((f) => FORM_TO_ENTRY.set(f, e)));

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PATTERN = new RegExp(
  `(?<![\\p{L}-])(${[...FORM_TO_ENTRY.keys()].sort((a, b) => b.length - a.length).map(escape).join('|')})(?![\\p{L}-])`,
  'giu',
);

export type TextPart = string | { text: string; entry: GlossaryEntry };

/** Dzieli tekst na fragmenty; pierwsze wystąpienie każdego pojęcia jest oznaczone. */
export function splitTerms(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const seen = new Set<GlossaryEntry>();
  let last = 0;
  for (const m of text.matchAll(PATTERN)) {
    const entry = FORM_TO_ENTRY.get(m[0].toLowerCase());
    if (!entry || seen.has(entry)) continue;
    seen.add(entry);
    if (m.index! > last) parts.push(text.slice(last, m.index));
    parts.push({ text: m[0], entry });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
