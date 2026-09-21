'use client';

import useBillingCatalog, { formatMoney } from '@/lib/useBillingCatalog';
import { MAX_UPLOAD_MB } from '@/lib/constants';

// Checkmark used in the comparison table cells.
const CheckIcon = () => (
  <span className="pp-check">
    <svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4.79932 12.1501L10.5593 17.9101L19.1993 7.83008"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

const Dash = () => <span className="pp-dash">{'\u2013'}</span>;

/**
 * The plan comparison table. Its "from" prices and minute allowances come
 * from the live catalog, in the currency quoted to this visitor, so they can
 * only be filled in the browser; the server renders the static fallbacks.
 */
export default function PricingCompare() {
  // The comparison table quotes "from" prices, which must agree with the plan
  // cards rendered by <Pricing /> above, including the currency, since
  // mainland-China visitors are quoted in yuan. Both read the same cached
  // catalog, so this costs no extra request.
  const { catalog, currency } = useBillingCatalog();
  const planById = (id: string) => catalog?.plans?.find((p) => p.id === id);
  // "From" = the cheapest way to get the plan, i.e. the annual price per month.
  const monthlyEquivalent = (id: string, fallback: string) => {
    const plan = planById(id);
    const annual = plan?.price_annual ?? plan?.price_annual_usd;
    return annual ? formatMoney(annual / 12, currency) : fallback;
  };
  const liteFrom = monthlyEquivalent('lite_annual', '$7.5');
  const proFrom = monthlyEquivalent('pro_annual', '$15');

  // Monthly allowance straight from the live catalog. This row used to be
  // hardcoded and claimed the free tier included 10 minutes a month, which it
  // does not: free grants no credits and only the 10-second preview, so anyone
  // who signed up expecting those minutes found nothing they could do.
  const planMinutes = (id: string, fallback: number) => {
    const minutes = planById(id)?.minutes_per_month;
    return typeof minutes === 'number' ? minutes : fallback;
  };
  const freeMinutes = planMinutes('free', 0);
  const liteMinutes = planMinutes('lite_monthly', 120);
  const proMinutes = planMinutes('pro_monthly', 360);

  return (
    <section className="pp-compare">
      <div className="pp-compare-wrap">
        <h2 className="pp-compare-h">Compare Plans</h2>
        <p className="pp-compare-sub">
          Every plan includes PDF, MusicXML and MIDI previews. Downloads and priority unlock as you go.
        </p>
        <div className="pp-compare-scroll">
          <table className="pp-table">
            <caption>Feature comparison across the Free, Lite and Pro plans.</caption>
            <colgroup>
              <col className="col-feat" />
              <col className="col-plan" />
              <col className="col-plan" />
              <col className="col-plan" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="th-corner"></th>
                <th scope="col">
                  <div className="pp-plan-h">
                    <span className="pp-plan-tag">Hobbyist</span>
                    <span className="pp-plan-name">Free</span>
                    <span className="pp-plan-price">{formatMoney(0, currency)} / month</span>
                  </div>
                </th>
                <th scope="col" className="is-pop">
                  <div className="pp-plan-h">
                    <span className="pp-plan-tag">Most popular</span>
                    <span className="pp-plan-name">Lite</span>
                    <span className="pp-plan-price">from {liteFrom} / month</span>
                  </div>
                </th>
                <th scope="col">
                  <div className="pp-plan-h">
                    <span className="pp-plan-tag">Enterprise</span>
                    <span className="pp-plan-name">Pro</span>
                    <span className="pp-plan-price">from {proFrom} / user</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Minutes / month</th>
                <td>{freeMinutes > 0 ? freeMinutes : '10-second preview'}</td>
                <td className="is-pop">{liteMinutes}</td>
                <td>{proMinutes}</td>
              </tr>
              <tr>
                <th scope="row">Upload size per file</th>
                <td>{`${MAX_UPLOAD_MB} MB`}</td>
                <td className="is-pop">{`${MAX_UPLOAD_MB} MB`}</td>
                <td>{`${MAX_UPLOAD_MB} MB`}</td>
              </tr>
              <tr>
                <th scope="row">
                  Download formats
                  <span className="pp-cell-note">PDF {'·'} MusicXML {'·'} MIDI</span>
                </th>
                <td>Previews only</td>
                <td className="is-pop">
                  <CheckIcon />
                </td>
                <td>
                  <CheckIcon />
                </td>
              </tr>
              <tr>
                <th scope="row">Batch processing</th>
                <td>
                  <Dash />
                </td>
                <td className="is-pop">
                  <CheckIcon />
                </td>
                <td>
                  <CheckIcon />
                </td>
              </tr>
              <tr>
                <th scope="row">Queue priority</th>
                <td>Standard</td>
                <td className="is-pop">Priority</td>
                <td>Fast</td>
              </tr>
              <tr>
                <th scope="row">Support</th>
                <td>Community</td>
                <td className="is-pop">Priority chat</td>
                <td>Priority chat</td>
              </tr>
              <tr>
                <th scope="row">Early access to new features</th>
                <td>
                  <Dash />
                </td>
                <td className="is-pop">
                  <Dash />
                </td>
                <td>
                  <CheckIcon />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
