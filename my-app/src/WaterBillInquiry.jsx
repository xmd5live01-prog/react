import { useEffect, useMemo, useState } from 'react';
import './WaterBillInquiry.css';

const EMPTY_BILLS = [];
const LOOKUP_STORAGE_KEY = 'water-bill-lookup-session';

function readLookupSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(LOOKUP_STORAGE_KEY) ?? 'null');
    const hasAccount = saved?.account?.customer && Array.isArray(saved.account.bills);

    return {
      account: hasAccount ? saved.account : null,
      tab: ['home', 'bills', 'pay', 'help'].includes(saved?.tab) ? saved.tab : 'home',
      filter: ['All', 'Unpaid', 'Overdue', 'Paid'].includes(saved?.filter) ? saved.filter : 'All',
    };
  } catch {
    return { account: null, tab: 'home', filter: 'All' };
  }
}

function normalizeBillRecord(bill, index) {
  const normalized = bill ?? {};
  const amount = Number(normalized.amount ?? normalized.total_amount ?? normalized.bill_amount ?? 0);
  const previousReading = Number(
    normalized.previous_reading ?? normalized.prev_reading ?? normalized.prev_r_value ?? normalized.previousReading ?? 0,
  );
  const currentReading = Number(
    normalized.current_reading ?? normalized.pres_r_value ?? normalized.currentReading ?? normalized.reading ?? 0,
  );
  const consumption = Number(
    normalized.consumption ?? normalized.water_consume ?? normalized.meter_consumption ?? 0,
  );
  const rawStatus = String(normalized.status ?? normalized.payment_status ?? '0')
    .trim()
    .toLowerCase();
  const dueDate = String(
    normalized.due_date ?? normalized.dueDate ?? new Date().toISOString().slice(0, 10),
  ).slice(0, 10);
  const isPastDue = dueDate < new Date().toISOString().slice(0, 10);
  const status = rawStatus === '1' || rawStatus === 'paid'
    ? 'Paid'
    : rawStatus === 'overdue' || isPastDue
    ? 'Overdue'
    : 'Unpaid';

  return {
    id: normalized.id ?? normalized.meter_reading_id ?? normalized.reading_id ?? normalized.bill_id ?? `B-${index + 1}`,
    period: normalized.period ?? normalized.billing_period ?? normalized.month ?? normalized.bill_period ?? normalized.pres_r_date ?? `Billing ${index + 1}`,
    previousReading,
    currentReading,
    consumption,
    amount,
    dueDate,
    status,
  };
}

