import { FountTokenDetails } from "@/components/FountTokenDetails";
import { YourHoldings } from "@/components/YourHoldings";

export default function PortfolioPage() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Portfolio</h1>
          <p className="muted">$FOUNT token details and everything your connected wallet holds across StockFount.</p>
        </div>
      </div>
      <div className="grid-2">
        <YourHoldings />
        <FountTokenDetails />
      </div>
    </div>
  );
}
