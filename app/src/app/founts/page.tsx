import { MarketChip } from "@/components/MarketChip";
import { FountList } from "@/components/FountList";

export default function FountsPage() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Founts</h1>
          <p className="muted">
            One per tokenized stock. Each has its own cap, range and risk limits. Deposits open while NYSE is open and
            Chainlink prices are fresh; withdrawals are open at any time.
          </p>
        </div>
        <MarketChip />
      </div>
      <FountList />
    </div>
  );
}
