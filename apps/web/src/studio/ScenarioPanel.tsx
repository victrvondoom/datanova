import React from "react";
import { Scenario } from "./scenarios";
import { Callout } from "../trail/ui";

const List: React.FC<{ title: string; items: string[] }> = ({ title, items }) =>
  items.length === 0 ? null : (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h4>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-300">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  );

/** Full scenario brief: every section the spec requires. `reveal` limits what is shown (challenge mode). */
export const ScenarioPanel: React.FC<{ scenario: Scenario; reveal?: { functional: boolean; nonFunctional: boolean } }> = ({ scenario, reveal = { functional: true, nonFunctional: true } }) => (
  <div className="space-y-3" data-testid="scenario-panel">
    <div>
      <h3 className="text-lg font-bold text-slate-100">{scenario.name}</h3>
      <p className="text-sm text-slate-300">{scenario.description}</p>
    </div>
    {scenario.notice && <Callout kind="warning" title="Simulation notice">{scenario.notice}</Callout>}
    <div className="grid gap-4 md:grid-cols-2">
      {reveal.functional ? <List title="Functional requirements" items={scenario.requirements.filter((r) => r.type === "functional").map((r) => r.text)} /> : <p className="text-sm text-slate-500">Functional requirements are revealed in step 2.</p>}
      {reveal.nonFunctional ? <List title="Non-functional requirements" items={scenario.requirements.filter((r) => r.type === "non-functional").map((r) => r.text)} /> : <p className="text-sm text-slate-500">Non-functional requirements are revealed in step 3.</p>}
      <List title="Constraints" items={scenario.constraints} />
      <List title="Traffic assumptions" items={scenario.traffic} />
      <List title="Data consistency" items={scenario.consistency} />
      <List title="Reliability" items={scenario.reliability} />
      <List title="Security considerations" items={scenario.security} />
      <List title="Budget / operational constraints" items={scenario.budget} />
    </div>
  </div>
);
