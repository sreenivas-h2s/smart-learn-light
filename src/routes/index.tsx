import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  Camera,
  CheckCircle2,
  Compass,
  Lightbulb,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CameraCapture } from "@/components/CameraCapture";
import { KnowledgeMap, type Skill } from "@/components/KnowledgeMap";
import { useSpeechRecognition, useSpeechSynthesis } from "@/hooks/use-speech";
import { tutorTurn, type TutorTurn } from "@/lib/tutor.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumen — Adaptive Learning Intelligence" },
      {
        name: "description",
        content:
          "Lumen is an AI tutor that tracks your evolving knowledge state and adapts every explanation, question, and hint to how you actually learn.",
      },
      { property: "og:title", content: "Lumen — Adaptive Learning Intelligence" },
      {
        property: "og:description",
        content:
          "A calm, adaptive AI tutor with voice and camera learning that personalizes every step to your knowledge state.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const SUGGESTIONS = [
  "Photosynthesis",
  "Derivatives in calculus",
  "How neural networks learn",
  "Spanish past tense",
  "Supply and demand",
];

type Phase = "setup" | "loading" | "lesson";

function Home() {
  const runTurn = useServerFn(tutorTurn);

  const [phase, setPhase] = useState<Phase>("setup");
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("");
  const [pace, setPace] = useState(3);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [turn, setTurn] = useState<TutorTurn | null>(null);
  const [history, setHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [ask, setAsk] = useState("");
  const [streak, setStreak] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const speech = useSpeechRecognition();
  const voice = useSpeechSynthesis();
  const lessonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (speech.transcript) {
      if (phase === "setup") setTopic(speech.transcript);
      else setAsk(speech.transcript);
    }
  }, [speech.transcript, phase]);

  const overall = useMemo(
    () =>
      skills.length
        ? Math.round(skills.reduce((a, s) => a + s.mastery, 0) / skills.length)
        : 0,
    [skills],
  );

  async function go(opts: {
    mode: "start" | "answer" | "ask" | "scan";
    userText?: string;
    image?: string | null;
    topicOverride?: string;
  }) {
    const activeTopic = opts.topicOverride ?? topic;
    if (!activeTopic.trim() && !opts.image) {
      toast.error("Tell me what you'd like to learn first.");
      return;
    }
    setBusy(true);
    if (phase === "setup") setPhase("loading");
    voice.cancel();
    try {
      const result = await runTurn({
        data: {
          topic: activeTopic || "the material in the image",
          goal,
          pace,
          skills,
          history,
          userText: opts.userText ?? "",
          image: opts.image ?? null,
          mode: opts.mode,
        },
      });
      setTurn(result);
      setSkills(result.skillUpdates);
      setSelected(null);
      setShowHint(false);
      setPhase("lesson");
      setHistory((h) =>
        [
          ...h,
          ...(opts.userText ? [{ role: "user" as const, content: opts.userText }] : []),
          { role: "assistant" as const, content: `${result.concept}: ${result.question.prompt}` },
        ].slice(-10),
      );
      voice.speak(result.say);
      requestAnimationFrame(() =>
        lessonRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      toast.error(message);
      if (phase === "loading") setPhase("setup");
    } finally {
      setBusy(false);
    }
  }

  function answer(index: number) {
    if (selected !== null || !turn) return;
    setSelected(index);
    const correct = index === turn.question.answerIndex;
    setAnswered((n) => n + 1);
    setCorrectCount((n) => n + (correct ? 1 : 0));
    setStreak((s) => (correct ? s + 1 : 0));
    voice.speak(correct ? "Nice — that's right." : "Not quite, let's look at why.");
  }

  function nextStep() {
    if (!turn || selected === null) return;
    const correct = selected === turn.question.answerIndex;
    go({
      mode: "answer",
      userText: `Question: "${turn.question.prompt}". I chose "${turn.question.options[selected]}" which was ${
        correct ? "correct" : "incorrect"
      }. Adapt difficulty and teach the next step.`,
    });
  }

  function reset() {
    voice.cancel();
    setPhase("setup");
    setTurn(null);
    setSkills([]);
    setHistory([]);
    setSelected(null);
    setStreak(0);
    setAnswered(0);
    setCorrectCount(0);
  }

  const micButton = (
    <Button
      type="button"
      variant={speech.listening ? "default" : "outline"}
      size="icon"
      className="rounded-full"
      aria-label={speech.listening ? "Stop listening" : "Speak"}
      onClick={() => (speech.listening ? speech.stop() : speech.start())}
      disabled={!speech.supported}
    >
      {speech.listening ? <MicOff className="size-4 breathe" /> : <Mic className="size-4" />}
    </Button>
  );

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-2xl bg-primary/12 text-primary">
            <Sparkles className="size-5" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">Lumen</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label={voice.enabled ? "Mute tutor voice" : "Unmute tutor voice"}
            onClick={() => {
              voice.cancel();
              voice.setEnabled(!voice.enabled);
            }}
          >
            {voice.enabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>
          {phase === "lesson" && (
            <Button variant="outline" size="sm" className="rounded-full" onClick={reset}>
              <RotateCcw className="mr-2 size-3.5" /> New topic
            </Button>
          )}
        </div>
      </header>

      {phase === "setup" && (
        <section className="mx-auto max-w-3xl px-5 pb-24 pt-6 text-center rise">
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
            Adaptive Learning Intelligence
          </Badge>
          <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            Learning that <span className="gradient-text">reshapes itself</span> around you
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            Lumen models your evolving knowledge state — then tunes every explanation, analogy,
            and question to your pace. Speak it, type it, or show it to the camera.
          </p>

          <div className="surface mx-auto mt-10 rounded-3xl p-5 text-left sm:p-7">
            <label className="text-sm font-medium" htmlFor="topic">
              What do you want to understand?
            </label>
            <div className="mt-2 flex gap-2">
              <Input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Bayes' theorem, or say it out loud"
                className="h-12 rounded-2xl bg-background/70 text-base"
                onKeyDown={(e) => e.key === "Enter" && go({ mode: "start" })}
              />
              {micButton}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-full"
                aria-label="Scan with camera"
                onClick={() => setCameraOpen(true)}
              >
                <Camera className="size-4" />
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setTopic(s)}
                  className="rounded-full border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium" htmlFor="goal">
                  Your goal <span className="text-muted-foreground">(optional)</span>
                </label>
                <Input
                  id="goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Pass my exam in two weeks"
                  className="mt-2 h-11 rounded-2xl bg-background/70"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Pace</label>
                <Slider
                  value={[pace]}
                  onValueChange={(v) => setPace(v[0])}
                  min={1}
                  max={5}
                  step={1}
                  className="mt-5"
                />
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>Gentle</span>
                  <span>Intense</span>
                </div>
              </div>
            </div>

            <Button
              className="mt-7 h-12 w-full rounded-2xl text-base"
              onClick={() => go({ mode: "start" })}
              disabled={busy}
            >
              Start my adaptive session
            </Button>
          </div>

          <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
            {[
              { icon: Brain, title: "Knowledge tracking", body: "Live mastery per sub-skill." },
              { icon: Compass, title: "Adaptive path", body: "Difficulty tuned every answer." },
              { icon: Camera, title: "Voice & vision", body: "Ask aloud, scan any page." },
            ].map((f) => (
              <div key={f.title} className="surface rounded-2xl p-4">
                <f.icon className="size-5 text-primary" />
                <p className="mt-2.5 text-sm font-semibold">{f.title}</p>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {phase === "loading" && (
        <section className="mx-auto max-w-2xl px-5 py-24 text-center">
          <div className="mx-auto size-16 rounded-full bg-primary/15 breathe" />
          <p className="mt-6 font-display text-xl">Mapping what you already know…</p>
          <p className="mt-1 text-sm text-muted-foreground">Building your first adaptive step.</p>
          <div className="surface mx-auto mt-8 space-y-3 rounded-3xl p-6 text-left">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </section>
      )}

      {phase === "lesson" && turn && (
        <section
          ref={lessonRef}
          className="mx-auto grid max-w-6xl gap-6 px-5 pb-24 lg:grid-cols-[1.7fr_1fr]"
        >
          <div className="space-y-6">
            <div className="surface rounded-3xl p-6 rise sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full capitalize">{turn.difficulty}</Badge>
                <Badge variant="secondary" className="rounded-full">
                  Focus · {turn.focus}
                </Badge>
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                {turn.concept}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-foreground/85">
                {turn.explanation}
              </p>
              <div className="mt-4 flex gap-3 rounded-2xl bg-accent/40 p-4">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent-foreground" />
                <p className="text-sm text-accent-foreground">{turn.analogy}</p>
              </div>
            </div>

            <div className="surface rounded-3xl p-6 rise sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Check your understanding
              </p>
              <p className="mt-2 text-lg font-medium">{turn.question.prompt}</p>

              <div className="mt-5 grid gap-2.5">
                {turn.question.options.map((opt, i) => {
                  const isAnswer = i === turn.question.answerIndex;
                  const chosen = selected === i;
                  const revealed = selected !== null;
                  const state = revealed
                    ? isAnswer
                      ? "border-success/60 bg-success/10"
                      : chosen
                        ? "border-destructive/50 bg-destructive/8"
                        : "opacity-60"
                    : "hover:border-primary/50 hover:bg-secondary/60";
                  return (
                    <button
                      key={opt}
                      onClick={() => answer(i)}
                      disabled={revealed}
                      className={`flex items-center justify-between gap-3 rounded-2xl border bg-background/60 px-4 py-3.5 text-left text-[15px] transition-all ${state}`}
                    >
                      <span>{opt}</span>
                      {revealed && isAnswer && <CheckCircle2 className="size-4 text-success" />}
                      {revealed && chosen && !isAnswer && (
                        <XCircle className="size-4 text-destructive" />
                      )}
                    </button>
                  );
                })}
              </div>

              {selected === null ? (
                <div className="mt-5">
                  {showHint ? (
                    <p className="rounded-2xl bg-secondary/70 p-4 text-sm">{turn.question.hint}</p>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setShowHint(true)}>
                      <Lightbulb className="mr-2 size-4" /> Need a hint?
                    </Button>
                  )}
                </div>
              ) : (
                <div className="mt-5 rise">
                  <p className="rounded-2xl bg-secondary/70 p-4 text-sm leading-relaxed">
                    {turn.question.why}
                  </p>
                  <Button
                    className="mt-4 h-11 w-full rounded-2xl"
                    onClick={nextStep}
                    disabled={busy}
                  >
                    {busy ? "Adapting your next step…" : "Continue"}
                  </Button>
                </div>
              )}
            </div>

            <div className="surface rounded-3xl p-5 sm:p-6">
              <p className="text-sm font-medium">Ask Lumen anything</p>
              <div className="mt-3 flex gap-2">
                <Input
                  value={ask}
                  onChange={(e) => setAsk(e.target.value)}
                  placeholder="I still don't get why…"
                  className="h-11 rounded-2xl bg-background/70"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && ask.trim()) {
                      go({ mode: "ask", userText: ask });
                      setAsk("");
                    }
                  }}
                />
                {micButton}
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  aria-label="Scan with camera"
                  onClick={() => setCameraOpen(true)}
                >
                  <Camera className="size-4" />
                </Button>
                <Button
                  size="icon"
                  className="rounded-full"
                  aria-label="Send question"
                  disabled={!ask.trim() || busy}
                  onClick={() => {
                    go({ mode: "ask", userText: ask });
                    setAsk("");
                  }}
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="surface rounded-3xl p-6">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium">Knowledge state</p>
                <span className="font-display text-2xl font-semibold text-primary">
                  {overall}%
                </span>
              </div>
              <p className="mb-5 text-xs text-muted-foreground">{topic || "Your session"}</p>
              <KnowledgeMap skills={skills} />
            </div>

            <div className="surface grid grid-cols-3 gap-2 rounded-3xl p-5 text-center">
              {[
                { label: "Answered", value: answered },
                { label: "Correct", value: correctCount },
                { label: "Streak", value: streak },
              ].map((s) => (
                <div key={s.label}>
                  <p className="font-display text-2xl font-semibold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="surface rounded-3xl p-6">
              <p className="text-sm font-medium">Tutor says</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{turn.say}</p>
              {turn.nextSteps.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {turn.nextSteps.map((n) => (
                    <li key={n} className="flex gap-2 text-sm text-muted-foreground">
                      <Compass className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      {n}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </section>
      )}

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(dataUrl) =>
          go({
            mode: "scan",
            image: dataUrl,
            userText: "Teach me from this image I captured.",
            topicOverride: topic || "the material in this image",
          })
        }
      />
    </main>
  );
}
