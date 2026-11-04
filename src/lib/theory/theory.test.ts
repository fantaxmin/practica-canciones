import { describe, expect, it } from "vitest";
import { ROOTS, noteName, pitchClass, type SpelledNote } from "./notes";
import { MODE_ORDER, SCALES, buildScale, scaleSemitones, stepPattern, getScale } from "./scales";
import { circleOfFifths, diatonicChords, keySignature, parentMajor, relativeMajor, relativeMinor, seventhName, triadName } from "./relatives";
import { BASS_EADG, GUITAR_EADGBE, scaleMidi, scalePositions } from "./fretboard";
import { generateQuiz, questionOfKind, seededRng, type QuestionKind } from "./quiz";

const n = (letter: number, accidental = 0): SpelledNote => ({ letter, accidental });
const C = n(0), D = n(1), F = n(3), G = n(4), A = n(5), E = n(2);
const names = (notes: SpelledNote[], notation: "latin" | "english" = "english") => notes.map((x) => noteName(x, notation)).join(" ");

describe("ortografía de escalas", () => {
  it("Do mayor no tiene alteraciones", () => {
    expect(names(buildScale(C, "jonico"), "latin")).toBe("Do Re Mi Fa Sol La Si");
  });
  it("Fa mayor lleva Si♭ (no La♯)", () => {
    expect(names(buildScale(F, "jonico"))).toBe("F G A B♭ C D E");
  });
  it("Fa♯ mayor usa Mi♯", () => {
    expect(names(buildScale(n(3, 1), "jonico"))).toBe("F♯ G♯ A♯ B C♯ D♯ E♯");
  });
  it("cada escala heptatónica usa las 7 letras una vez", () => {
    for (const root of ROOTS) for (const scale of SCALES.filter((s) => s.formula.length === 7)) {
      expect(new Set(buildScale(root, scale.id).map((x) => x.letter)).size).toBe(7);
    }
  });
  it("pentatónicas y blues", () => {
    expect(names(buildScale(A, "pentaMenor"))).toBe("A C D E G");
    expect(names(buildScale(C, "pentaMayor"))).toBe("C D E G A");
    expect(names(buildScale(A, "blues"))).toBe("A C D E♭ E G");
  });
  it("menores armónica y melódica", () => {
    expect(names(buildScale(A, "menorArmonica"))).toBe("A B C D E F G♯");
    expect(names(buildScale(A, "menorMelodica"))).toBe("A B C D E F♯ G♯");
  });
  it("patrón de tonos de la mayor", () => {
    expect(stepPattern(getScale("jonico"))).toBe("T T S T T T S");
  });
});

describe("modos griegos", () => {
  it("los 7 modos son rotaciones de la escala mayor", () => {
    const major = scaleSemitones(getScale("jonico"));
    MODE_ORDER.forEach((id, i) => {
      const rotated = [...major.slice(i), ...major.slice(0, i).map((s) => s + 12)].map((s) => s - major[i]);
      expect(scaleSemitones(getScale(id))).toEqual(rotated);
    });
  });
  it("modos sobre las notas de Do mayor comparten notas", () => {
    const cMajor = new Set(buildScale(C, "jonico").map(pitchClass));
    const doMajorNotes = buildScale(C, "jonico");
    MODE_ORDER.forEach((id, i) => {
      const notes = buildScale(doMajorNotes[i], id);
      expect(notes.every((x) => cMajor.has(pitchClass(x)))).toBe(true);
      expect(notes.every((x) => x.accidental === 0)).toBe(true);
    });
  });
  it("escala madre", () => {
    expect(noteName(parentMajor(D, "dorico")!)).toBe("Do");
    expect(noteName(parentMajor(G, "mixolidio")!)).toBe("Do");
    expect(noteName(parentMajor(A, "eolico")!, "english")).toBe("C");
    expect(noteName(parentMajor(E, "frigio")!, "english")).toBe("C");
    expect(noteName(parentMajor(n(4), "dorico")!, "english")).toBe("F");
    expect(parentMajor(A, "pentaMenor")).toBeNull();
  });
});

