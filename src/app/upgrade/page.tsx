import { Suspense } from "react";
import UpgradeClient from "../../upgrade/UpgradeClient";

export default function UpgradePage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Lade…</div>}>
      <UpgradeClient />
    </Suspense>
  );
}
