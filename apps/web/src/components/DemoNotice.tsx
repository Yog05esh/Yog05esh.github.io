"use client";

import { useState } from "react";
import { isDemoBuild } from "@/lib/demo";

/** Keep every static-demo source link anchored to one public repository location. */
export const DEMO_SOURCE_BASE = "https://github.com/Yog05esh/Yog05esh.github.io/blob/main/";

type FeatureGuide = {
  title: string;
  codePath: string;
  input: string;
  steps: string[];
  sample: string;
};

export const DEMO_FEATURES: Record<string, FeatureGuide> = {
  console: {
    title: "STRATA console", codePath: "apps/web/src/lib/demo-api.ts", input: "Saved synthetic fixtures and the selected demo role.",
    steps: ["Load the role-specific fixture", "Apply the page filters in the browser", "Show the saved briefing and links"],
    sample: "A prioritised briefing with links back to the recorded evidence.",
  },
  detection: {
    title: "Sentinel detection", codePath: "services/engine/strata_engine/detect.py", input: "Orders, support, inventory and field-activity signals.",
    steps: ["Compare a signal with its baseline", "Combine independent witnesses", "Create a case only when the threshold is met"],
    sample: "A detected signal with severity, evidence IDs and an owner route.",
  },
  investigation: {
    title: "Investigator", codePath: "services/engine/strata_engine/agents.py", input: "A detected case, signal evidence and related records.",
    steps: ["Collect cited evidence", "Rank plausible causes", "Prepare a human-reviewable plan"],
    sample: "An evidence-backed cause hypothesis and proposed next action.",
  },
  signals: {
    title: "Signals", codePath: "services/engine/strata_engine/signals.py", input: "Synthetic source snapshots and signal definitions.",
    steps: ["Read source health", "Calculate the configured measures", "Pass usable signals to detection"],
    sample: "A baseline comparison with its data-provenance label.",
  },
  memory: {
    title: "Memory", codePath: "services/engine/strata_engine/agents.py", input: "Prior synthetic cases, SOPs and recorded outcomes.",
    steps: ["Search text and matching cause patterns", "Rank similar items", "Return cited context to the investigator"],
    sample: "A related prior case or draft SOP with its provenance.",
  },
  orchestrator: {
    title: "Orchestrator", codePath: "services/engine/strata_engine/agentic.py", input: "Agent recommendations, role rules and human decisions.",
    steps: ["Check the decision policy", "Wait for the human gate", "Record the approved simulated workflow"],
    sample: "A routed approval with a clear human ownership boundary.",
  },
  "simulation-lab": {
    title: "Simulation Lab", codePath: "services/engine/strata_engine/simulation.py", input: "A selected synthetic scenario and simulation clock.",
    steps: ["Inject the saved scenario", "Replay the engine sequence", "Show the illustrative recorded outcome"],
    sample: "A scenario trace marked illustrative, not a measured result.",
  },
  assistant: {
    title: "Assistant", codePath: "apps/web/src/lib/demo-api.ts", input: "A suggested question and pre-written cited fixture answer.",
    steps: ["Match the question to a deterministic answer", "Attach the recorded citation", "Show the response without a browser model call"],
    sample: "A cited answer that links to the saved briefing or case fixture.",
  },
  audit: {
    title: "Audit chain", codePath: "services/engine/strata_engine/state.py", input: "Recorded detections, agent steps and decisions.",
    steps: ["Append the event", "Preserve its actor and timestamp", "Expose it as a reviewable trail"],
    sample: "A chronological record of evidence, recommendation and decision.",
  },
  "evidence-or-silence": {
    title: "Evidence-or-Silence", codePath: "services/engine/strata_engine/agents.py", input: "Claims and the evidence collected for each claim.",
    steps: ["Check for a cited source", "Withhold unsupported claims", "Label the result with provenance"],
    sample: "A claim linked to evidence, or an explicit statement that evidence is missing.",
  },
  routines: {
    title: "Standing routines", codePath: "services/engine/strata_engine/agentic.py", input: "Approved routine rules and the simulation clock.",
    steps: ["Read the approved routine", "Evaluate its timing", "Record a simulated handoff or draft"],
    sample: "A scheduled task or draft that was not sent externally.",
  },
};

function guideFor(feature: string): FeatureGuide {
  return DEMO_FEATURES[feature] ?? DEMO_FEATURES.console;
}

/** Honest disclosure for every static screen containing recorded or scripted output. */
export function DemoNotice({ feature, codePath }: { feature: string; codePath: string }) {
  if (!isDemoBuild) return null;
  const guide = guideFor(feature);
  const sourcePath = codePath || guide.codePath;
  return (
    <aside className="demo-notice" aria-label="Static demo disclosure">
      <span className="demo-notice__badge">Demo mode: simulated output</span>
      <details>
        <summary>About this {guide.title} view</summary>
        <p>The live ML and agent pipeline cannot run on this free deployment because it needs compute and model or API resources that a free tier does not provide. What you see is a replay of real outputs the STRATA engine produced on synthetic data, not a live model run.</p>
        <p>The full working implementation is open source: <a href={`${DEMO_SOURCE_BASE}${sourcePath}`} target="_blank" rel="noopener noreferrer">view the code on GitHub</a>.</p>
      </details>
    </aside>
  );
}

/** A CSS-only step-through explanation that accompanies the demo disclosure. */
export function FeatureHowItWorks({ feature }: { feature: string }) {
  const guide = guideFor(feature);
  const [step, setStep] = useState(0);
  if (!isDemoBuild) return null;
  return (
    <section className="feature-guide" aria-labelledby={`how-${feature}`}>
      <div className="feature-guide__head">
        <div><p className="eyebrow">How it works</p><h2 id={`how-${feature}`}>{guide.title}</h2></div>
        <span className="feature-guide__count">{step + 1} / {guide.steps.length}</span>
      </div>
      <p><strong>Input:</strong> {guide.input}</p>
      <ol className="feature-guide__steps">
        {guide.steps.map((item, index) => <li key={item} className={index === step ? "is-active" : ""}><button type="button" onClick={() => setStep(index)}>{index + 1}. {item}</button></li>)}
      </ol>
      <p className="feature-guide__sample"><strong>Sample output:</strong> {guide.sample}</p>
    </section>
  );
}