describe("relativas y tonalidades", () => {
  it("relativas", () => {
    expect(noteName(relativeMinor(C), "english")).toBe("A");
    expect(noteName(relativeMinor(G), "english")).toBe("E");
    expect(noteName(relativeMinor(F), "english")).toBe("D");
    expect(noteName(relativeMinor(n(1, -1)), "english")).toBe("B♭");
    expect(noteName(relativeMajor(A), "english")).toBe("C");
    expect(noteName(relativeMajor(E), "english")).toBe("G");
    expect(noteName(relativeMajor(n(3, 1)), "english")).toBe("A");
  });
  it("acordes diatónicos de Do mayor", () => {
    const chords = diatonicChords(C, "jonico");
    expect(chords.map((c) => c.roman)).toEqual(["I", "ii", "iii", "IV", "V", "vi", "vii°"]);
    expect(chords.map((c) => seventhName(c, "english"))).toEqual(["Cmaj7", "Dm7", "Em7", "Fmaj7", "G7", "Am7", "Bm7♭5"]);
    expect(chords.map((c) => c.mode)).toEqual(MODE_ORDER);
  });
  it("acordes diatónicos de La menor", () => {
    const chords = diatonicChords(A, "eolico");
    expect(chords.map((c) => triadName(c, "english"))).toEqual(["Am", "B°", "C", "Dm", "Em", "F", "G"]);
    expect(chords[0].mode).toBe("eolico");
  });
  it("armaduras y círculo de quintas", () => {
    expect(keySignature(C)).toBe(0);
    expect(keySignature(G)).toBe(1);
    expect(keySignature(F)).toBe(-1);
    const circle = circleOfFifths();
    expect(circle.map((e) => noteName(e.major, "english")).join(" ")).toBe("C G D A E B F♯ D♭ A♭ E♭ B♭ F");
    expect(circle.map((e) => e.signature)).toEqual([0, 1, 2, 3, 4, 5, 6, -5, -4, -3, -2, -1]);
  });
});

describe("diapasón", () => {
  it("La en el traste 5 de la cuerda Mi grave y raíz en traste 0 de La", () => {
    const pos = scalePositions(GUITAR_EADGBE, A, "pentaMenor");
    expect(pos.find((p) => p.string === 0 && p.fret === 5)?.isRoot).toBe(true);
    expect(pos.find((p) => p.string === 1 && p.fret === 0)?.isRoot).toBe(true);
    expect(pos.every((p) => ["1", "b3", "4", "5", "b7"].includes(p.degree))).toBe(true);
  });
  it("bajo tiene 4 cuerdas y Do mayor sin alteraciones solo cae en trastes naturales", () => {
    const pos = scalePositions(BASS_EADG, C, "jonico");
    expect(new Set(pos.map((p) => p.string)).size).toBe(4);
    expect(pos.some((p) => p.string === 0 && p.fret === 1)).toBe(true); // Fa
    expect(pos.some((p) => p.string === 0 && p.fret === 2)).toBe(false); // Fa♯
  });
  it("escala sonora ascendente termina en la octava", () => {
    const midi = scaleMidi("guitarra", C, "jonico");
    expect(midi[0]).toBe(48);
    expect(midi.at(-1)).toBe(60);
    expect(midi).toEqual([...midi].sort((a, b) => a - b));
  });
});

describe("quiz", () => {
  const kinds: QuestionKind[] = ["relativaMenor", "relativaMayor", "notasEscala", "formula", "acordeModo", "grado", "escalaMadre"];
  it("siempre hay 4 opciones distintas y una sola correcta", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = seededRng(seed);
      for (const kind of kinds) {
        const q = questionOfKind(kind, rng, seed % 2 ? "latin" : "english");
        expect(q.options.length).toBe(4);
        expect(new Set(q.options).size).toBe(4);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.options[q.answer]).toBeTruthy();
        expect(q.explanation.length).toBeGreaterThan(10);
      }
    }
  });
  it("es determinista con semilla", () => {
    expect(generateQuiz(5, seededRng(42))).toEqual(generateQuiz(5, seededRng(42)));
  });
  it("no repite tipo en un quiz de 5", () => {
    const quiz = generateQuiz(5, seededRng(7));
    expect(quiz.length).toBe(5);
  });
});

describe("rutina", async () => {
  const { buildRoutine, ROUTINE_KEYS } = await import("./routine");
  it("4 pasos coherentes con la tonalidad", () => {
    for (const key of ROUTINE_KEYS) {
      const steps = buildRoutine(key, seededRng(3));
      expect(steps.map((s) => s.scaleId).slice(0, 2)).toEqual(["jonico", "eolico"]);
      expect(pitchClass(steps[1].root)).toBe(pitchClass(relativeMinor(key)));
      const keyPcs = new Set(buildScale(key, "jonico").map(pitchClass));
      expect(buildScale(steps[2].root, steps[2].scaleId).every((x) => keyPcs.has(pitchClass(x)))).toBe(true);
      expect(steps[3].scaleId).toBe("pentaMenor");
    }
  });
});
