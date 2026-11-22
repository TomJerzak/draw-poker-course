import { useState } from 'react';
import { LESSONS, freePlayLesson } from './lessons/lessons';
import { GoalStatus } from './lessons/session';
import { Lesson } from './lessons/types';
import { loadNoticeAccepted, loadProgress, markCompleted, Progress, saveNoticeAccepted, saveProgress } from './state/progress';
import { DrillScreen } from './ui/DrillScreen';
import { PlayScreen } from './ui/PlayScreen';
import { FreePlaySetup, FreePlaySummary, FreeSettings, FreeStats, LessonIntro, LessonMap, LessonSummary, StartNotice } from './ui/screens';

type Screen =
  | { name: 'map' }
  | { name: 'intro'; lesson: Lesson }
  | { name: 'drill'; lesson: Lesson }
  | { name: 'play'; lesson: Lesson; attempt: number }
  | { name: 'summary'; lesson: Lesson; status: GoalStatus }
  | { name: 'freeSetup' }
  | { name: 'freeSummary'; stats: FreeStats };

export function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [noticeAccepted, setNoticeAccepted] = useState(loadNoticeAccepted);
  const [screen, setScreen] = useState<Screen>({ name: 'map' });
  const [attempt, setAttempt] = useState(0);
  const [freeSettings, setFreeSettings] = useState<FreeSettings | undefined>();
  const courseDone = progress.completed.includes(LESSONS[LESSONS.length - 1].id);
  const playFree = (st: FreeSettings) => {
    setFreeSettings(st);
    play(freePlayLesson(st.opponents, st.level, st.coach, Date.now() % 100000));
  };

  const update = (p: Progress) => {
    setProgress(p);
    saveProgress(p);
  };

  const play = (lesson: Lesson) => {
    setAttempt((a) => a + 1);
    setScreen({ name: 'play', lesson, attempt: attempt + 1 });
  };

  if (!noticeAccepted) {
    return (
      <StartNotice
        onAccept={() => {
          saveNoticeAccepted();
          setNoticeAccepted(true);
        }}
      />
    );
  }

  switch (screen.name) {
    case 'map':
      return (
        <LessonMap
          progress={progress}
          onOpen={(lesson) => setScreen({ name: 'intro', lesson })}
          onFreePlay={() => setScreen({ name: 'freeSetup' })}
          onReset={() => update({ completed: [] })}
        />
      );
    case 'intro':
      return (
        <LessonIntro
          lesson={screen.lesson}
          completed={progress.completed.includes(screen.lesson.id)}
          onStart={() => (screen.lesson.drill ? setScreen({ name: 'drill', lesson: screen.lesson }) : play(screen.lesson))}
          onBack={() => setScreen({ name: 'map' })}
        />
      );
    case 'drill':
      return <DrillScreen lesson={screen.lesson} onDone={() => play(screen.lesson)} onExit={() => setScreen({ name: 'map' })} />;
    case 'play': {
      const { lesson } = screen;
      // Kolejne podejścia do lekcji mają inne losowe rozdania (scenariusze zostają te same).
      const seed = lesson.seed + screen.attempt * 7919;
      return (
        <PlayScreen
          key={screen.attempt}
          lesson={lesson}
          seed={seed}
          onExit={() => setScreen({ name: 'map' })}
          onFreeEnd={(stats) => setScreen({ name: 'freeSummary', stats })}
          onFinish={(status) => {
            if (status.passed && lesson.id !== 'free') update(markCompleted(progress, lesson.id));
            setScreen({ name: 'summary', lesson, status });
          }}
        />
      );
    }
    case 'summary': {
      const idx = LESSONS.indexOf(screen.lesson);
      const next = LESSONS[idx + 1];
      return (
        <LessonSummary
          lesson={screen.lesson}
          status={screen.status}
          onRetry={() => play(screen.lesson)}
          onNext={next ? () => setScreen({ name: 'intro', lesson: next }) : undefined}
          onMenu={() => setScreen({ name: 'map' })}
          onFreePlay={() => setScreen({ name: 'freeSetup' })}
          completedCount={LESSONS.filter((l) => progress.completed.includes(l.id)).length}
        />
      );
    }
    case 'freeSetup':
      return (
        <FreePlaySetup
          initial={freeSettings}
          courseDone={courseDone}
          onBack={() => setScreen({ name: 'map' })}
          onStart={playFree}
        />
      );
    case 'freeSummary':
      return (
        <FreePlaySummary
          stats={screen.stats}
          onAgain={() => playFree(freeSettings!)}
          onSettings={() => setScreen({ name: 'freeSetup' })}
          onMenu={() => setScreen({ name: 'map' })}
        />
      );
  }
}
