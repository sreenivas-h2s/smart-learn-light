import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SkillState = z.object({
  name: z.string(),
  mastery: z.number(),
});

const TurnInput = z.object({
  topic: z.string().min(1),
  goal: z.string().default(""),
  pace: z.number().default(3),
  skills: z.array(SkillState).default([]),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .default([]),
  userText: z.string().default(""),
  image: z.string().nullable().default(null),
  mode: z.enum(["start", "answer", "ask", "scan"]).default("ask"),
});

export type TutorTurnInput = z.input<typeof TurnInput>;

const TurnOutput = z.object({
  say: z.string(),
  concept: z.string(),
  explanation: z.string(),
  analogy: z.string(),
  difficulty: z.enum(["intro", "core", "stretch"]),
  question: z.object({
    prompt: z.string(),
    options: z.array(z.string()),
    answerIndex: z.number(),
    hint: z.string(),
    why: z.string(),
  }),
  skillUpdates: z.array(z.object({ name: z.string(), mastery: z.number() })),
  focus: z.string(),
  nextSteps: z.array(z.string()),
});

export type TutorTurn = z.infer<typeof TurnOutput>;

export const tutorTurn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TurnInput.parse(input))
  .handler(async ({ data }): Promise<TutorTurn> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { generateText, Output, NoObjectGeneratedError } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");

    const gateway = createLovableAiGatewayProvider(key);

    const system = [
      "You are Lumen, an adaptive learning tutor.",
      "You model the learner's knowledge state and adapt every turn.",
      "Rules:",
      "- Keep `say` warm, encouraging, under 45 words, spoken aloud to the learner.",
      "- `explanation` is 2-4 short sentences teaching the current concept, plain language.",
      "- `analogy` is one vivid everyday comparison.",
      "- Always produce exactly one multiple-choice question with 4 options and the 0-based answerIndex.",
      "- Calibrate difficulty to the learner's mastery: below 40 => intro, 40-75 => core, above 75 => stretch.",
      "- skillUpdates: return the full list of 3-6 named sub-skills for the topic with mastery 0-100, adjusting from the given state based on the learner's latest answer.",
      "- If an image is provided, read the problem or notes in it and teach from that exact content.",
      "- Never repeat the same question twice in a session.",
    ].join("\n");

    const state = data.skills.length
      ? data.skills.map((s) => `${s.name}: ${s.mastery}`).join(", ")
      : "unknown (first turn — propose the sub-skill map)";

    const contextText = [
      `Topic: ${data.topic}`,
      `Learner goal: ${data.goal || "general fluency"}`,
      `Preferred pace (1 gentle - 5 intense): ${data.pace}`,
      `Current knowledge state: ${state}`,
      `Turn type: ${data.mode}`,
      data.userText ? `Learner said/did: ${data.userText}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const messages: Array<Record<string, unknown>> = [
      ...data.history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
      {
        role: "user",
        content: data.image
          ? [
              { type: "text", text: contextText },
              { type: "image", image: data.image },
            ]
          : contextText,
      },
    ];

    try {
      const result = await generateText({
        model: gateway("google/gemini-3.7-flash"),
        system,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: messages as any,
        output: Output.object({ schema: TurnOutput }),
      });
      return result.output as TutorTurn;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("The tutor had trouble forming a lesson. Try again.");
      }
      throw error;
    }
  });
