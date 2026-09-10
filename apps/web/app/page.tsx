const stages = [
  "ENSv2 identifies",
  "AgentPay selects",
  "Blocky402 verifies",
  "Hedera settles"
];

export default function Home() {
  return (
    <main>
      <p className="eyebrow">ETHOnline 2026 · Day 1 foundation</p>
      <h1>AgentPay</h1>
      <p className="lede">Discover an invoice-extraction service by ENS identity and pay within a hard HBAR budget.</p>
      <ol aria-label="AgentPay workflow">
        {stages.map((stage) => <li key={stage}>{stage}</li>)}
      </ol>
      <p className="status">The interactive paid journey is added after the live ENS and payment proof gates pass.</p>
    </main>
  );
}

