/**
 * DataNova Campaign 08 — Evidence & Review: 6.C Evidence Records
 *
 * Cryptographic evidence envelopes, telemetry observations, simulation outputs,
 * and user-authored records with SHA-256 seal verification.
 */

import React, { useMemo } from "react";
import { IngestionCenter } from "../../reality/ui/IngestionCenter";
import { OperationalHistoryStore } from "../../reality/history";
import { IngestionGovernance } from "../../reality/governance";

export const EvidenceSubView: React.FC = () => {
  const historyStore = useMemo(() => new OperationalHistoryStore("ws-default"), []);
  const governance = useMemo(() => new IngestionGovernance(), []);

  return (
    <div className="space-y-6">
      <IngestionCenter
        historyStore={historyStore}
        governance={governance}
        onImportComplete={() => {}}
      />
    </div>
  );
};