function normalizeAccountPayload(payload, customerId, lastNameLetters) {
  if (!payload) return null;

  let candidate = payload;

  if (Array.isArray(candidate)) {
    const match = candidate.find((entry) => {
      const customer = entry?.customer ?? entry;
      const id = String(customer.customer_info_id ?? customer.customerId ?? customer.idcustomer ?? '').trim();
      const lastName = String(customer.last_name ?? customer.lastName ?? '').trim();
      const prefix = String(lastNameLetters ?? '').trim().slice(0, 2).toLowerCase();

      return id === String(customerId ?? '').trim() && lastName.slice(0, 2).toLowerCase() === prefix;
    });

    if (!match) return null;
    candidate = match;
  }

  const customer = candidate.customer ?? candidate.account ?? candidate;
  const bills = candidate.bills ?? candidate.bill_history ?? candidate.records ?? candidate.data ?? [];

  const normalizedCustomer = {
    customerId: String(
      customer.customer_info_id ?? customer.customerId ?? customer.idcustomer ?? customer.id ?? customerId ?? '',
    ),
    lastName: customer.last_name ?? customer.lastName ?? customer.lastname ?? '',
    name:
      customer.name ??
      ( [customer.first_name, customer.middle_name, customer.last_name].filter(Boolean).join(' ') ||
        [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
        '' ),
    address: customer.address ?? customer.service_address ?? customer.street_address ?? customer.location ?? '',
    meterNo: customer.meter_no ?? customer.meterNo ?? customer.meter_number ?? customer.meter ?? '',
    accountType: customer.account_type ?? customer.accountType ?? 'Residential',
  };

  return {
    customer: normalizedCustomer,
    bills: Array.isArray(bills) ? bills.map((bill, index) => normalizeBillRecord(bill, index)) : [],
  };
}

function findMockAccount(customerId, lastNameLetters) {
  return (
    accounts.find(
      ({ customer }) =>
        customer.customerId === customerId &&
        customer.lastName.replace(/\s+/g, '').slice(0, 2).toLowerCase() ===
          lastNameLetters.toLowerCase(),
    ) ?? null
  );
}

const accounts = [
  {
    customer: {
      customerId: '100234',
      lastName: 'Dela Cruz',
      name: 'Maria Dela Cruz',
      address: 'Purok 3, Brgy. Lahug, Cebu City',
      meterNo: 'WM-2045518',
      accountType: 'Residential',
    },
    bills: [
      { id: 'B-2609', period: 'Setyembre 2026', previousReading: 1245, currentReading: 1262, consumption: 17, amount: 412.5, dueDate: '2026-10-30', status: 'Unpaid' },
      { id: 'B-2608', period: 'Agosto 2026', previousReading: 1229, currentReading: 1245, consumption: 16, amount: 388, dueDate: '2026-09-30', status: 'Overdue' },
      { id: 'B-2607', period: 'Hulyo 2026', previousReading: 1212, currentReading: 1229, consumption: 17, amount: 412.5, dueDate: '2026-08-30', status: 'Paid' },
      { id: 'B-2606', period: 'Hunyo 2026', previousReading: 1195, currentReading: 1212, consumption: 17, amount: 412.5, dueDate: '2026-07-30', status: 'Paid' },
      { id: 'B-2605', period: 'Mayo 2026', previousReading: 1180, currentReading: 1195, consumption: 15, amount: 365, dueDate: '2026-06-30', status: 'Paid' },
    ],
  },
  {
    customer: {
      customerId: '100877',
      lastName: 'Abella',
      name: 'Jose Abella',
      address: 'Sitio Bato, Brgy. Talamban, Cebu City',
      meterNo: 'WM-2051290',
      accountType: 'Residential',
    },
    bills: [
      { id: 'B-2609', period: 'Setyembre 2026', previousReading: 880, currentReading: 891, consumption: 11, amount: 265, dueDate: '2026-10-30', status: 'Paid' },
      { id: 'B-2608', period: 'Agosto 2026', previousReading: 868, currentReading: 880, consumption: 12, amount: 289, dueDate: '2026-09-30', status: 'Paid' },
    ],
  },
];

async function fetchBills(customerId, lastNameLetters) {
  const billingApiUrl = import.meta.env.VITE_BILL_API_URL;

  if (!billingApiUrl || billingApiUrl.includes('your-project')) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    return (
      accounts.find(
        ({ customer }) =>
          customer.customerId === customerId &&
          customer.lastName.replace(/\s+/g, '').slice(0, 2).toLowerCase() ===
            lastNameLetters.toLowerCase(),
      ) ?? null
    );
  }

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const response = await fetch(
    `${billingApiUrl}?customerId=${encodeURIComponent(customerId)}&lastNameLetters=${encodeURIComponent(lastNameLetters)}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      cache: 'no-store',
    },
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    const responseText = await response.text();
    let message = responseText;
    try {
      const payload = JSON.parse(responseText);
      message = payload.error ?? responseText;
    } catch {
      // Keep the response text when the server does not return JSON.
    }
    throw new Error(message || `Request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  return normalizeAccountPayload(payload, customerId, lastNameLetters);
}

const peso = (amount) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

const dateLabel = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

function BillCard({ bill }) {
  return (
    <li className="water-bill-card">
      <div className="water-bill-heading">
        <div>
          <strong>{bill.period}</strong>
          <span>Bill {bill.id}</span>
        </div>
        <span className={`water-status water-status-${bill.status.toLowerCase()}`}>
          {bill.status}
        </span>
      </div>
      <p className="water-bill-amount">{peso(bill.amount)}</p>
      <dl className="water-bill-details">
        <div>
          <dt>Due date</dt>
          <dd>{dateLabel(bill.dueDate)}</dd>
        </div>
        <div>
          <dt>Consumption</dt>
          <dd>{bill.consumption} m³</dd>
        </div>
        <div className="water-reading">
          <dt>Reading</dt>
          <dd>{bill.previousReading} → {bill.currentReading}</dd>
        </div>
      </dl>
    </li>
  );
}

function InfoCard({ title, children }) {
  return (
    <section className="water-info-card">
      <span aria-hidden="true"><WaterIcon name="receipt" /></span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </section>
  );
}

function WaterIcon({ name, className = '' }) {
  const paths = {
    drop: <path d="M12 2.5c2.5 3.5 6.5 7.5 6.5 12a6.5 6.5 0 1 1-13 0c0-4.5 4-8.5 6.5-12Z" />,
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-7h6v7" /></>,
    receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
    pay: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.4 2.4 0 1 1 3.8 1.9c-1 .7-1.5 1.1-1.5 2.6M12 17h.01" /></>,
    tip: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    peso: <><path d="M8 21V4h5a4 4 0 0 1 0 8H8M5 8h10M5 11h10" /></>,
  };

  return (
    <svg
      className={`water-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export default function WaterBillInquiry() {
  const [savedSession] = useState(readLookupSession);
  const [customerId, setCustomerId] = useState('');
  const [lastNameLetters, setLastNameLetters] = useState('');
  const [account, setAccount] = useState(savedSession.account);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(savedSession.tab);
  const [filter, setFilter] = useState(savedSession.filter);

  useEffect(() => {
    try {
      if (account) {
        sessionStorage.setItem(
          LOOKUP_STORAGE_KEY,
          JSON.stringify({ account, tab, filter }),
        );
      } else {
        sessionStorage.removeItem(LOOKUP_STORAGE_KEY);
      }
    } catch {
      // Storage may be unavailable in private browsing or restricted contexts.
    }
  }, [account, tab, filter]);

  const bills = (account?.bills ?? EMPTY_BILLS).slice(0, 6);
  const totals = useMemo(() => {
    const openBills = bills.filter((bill) => bill.status !== 'Paid');
    return {
      outstanding: openBills.reduce((sum, bill) => sum + bill.amount, 0),
      openCount: openBills.length,
      overdueCount: bills.filter((bill) => bill.status === 'Overdue').length,
      averageConsumption: bills.length
        ? bills.reduce((sum, bill) => sum + bill.consumption, 0) / bills.length
        : 0,
      nextDue: [...openBills].sort(
        (a, b) => new Date(a.dueDate) - new Date(b.dueDate),
      )[0],
    };
  }, [bills]);
  const visibleBills =
    filter === 'All' ? bills : bills.filter((bill) => bill.status === filter);

  async function searchAccount(event) {
    event.preventDefault();
    setError('');
    const normalizedId = customerId.trim();
    const normalizedLetters = lastNameLetters.trim().toLowerCase();

    if (!normalizedId) {
      setError('Please enter your Customer ID.');
      return;
    }
    if (normalizedLetters.length !== 2) {
      setError('Please enter the first 2 letters of your last name.');
      return;
    }

    setLoading(true);
    setAccount(null);
    setFilter('All');
    try {
      const result = await fetchBills(normalizedId, normalizedLetters);
      if (!result) {
        setError('No account found. Check your Customer ID and last name.');
        return;
      }
      setAccount(result);
      setTab('home');
    } catch (requestError) {
      const detail = requestError instanceof Error ? requestError.message : '';
      setError(
        detail
          ? `Water bill lookup failed: ${detail}`
          : 'Unable to reach the server. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  function clearSearch() {
    try {
      sessionStorage.removeItem(LOOKUP_STORAGE_KEY);
    } catch {
      // Continue clearing the in-memory state if storage is unavailable.
    }
    setAccount(null);
    setCustomerId('');
    setLastNameLetters('');
    setError('');
    setFilter('All');
    setTab('home');
  }

  const tabTitles = {
    home: 'Water Bill',
    bills: 'Billing history',
    pay: 'Payment channels',
    help: 'Help & support',
  };

  return (
    <div className="water-app">
      <header className="water-header">
        <div className="water-brand">
          <strong>Hinunangan Water System</strong>
        </div>
        <nav className="water-top-nav" aria-label="Main navigation">
          {[
            ['home', 'home', 'Home'],
            ['bills', 'receipt', 'Bills'],
            ['pay', 'pay', 'Payments'],
            ['help', 'help', 'Help'],
          ].map(([id, icon, label]) => (
            <button
              className={tab === id ? 'active' : ''}
              key={id}
              type="button"
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
            >
              <WaterIcon name={icon} />{label}
            </button>
          ))}
        </nav>
        <div className="water-header-actions">
          <span className="water-avatar" aria-label="Hinunangan Water System account">
            <WaterIcon name="drop" />
          </span>
        </div>
      </header>

      <div className="water-layout">
        <aside className="water-sidebar water-sidebar-left">
          <div className="water-sidebar-profile">
            <span className="water-avatar">{account?.customer.name.slice(0, 1) ?? <WaterIcon name="drop" />}</span>
            <div>
              <strong>{account?.customer.name ?? 'Hinunangan Water System'}</strong>
              <span>{account ? `Customer ID ${account.customer.customerId}` : 'Bill inquiry portal'}</span>
            </div>
          </div>
          <nav className="water-side-nav" aria-label="Water bill sections">
            {[
              ['home', 'home', 'Home'],
              ['bills', 'receipt', 'Billing history'],
              ['pay', 'pay', 'Payment channels'],
              ['help', 'help', 'Help & support'],
            ].map(([id, icon, label]) => (
              <button
                className={tab === id ? 'active' : ''}
                key={id}
                type="button"
                onClick={() => setTab(id)}
              >
                <span aria-hidden="true"><WaterIcon name={icon} /></span>{label}
              </button>
            ))}
          </nav>
          <div className="water-sidebar-note">
            <span className="water-note-icon" aria-hidden="true"><WaterIcon name="tip" /></span>
            <div>
              <strong>Quick tip</strong>
              <p>Your Customer ID is printed at the top of your latest water bill.</p>
            </div>
          </div>
        </aside>

        <main className="water-main">
          <div className="water-page-heading">
            <div>
              <span>WATER DISTRICT PORTAL</span>
              <h1>{tabTitles[tab]}</h1>
            </div>
            {account && (
              <button
                className="water-page-new-search"
                type="button"
                onClick={clearSearch}
              >
                New search
              </button>
            )}
          </div>
          <div className="water-content">
          {tab === 'home' && (
            <section>
              {!account ? (
                <>
                  <div className="water-intro">
                    <h1>Check your water bill</h1>
                    <p>Check your water bill, view your billing history, and pay online via bank transfer.</p>
                  </div>
                  <div className="water-home-content">
                    <form className="water-search-card" onSubmit={searchAccount}>
                      <label htmlFor="customer-id">Customer ID</label>
                      <input
                        id="customer-id"
                        inputMode="numeric"
                        placeholder="e.g. 100234"
                        value={customerId}
                        disabled={loading}
                        onChange={(event) => {
                          setCustomerId(event.target.value.replace(/\D/g, ''));
                          setError('');
                        }}
                      />
                      <label htmlFor="last-name">First 2 letters of last name</label>
                      <input
                        id="last-name"
                        maxLength={2}
                        placeholder="e.g. DE"
                        value={lastNameLetters}
                        disabled={loading}
                        onChange={(event) => {
                          setLastNameLetters(event.target.value.replace(/[^a-z]/gi, ''));
                          setError('');
                        }}
                      />
                      {error && <p className="water-error" role="alert">{error}</p>}
                      <button className="water-primary-button" type="submit" disabled={loading}>
                        {loading ? 'Searching...' : 'View my bill'}
                      </button>
                      {loading && (
                        <p className="water-loading" role="status">Retrieving account details...</p>
                      )}
                    </form>
                    <InfoCard title="Where is my Customer ID?">
                      It is printed at the top of your latest water bill.
                    </InfoCard>
                  </div>
                </>
              ) : (
                <>
                  <section className="water-balance" aria-label="Account balance summary">
                    <div className="water-balance-identity">
                      <span className="water-balance-avatar" aria-hidden="true">
                        {account.customer.name.slice(0, 1)}
                      </span>
                      <div className="water-balance-customer">
                        <span className="water-balance-eyebrow">Customer account</span>
                        <strong className="water-balance-name">{account.customer.name}</strong>
                        <span className="water-balance-id">Customer ID <b>{account.customer.customerId}</b></span>
                      </div>
                    </div>
                    <div className="water-balance-financial">
                      <div className="water-balance-amount">
                        <span>Total amount due</span>
                        <strong>{peso(totals.outstanding)}</strong>
                      </div>
                      <div className="water-balance-next-due">
                        <span>{totals.nextDue ? 'Next due' : 'Payment status'}</span>
                        <strong>{totals.nextDue ? dateLabel(totals.nextDue.dueDate) : 'No balance due'}</strong>
                      </div>
                    </div>
                  </section>
                  <div className="water-home-content water-account-content">
                    <div className="water-stats">
                      <div><strong>{totals.openCount}</strong><span>Open</span></div>
                      <div><strong className={totals.overdueCount ? 'water-overdue-text' : ''}>{totals.overdueCount}</strong><span>Overdue</span></div>
                      <div><strong>{totals.averageConsumption.toFixed(1)}</strong><span>Avg m³</span></div>
                    </div>
                    <section className="water-panel">
                      <div className="water-panel-heading">
                        <h2>Water consumption</h2><span>m³ per month</span>
                      </div>
                      <div className="water-chart" role="img" aria-label="Water consumption per billing period">
                        {bills.slice(0, 6).reverse().map((bill) => (
                          <div className="water-chart-column" key={bill.id}>
                            <span>{bill.consumption}</span>
                            <div style={{ height: `${Math.max(16, bill.consumption * 5)}px` }} />
                            <small>{bill.period.split(' ')[0].slice(0, 3)}</small>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className="water-panel">
                      <h2>Account details</h2>
                      <dl className="water-account-details">
                        <div><dt>Service address</dt><dd>{account.customer.address}</dd></div>
                        <div><dt>Meter number</dt><dd>{account.customer.meterNo}</dd></div>
                        <div><dt>Account type</dt><dd>{account.customer.accountType}</dd></div>
                      </dl>
                    </section>
                    <div>
                      <div className="water-panel-heading">
                        <h2>Recent bills</h2>
                        <button type="button" onClick={() => setTab('bills')}>See all</button>
                      </div>
                      <ul className="water-bill-list">
                        {bills.slice(0, 2).map((bill) => <BillCard key={bill.id} bill={bill} />)}
                      </ul>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {tab === 'bills' && (
            <section className="water-tab-content">
              {!account ? (
                <div className="water-empty">
                  <strong>No account selected</strong>
                  <p>Search for your account on the Home tab first.</p>
                  <button className="water-primary-button" type="button" onClick={() => setTab('home')}>Go to Home</button>
                </div>
              ) : (
                <>
                  <div className="water-filters">
                    {['All', 'Unpaid', 'Overdue', 'Paid'].map((status) => (
                      <button
                        className={filter === status ? 'active' : ''}
                        key={status}
                        type="button"
                        onClick={() => setFilter(status)}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                  <ul className="water-bill-list">
                    {visibleBills.map((bill) => <BillCard key={bill.id} bill={bill} />)}
                  </ul>
                  {visibleBills.length === 0 && <p className="water-no-bills">No bills match this filter.</p>}
                </>
              )}
            </section>
          )}

          {tab === 'pay' && (
            <section className="water-tab-content">
              <InfoCard title="How to pay">Pay online by bank transfer, at our office, or through our accredited payment partners.</InfoCard>
              {account && (
                <div className="water-payment-summary">
                  Amount due: <strong>{peso(totals.outstanding)}</strong><br />
                  Customer ID: <strong>{account.customer.customerId}</strong>
                </div>
              )}
            </section>
          )}

          {tab === 'help' && (
            <section className="water-tab-content">
              <InfoCard title="Customer service">Call (000) 000-0000<br />Mon–Fri, 8:00 AM – 5:00 PM</InfoCard>
              <div className="water-help-card">
                <span>Coming soon</span>
                <h2>Our mobile app is on the way</h2>
                <p>Check your water bills, view your billing history, and stay on top of due dates right from your phone.</p>
                <div className="water-store-badges">
                  <div className="water-store-badge">
                    <svg className="water-store-icon water-google-play-icon" viewBox="0 0 48 48" aria-hidden="true">
                      <path fill="#34A853" d="M5.2 3.5C4.4 4.3 4 5.4 4 6.8v34.4c0 1.4.4 2.5 1.2 3.3L25 24 5.2 3.5Z" />
                      <path fill="#FBBC04" d="M5.2 3.5 29.5 17.4 22.8 24 5.2 3.5Z" />
                      <path fill="#EA4335" d="M5.2 44.5 22.8 24l6.7 6.6L5.2 44.5Z" />
                      <path fill="#4285F4" d="m22.8 24 6.7-6.6 9.9 5.7c2.1 1.2 2.1 2.6 0 3.8l-9.9 5.7-6.7-6.6Z" />
                    </svg>
                    <span>Coming soon on<strong>Google Play</strong></span>
                  </div>
                  <div className="water-store-badge">
                    <svg className="water-store-icon water-app-store-icon" viewBox="0 0 40 40" aria-hidden="true">
                      <path d="M20 7 7 32h5l8-15 8 15h5L20 7Z" />
                      <path d="M13 25h14" />
                    </svg>
                    <span>Coming soon on<strong>App Store</strong></span>
                  </div>
                </div>
              </div>
              <p className="water-copyright">© {new Date().getFullYear()} Hinunangan Water System</p>
            </section>
          )}
          </div>
        </main>

        <aside className="water-sidebar water-sidebar-right">
          <section className="water-side-card">
            <div className="water-side-card-heading">
              <span className="water-side-icon"><WaterIcon name="check" /></span>
              <h2>Need assistance?</h2>
            </div>
            <p>Our customer service team is here to help with your water account.</p>
            <a href="tel:0000000000">(000) 000-0000</a>
            <span>Mon–Fri, 8:00 AM – 5:00 PM</span>
          </section>
          <section className="water-side-card water-side-payment">
            <div className="water-side-card-heading">
              <span className="water-side-icon"><WaterIcon name="peso" /></span>
              <h2>Payment information</h2>
            </div>
            <p>Pay at our office or through our accredited payment partners.</p>
            {account && (
              <div className="water-side-balance">
                <span>Current balance</span>
                <strong>{peso(totals.outstanding)}</strong>
              </div>
            )}
          </section>
          <p className="water-side-footer">Privacy · Terms · About<br />© {new Date().getFullYear()} Hinunangan Water System</p>
        </aside>
      </div>

      <nav className="water-tabs" aria-label="Mobile navigation">
        {[
          ['home', 'home', 'Home'],
          ['bills', 'receipt', 'Bills'],
          ['pay', 'pay', 'Pay'],
          ['help', 'help', 'Help'],
        ].map(([id, icon, label]) => (
          <button
            className={tab === id ? 'active' : ''}
            key={id}
            type="button"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            <WaterIcon name={icon} />{label}
          </button>
        ))}
      </nav>
    </div>
  );
}
