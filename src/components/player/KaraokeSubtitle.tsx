"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  activeWordIndex,
  alignSentences,
  buildTrack,
  type AlignedSentence,
  type KaraokeTrack,
  type NarrationChannel,
} from "@/lib/karaoke";

/**
 * The narration for one slide, shown one sentence at a time.
 *
 * A slide's narration is a paragraph, and a caption that shows a paragraph is not
 * a caption: the reader gets the whole thing at once and has to work out which
 * clause the voice is on. So the text is split into sentences and the line on
 * screen is whichever sentence the voice is currently inside — read to the end,
 * then the next one. Two sentences are on screen only for the moment of the
 * handover, so a hand-off does not read as a flicker.
 *
 * Three visual states, because a line that only lights the current word is hard
 * to read: the eye needs the words already spoken to follow the sentence, and the
 * words not yet reached to know what is coming.
 *
 * The playhead is read from a ref inside this component's own rAF loop, never
 * from props. A slide holds a WebGL simulation and an interactive quiz; a state
 * update sixty times a second would re-render all of it and undo the work the
 * GSAP timeline does to keep playback off React.
 */
export function KaraokeSubtitle({
  text,
  sceneIndex,
  channel,
}: {
  text: string;
  sceneIndex: number;
  /** The shared voice channel: position now, timings per scene. */
  channel: NarrationChannel;
}) {
  // Sparse by design: punctuation and whitespace are rendered as bare text, so
  // some indices in this list never get a node.
  const wordsRef = useRef<(HTMLSpanElement | null)[]>([]);
  /** Timings for the current sentence, re-derived when the voice's marks arrive. */
  const trackRef = useRef<KaraokeTrack | null>(null);
  const lastLitRef = useRef(-2);
  const frameRef = useRef<number | null>(null);
  /** Index of the sentence on screen, so a change can re-align exactly once. */
  const spokenIndexRef = useRef(0);
  /** How many word marks the current alignment was built from. */
  const builtForRef = useRef<string | null>(null);

  /**
   * How many marks this scene's timings hold, as a string so a ref compare
   * decides whether anything changed.
   *
   * The timings arrive with the audio, a second or more after this component
   * first mounts, and they land on the channel rather than through React. So they
   * are polled for, bounded: a deck of fourteen slides would otherwise leave
   * fourteen 250ms timers running for the rest of the session whenever the voice
   * is off, which is pure CPU for a caption that will never light up.
   */
  const [marksVersion, setMarksVersion] = useState(0);

  useEffect(() => {
    const size = () => String(channel.words.get(sceneIndex)?.length ?? 0);
    let builtFor = size();
    if (builtFor !== builtForRef.current) {
      builtForRef.current = builtFor;
      setMarksVersion((value) => value + 1);
    }

    let waits = 0;
    const poll = window.setInterval(() => {
      const current = size();
      if (current === builtFor) {
        if ((waits += 1) > 80) window.clearInterval(poll);
        return;
      }
      builtFor = current;
      builtForRef.current = current;
      window.clearInterval(poll);
      setMarksVersion((value) => value + 1);
    }, 250);

    return () => window.clearInterval(poll);
  }, [channel, sceneIndex]);

  /**
   * The caption's sentences, each carrying the words and timings it owns.
   *
   * Computed once per (narration, timings) rather than per frame. A caption that
   * re-aligned every sentence sixty times a second would spend more CPU deciding
   * which sentence to show than the rest of the player uses, and the result is
   * the same every time.
   *
   * With no timings yet this still returns the sentences and their words — the
   * highlight is simply unlit. The spans have to exist before any timing
   * arrives, and deciding what is a span by `start !== null` would mean
   * rendering nothing until then.
   */
  const sentences = useMemo<AlignedSentence[]>(
    () => alignSentences(text, channel.words.get(sceneIndex) ?? []),
    // `channel.words` is mutated in place and never triggers a render, so
    // `marksVersion` is what stands in for the arrival of the timings.
    [text, sceneIndex, channel, marksVersion],
  );

  /**
   * The sentence the voice is on: the last one whose first word has begun.
   *
   * A caption that advanced on a timer would drift from the voice, and drift is
   * the one thing that makes a karaoke caption feel broken, so this is driven by
   * the same word timings the highlight uses. A sentence the voice never measured
   * is skipped, which leaves the caption on the last timed sentence rather than
   * guessing ahead.
   */
  const sentenceAt = (time: number): number => {
    if (sentences.length <= 1) return 0;
    let chosen = -1;
    for (let i = 0; i < sentences.length; i += 1) {
      const start = sentences[i].start;
      if (start === null) continue;
      if (start <= time) chosen = i;
      else break;
    }
    return chosen === -1 ? 0 : chosen;
  };

  /**
   * Which sentences are on screen, and a counter to re-render them.
   *
   * A state bump rather than a live ref because the words are React nodes: they
   * have to be re-rendered for the caption to change sentence. The counter is
   * what `shown` is memoised on, because the index itself lives in a ref that
   * React cannot see change to.
   */
  const [shownVersion, setShownVersion] = useState(0);
  const shown = useMemo(() => {
    const index = spokenIndexRef.current;
    return [sentences[index] ?? null, sentences[index + 1] ?? null] as const;
  }, [sentences, shownVersion]);


  useEffect(() => {
    const paint = () => {
      const live = channel.live;
      const nodes = wordsRef.current;
      const time = live && live.sceneIndex === sceneIndex ? live.time : null;

      if (time === null) {
        // Parked or muted: leave the sentence the voice stopped on, unlit, so a
        // paused slide stays readable. A sweep across words the voice never
        // measured would drift, and drift is worse than no highlight.
        if (lastLitRef.current !== -1) {
          for (const node of nodes) if (node) node.dataset.state = "idle";
          lastLitRef.current = -1;
        }
        frameRef.current = requestAnimationFrame(paint);
        return;
      }

      // Where the caption is. This is the only thing that re-renders, and it
      // changes a handful of times across a slide rather than once per frame.
      const sentence = sentenceAt(time);
      if (sentence !== spokenIndexRef.current) {
        spokenIndexRef.current = sentence;
        setShownVersion((value) => value + 1);
        // The words on screen are now different words, so the highlight restarts
        // from nothing instead of continuing the previous sentence's index.
        lastLitRef.current = -2;
        for (const node of nodes) if (node) node.dataset.state = "idle";
      }

      const track = trackRef.current;
      if (track) {
        const active = activeWordIndex(track, time);
        if (active !== lastLitRef.current) {
          // Normally this advances by one, so only the word being left and the
          // word being entered can have changed: two attribute writes per word
          // boundary instead of one per word in the sentence. The whole-range
          // re-stamp is kept for the case that actually needs it — a seek, where
          // the jump can be from the middle of the sentence to the start.
          const jumped = Math.abs(active - lastLitRef.current) > 1;
          if (jumped) {
            for (let i = 0; i < nodes.length; i += 1) {
              const node = nodes[i];
              if (!node) continue;
              node.dataset.state = i < active ? "said" : i === active ? "now" : "idle";
            }
          } else {
            // The word being left keeps whichever state its new position
            // implies: stepping back one word turns the old "now" back into
            // "idle", stepping forward turns it into "said". Getting this
            // backwards leaves a permanently accent-coloured word behind.
            const previous = lastLitRef.current;
            const leaving = previous >= 0 ? nodes[previous] : null;
            if (leaving) {
              leaving.dataset.state = previous < active ? "said" : "idle";
            }
            const entering = active >= 0 ? nodes[active] : null;
            if (entering) entering.dataset.state = "now";
          }
          lastLitRef.current = active;
        }
      }
      frameRef.current = requestAnimationFrame(paint);
    };

    frameRef.current = requestAnimationFrame(paint);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // `sentences` is load-bearing and must be named here. The loop above closes
    // over `sentenceAt`, which reads the sentence starts; without this the loop
    // kept the list from the render that first mounted the caption — the one
    // taken before any timings had arrived, where every start is null — so
    // `sentenceAt` could only ever answer 0. The highlight still moved, because
    // it is built from a different effect, which is exactly why the caption
    // appeared stuck on its first sentence while the words lit up correctly.
  }, [channel, sceneIndex, sentences]);

  // The word track for whichever sentence is on screen, built from the tokens
  // that same sentence already owns. The spans rendered below are these exact
  // token objects, so a token index the track hands back always names the node
  // holding that word — previously the two lists were built by separate calls
  // and a mismatch would light the wrong words.
  useEffect(() => {
    const tokens = shown[0]?.tokens ?? [];
    trackRef.current = tokens.some((token) => token.start !== null)
      ? buildTrack(tokens)
      : null;
    lastLitRef.current = -2;
  }, [shown]);

  const current = shown[0];
  const next = shown[1];

  return (
    <div className="scene-caption-stack flex max-w-[84%] flex-col items-center gap-[0.6cqw] text-center">
      <p className="scene-narration pointer-events-auto overflow-hidden text-center">
        {/* No newlines between the spans. JSX collapses the indentation between
            expressions into real space text nodes, and since each token already
            carries its own trailing space, every word was separated by two. */}
        {(current?.tokens ?? []).map((token, index) => token.text.trim().length === 0 ? token.text : (
          <span
            key={index}
            ref={(node) => {
              // Indexed by token position, not by push order: the track hands
              // back token indexes and whitespace tokens have no node to point at.
              wordsRef.current[index] = node;
            }}
            data-state="idle"
            className="px-[1px]"
          >
            {token.text}
          </span>
        ))}
      </p>
      {/* The sentence coming next, held back and faint. It tells the reader where
          the voice is going, and it is the same size as the live line so the
          hand-over does not jump.

          Rendered even on the last sentence, where it is empty and hidden. The
          row is part of the reserved height described in `.scene-caption-stack`,
          so removing it would shrink the block and slide the live line upward on
          exactly the frame the reader is looking at. */}
      <p
        className="scene-narration-next pointer-events-none overflow-hidden text-center"
        style={{ visibility: next ? "visible" : "hidden" }}
      >
        {next?.text ?? ""}
      </p>
    </div>
  );
}

