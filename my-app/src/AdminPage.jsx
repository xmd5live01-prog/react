import { useEffect, useMemo, useState } from "react";
import { DEFAULT_CMS_CONTENT, normalizeCmsContent } from "./cmsContent";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import "./AdminPage.css";

const PANELS = [
  ["overview", "Dashboard"],
  ["heroSlides", "Hero slideshow"],
  ["announcements", "Announcements"],
  ["services", "Services"],
  ["paymentMethods", "Payment methods"],
  ["steps", "How it works"],
  ["site", "Site settings"],
  ["revisions", "Revisions"],
];

const COLLECTIONS = {
  heroSlides: {
    title: "Hero slideshow",
    fields: [
      ["title", "Slide title"],
      ["text", "Description"],
      ["cta", "Button label"],
      ["key", "Illustration", "select", [["payment", "Payment"], ["inquiry", "Inquiry"], ["application", "Application"], ["more", "Services"]]],
    ],
    blank: () => ({ id: crypto.randomUUID(), key: "payment", title: "", text: "", cta: "Learn more", active: true }),
  },
  announcements: {
    title: "Announcements",
    fields: [["title", "Announcement title"], ["text", "Details"]],
    blank: () => ({ id: crypto.randomUUID(), title: "", text: "", active: true }),
  },
  services: {
    title: "Services",
    fields: [["title", "Service name"], ["text", "Description"]],
    blank: () => ({ id: crypto.randomUUID(), title: "", text: "", active: true }),
  },
  paymentMethods: {
    title: "Payment methods",
    fields: [
      ["name", "Provider name"],
      ["category", "Category", "select", [["wallet", "E-wallet"], ["bank", "Traditional bank"]]],
    ],
    blank: () => ({ id: crypto.randomUUID(), name: "", category: "wallet", active: true }),
  },
  steps: {
    title: "How it works",
    fields: [["title", "Step title"], ["text", "Description"]],
    blank: () => ({ id: crypto.randomUUID(), title: "", text: "", active: true }),
  },
};

const clone = (value) => JSON.parse(JSON.stringify(value));

function Icon({ name }) {
  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    heroSlides: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m4 16 5-5 4 4 3-3 4 4" /></>,
    announcements: <><path d="M4 11v2a2 2 0 0 0 2 2h2l7 4V5l-7 4H6a2 2 0 0 0-2 2Z" /><path d="m15 9 5-2v10l-5-2M8 15l1.5 5" /></>,
    services: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h10M7 13h7M7 17h4" /></>,
    paymentMethods: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
    steps: <><circle cx="5" cy="6" r="2" /><circle cx="5" cy="12" r="2" /><circle cx="5" cy="18" r="2" /><path d="M11 6h9M11 12h9M11 18h9" /></>,
    site: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.7Z" /></>,
    revisions: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
  };
  return (
    <svg aria-hidden="true" className="cms-icon" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}

function LoginScreen({ onLogin, onResetPassword, busy, error, notice }) {
  const [email, setEmail] = useState("xmd5live01@gmail.com");
  const [password, setPassword] = useState("");

  return (
    <main className="cms-login-shell">
      <form className="cms-login-card" onSubmit={(event) => { event.preventDefault(); onLogin(email, password); }}>
        <div className="cms-login-mark">H<span>W</span></div>
        <p className="cms-eyebrow">HINUNANGAN WATER SYSTEM</p>
        <h1>Sign in to your CMS</h1>
        <p className="cms-login-description">Manage the public website, announcements, services, and payment information.</p>
        {error && <p className="cms-alert cms-alert-error" role="alert">{error}</p>}
        <label htmlFor="cms-email">Administrator email</label>
        <input autoComplete="username" id="cms-email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
        <label htmlFor="cms-password">Password</label>
        <input autoComplete="current-password" id="cms-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
        <button className="cms-primary-button cms-login-button" disabled={busy} type="submit">
          {busy ? "Signing in..." : "Sign in"}
        </button>
        <button className="cms-reset-link" disabled={busy} onClick={() => onResetPassword(email)} type="button">
          Forgot password?
        </button>
        {notice && <p className="cms-alert cms-alert-success" role="status">{notice}</p>}
        <p className="cms-login-footnote">Access is invite-only. Ask a Supabase project administrator to invite your approved email.</p>
      </form>
    </main>
  );
}

function PasswordRecoveryScreen({ busy, error, onUpdatePassword }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function submit(event) {
    event.preventDefault();
    if (password !== confirmPassword) {
      onUpdatePassword(null, "The passwords do not match.");
      return;
    }
    onUpdatePassword(password);
  }

  return (
    <main className="cms-login-shell">
      <form className="cms-login-card" onSubmit={submit}>
        <div className="cms-login-mark">H<span>W</span></div>
        <p className="cms-eyebrow">HINUNANGAN WATER SYSTEM</p>
        <h1>Set your CMS password</h1>
        <p className="cms-login-description">Choose a new password for your administrator account.</p>
        {error && <p className="cms-alert cms-alert-error" role="alert">{error}</p>}
        <label htmlFor="cms-new-password">New password</label>
        <input autoComplete="new-password" id="cms-new-password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
        <label htmlFor="cms-confirm-password">Confirm new password</label>
        <input autoComplete="new-password" id="cms-confirm-password" minLength={8} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} />
        <button className="cms-primary-button cms-login-button" disabled={busy} type="submit">
          {busy ? "Updating password..." : "Set password"}
        </button>
      </form>
    </main>
  );
}

function CollectionEditor({ section, items, onUpdate, onAdd, onMove }) {
  const config = COLLECTIONS[section];
  const [filter, setFilter] = useState("");
  const visibleItems = items.filter((item) =>
    config.fields.some(([field]) => String(item[field] ?? "").toLowerCase().includes(filter.toLowerCase())),
  );

  return (
    <div className="cms-panel-content">
      <div className="cms-section-toolbar">
        <div>
          <h2>{config.title}</h2>
          <p>Edit entries, change their order, or deactivate them without deleting your content.</p>
        </div>
        <button className="cms-primary-button" onClick={onAdd} type="button">＋ Add new</button>
      </div>
      <div className="cms-search-wrap">
        <input aria-label={`Search ${config.title}`} onChange={(event) => setFilter(event.target.value)} placeholder={`Search ${config.title.toLowerCase()}...`} value={filter} />
        <span>{items.filter((item) => item.active).length} active · {items.length} total</span>
      </div>
      {visibleItems.length === 0 && <div className="cms-empty-state">No entries match this search.</div>}
      <div className="cms-entry-list">
        {visibleItems.map((item) => {
          const index = items.findIndex((entry) => entry.id === item.id);
          return (
            <article className={`cms-entry-card${item.active ? "" : " is-inactive"}`} key={item.id}>
              <div className="cms-entry-main">
                {config.fields.map(([field, label, type, options]) => (
                  <label className={`cms-field cms-field-${field}`} key={field}>
                    <span>{label}</span>
                    {type === "select" ? (
                      <select onChange={(event) => onUpdate(item.id, field, event.target.value)} value={item[field]}>
                        {options.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                      </select>
                    ) : field === "text" ? (
                      <textarea onChange={(event) => onUpdate(item.id, field, event.target.value)} rows={2} value={item[field] ?? ""} />
                    ) : (
                      <input onChange={(event) => onUpdate(item.id, field, event.target.value)} value={item[field] ?? ""} />
                    )}
                  </label>
                ))}
              </div>
              <div className="cms-entry-actions">
                <span className={`cms-status-pill ${item.active ? "is-active" : "is-draft"}`}>{item.active ? "Active" : "Inactive"}</span>
                <button aria-label={`Move ${item.title ?? item.name} up`} disabled={index === 0} onClick={() => onMove(index, -1)} type="button">↑</button>
                <button aria-label={`Move ${item.title ?? item.name} down`} disabled={index === items.length - 1} onClick={() => onMove(index, 1)} type="button">↓</button>
                <button className="cms-toggle-button" onClick={() => onUpdate(item.id, "active", !item.active)} type="button">
                  {item.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminPage({ onPreview, onPublicSite }) {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(() => new URLSearchParams(window.location.search).has("cms-recovery"));
  const [loadingContent, setLoadingContent] = useState(false);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [contentRetry, setContentRetry] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [panel, setPanel] = useState("overview");
  const [draft, setDraft] = useState(() => clone(DEFAULT_CMS_CONTENT));
  const [revisions, setRevisions] = useState([]);
  const [published, setPublished] = useState(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [dirty, setDirty] = useState(false);
  const userId = session?.user?.id;

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setAuthChecked(true);
    }).catch((sessionError) => {
      if (mounted) {
        setError(sessionError instanceof Error ? sessionError.message : "Unable to check your sign-in session.");
        setAuthChecked(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setError("");
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return undefined;

    let mounted = true;
    async function loadCms() {
      setLoadingContent(true);
      setContentLoaded(false);
      const { data: adminResult, error: adminError } = await supabase.rpc("cms_is_admin");
      if (adminError) throw adminError;
      if (!mounted) return;
      if (!adminResult) {
        setIsAdmin(false);
        setLoadingContent(false);
        return;
      }
      setIsAdmin(true);

      const [{ data: draftRow, error: draftError }, { data: publicRow, error: publicError }, { data: revisionRows, error: revisionError }] = await Promise.all([
        supabase.from("cms_content_drafts").select("content,updated_at").eq("singleton_id", true).maybeSingle(),
        supabase.from("cms_public_content").select("version,published_at").eq("singleton_id", true).maybeSingle(),
        supabase.from("cms_content_revisions").select("id,version,published_at").order("version", { ascending: false }).limit(20),
      ]);
      if (draftError) throw draftError;
      if (publicError) throw publicError;
      if (revisionError) throw revisionError;
      if (!mounted) return;
      setDraft(normalizeCmsContent(draftRow?.content ?? clone(DEFAULT_CMS_CONTENT)));
      setHasDraft(Boolean(draftRow));
      setPublished(publicRow);
      setRevisions(revisionRows ?? []);
      setDirty(false);
      setContentLoaded(true);
      setLoadingContent(false);
    }

    loadCms().catch((loadError) => {
      if (!mounted) return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load CMS content.");
      setLoadingContent(false);
    });

    return () => { mounted = false; };
  }, [userId, contentRetry]);

  const counts = useMemo(() => ({
    hero: draft.heroSlides.filter((item) => item.active).length,
    announcements: draft.announcements.filter((item) => item.active).length,
    services: draft.services.filter((item) => item.active).length,
    payments: draft.paymentMethods.filter((item) => item.active).length,
  }), [draft]);

  async function login(email, password) {
    setBusy(true);
    setError("");
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) setError(loginError.message);
    setBusy(false);
  }

  async function requestPasswordReset(email) {
    if (!email.trim()) {
      setError("Enter your administrator email first.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const redirectTo = `${window.location.origin}${window.location.pathname}?cms-recovery=1`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (resetError) setError(resetError.message);
    else setNotice("If that email is registered, a password reset link has been sent. Check your inbox.");
    setBusy(false);
  }

  async function updatePassword(password, validationError) {
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
    } else {
      setPasswordRecovery(false);
      setNotice("Password updated. You are signed in to the CMS.");
      window.history.replaceState(null, "", `${window.location.pathname}#/admin`);
    }
    setBusy(false);
  }

  function updateSite(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setNotice("");
  }

  function updateItem(section, id, field, value) {
    setDraft((current) => ({
      ...current,
      [section]: current[section].map((item) => item.id === id ? { ...item, [field]: value } : item),
    }));
    setDirty(true);
    setNotice("");
  }

  function addItem(section) {
    setDraft((current) => ({ ...current, [section]: [...current[section], COLLECTIONS[section].blank()] }));
    setDirty(true);
  }

  function moveItem(section, index, direction) {
    setDraft((current) => {
      const items = [...current[section]];
      const target = index + direction;
      [items[index], items[target]] = [items[target], items[index]];
      return { ...current, [section]: items };
    });
    setDirty(true);
  }

  async function saveDraft() {
    setBusy(true);
    setError("");
    setNotice("");
    const { error: saveError } = await supabase.from("cms_content_drafts").upsert({
      singleton_id: true,
      content: draft,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    });
    if (saveError) {
      setError(saveError.message);
    } else {
      setHasDraft(true);
      setDirty(false);
      setNotice("Draft saved. It is not visible on the public site until you publish it.");
    }
    setBusy(false);
  }

  async function publishDraft() {
    if (!draft.heroSlides.some((item) => item.active && item.title.trim() && item.text.trim())) {
      setError("Activate at least one hero slide and fill in its title and description before publishing.");
      return;
    }
    if (Object.values(COLLECTIONS).some((config, index) => {
      const key = Object.keys(COLLECTIONS)[index];
      return draft[key].some((item) => item.active && config.fields.some(([field]) => !String(item[field] ?? "").trim()));
    })) {
      setError("Fill in all required fields for active content before publishing.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    const { error: saveError } = await supabase.from("cms_content_drafts").upsert({
      singleton_id: true,
      content: draft,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    });
    if (saveError) {
      setError(saveError.message);
      setBusy(false);
      return;
    }

    const { data: version, error: publishError } = await supabase.rpc("cms_publish_draft");
    if (publishError) {
      setError(publishError.message);
    } else {
      setHasDraft(true);
      setDirty(false);
      setPublished({ version, published_at: new Date().toISOString() });
      setNotice(`Published successfully as version ${version}.`);
      const { data: revisionRows, error: revisionError } = await supabase
        .from("cms_content_revisions")
        .select("id,version,published_at")
        .order("version", { ascending: false })
        .limit(20);
      if (revisionError) setError(revisionError.message);
      else setRevisions(revisionRows ?? []);
    }
    setBusy(false);
  }

  async function restoreRevision(revisionId) {
    if (!window.confirm("Restore this published version into the draft? The public site will not change until you publish it.")) return;
    setBusy(true);
    setError("");
    const { error: restoreError } = await supabase.rpc("cms_restore_revision", { p_revision_id: revisionId });
    if (restoreError) {
      setError(restoreError.message);
    } else {
      const { data, error: draftError } = await supabase.from("cms_content_drafts").select("content").eq("singleton_id", true).single();
      if (draftError) setError(draftError.message);
      else {
        setDraft(normalizeCmsContent(data.content));
        setHasDraft(true);
        setDirty(false);
        setNotice("Revision restored to draft. Review it, then publish to make it live.");
      }
    }
    setBusy(false);
  }

  async function logout() {
    setBusy(true);
    const { error: logoutError } = await supabase.auth.signOut();
    if (logoutError) setError(logoutError.message);
    setBusy(false);
  }

  if (!isSupabaseConfigured) {
    return <main className="cms-login-shell"><div className="cms-login-card"><p className="cms-eyebrow">CMS SETUP REQUIRED</p><h1>Connect Supabase</h1><p className="cms-login-description">Set the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY build variables, then rebuild the site.</p><button className="cms-secondary-button" onClick={onPublicSite} type="button">Return to website</button></div></main>;
  }

  if (!authChecked) {
    return <main className="cms-login-shell"><p className="cms-login-description">Checking administrator session...</p></main>;
  }

  if (passwordRecovery) {
    if (!session) return <main className="cms-login-shell"><p className="cms-login-description">Validating password reset link...</p></main>;
    return <PasswordRecoveryScreen busy={busy} error={error} onUpdatePassword={updatePassword} />;
  }

  if (!session) return <LoginScreen busy={busy} error={error} notice={notice} onLogin={login} onResetPassword={requestPasswordReset} />;

  if (!isAdmin && !loadingContent) {
    return (
      <main className="cms-login-shell">
        <div className="cms-login-card">
          <p className="cms-eyebrow">ACCESS RESTRICTED</p>
          <h1>Administrator access required</h1>
          <p className="cms-login-description">This account is not on the approved CMS administrator list.</p>
          {error && <p className="cms-alert cms-alert-error" role="alert">{error}</p>}
          <div className="cms-login-actions">
            <button className="cms-secondary-button" onClick={onPublicSite} type="button">Return to website</button>
            <button className="cms-primary-button" disabled={busy} onClick={logout} type="button">Sign out</button>
          </div>
        </div>
      </main>
    );
  }

  const selectedPanel = PANELS.find(([id]) => id === panel)?.[1] ?? "Dashboard";

  return (
    <div className="cms-admin">
      <aside className="cms-sidebar">
        <button className="cms-brand" onClick={onPublicSite} type="button">
          <span className="cms-brand-mark">H<span>W</span></span>
          <span>Water CMS<small>Hinunangan Water System</small></span>
        </button>
        <div className="cms-side-label">WORKSPACE</div>
        <nav aria-label="CMS sections" className="cms-nav">
          {PANELS.map(([id, label]) => (
            <button aria-current={panel === id ? "page" : undefined} className={panel === id ? "is-selected" : ""} key={id} onClick={() => { setPanel(id); setError(""); setNotice(""); }} type="button">
              <Icon name={id} /><span>{label}</span>
              {id === "revisions" && revisions.length > 0 && <small>{revisions.length}</small>}
            </button>
          ))}
        </nav>
        <div className="cms-sidebar-bottom">
          <div className="cms-user-badge"><span>{session.user.email?.slice(0, 1).toUpperCase()}</span><div><strong>Administrator</strong><small>{session.user.email}</small></div></div>
          <button className="cms-logout-button" disabled={busy} onClick={logout} type="button"><Icon name="logout" />Sign out</button>
        </div>
      </aside>

      <main className="cms-main">
        <header className="cms-topbar">
          <div><span className="cms-breadcrumb">Content management</span><h1>{selectedPanel}</h1></div>
          <div className="cms-topbar-actions">
            <span className="cms-live-status"><i />{published ? `Live · v${published.version}` : "No published version"}</span>
            <button className="cms-secondary-button" onClick={onPublicSite} type="button">View website ↗</button>
          </div>
        </header>

        <div className="cms-workspace">
          {error && <div className="cms-alert cms-alert-error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError("")} type="button">×</button></div>}
          {notice && <div className="cms-alert cms-alert-success" role="status">{notice}<button aria-label="Dismiss message" onClick={() => setNotice("")} type="button">×</button></div>}
          {loadingContent ? <div className="cms-loading">Loading your CMS workspace...</div> : !contentLoaded ? (
            <section className="cms-info-card">
              <h2>CMS content is unavailable</h2>
              <p>Content was not loaded, so editing and publishing are disabled to avoid overwriting your saved work.</p>
              <button className="cms-secondary-button" onClick={() => { setError(""); setContentRetry((attempt) => attempt + 1); }} type="button">Retry loading</button>
            </section>
          ) : (
            <>
              {panel === "overview" && (
                <section className="cms-panel-content">
                  <div className="cms-welcome">
                    <div><p className="cms-eyebrow">SITE OVERVIEW</p><h2>Welcome to your website workspace</h2><p>Manage public content, prepare changes, preview them, and publish when ready.</p></div>
                    <span className="cms-welcome-mark">CMS</span>
                  </div>
                  <div className="cms-stat-grid">
                    {[
                      ["Hero slides", counts.hero, draft.heroSlides.length, "heroSlides"],
                      ["Announcements", counts.announcements, draft.announcements.length, "announcements"],
                      ["Services", counts.services, draft.services.length, "services"],
                      ["Payment options", counts.payments, draft.paymentMethods.length, "paymentMethods"],
                    ].map(([label, active, total, section]) => (
                      <button className="cms-stat-card" key={section} onClick={() => setPanel(section)} type="button">
                        <span>{label}</span><strong>{active}</strong><small>active of {total}</small>
                      </button>
                    ))}
                  </div>
                  <div className="cms-overview-grid">
                    <section className="cms-info-card">
                      <div className="cms-card-heading"><div><h3>Publishing</h3><p>{dirty ? "You have unsaved changes." : hasDraft ? "Your latest draft is saved." : "Start from the current website content."}</p></div><span className={`cms-status-pill ${dirty ? "is-draft" : "is-active"}`}>{dirty ? "Unsaved" : hasDraft ? "Draft saved" : "Ready"}</span></div>
                      <div className="cms-publish-detail"><span>Last published</span><strong>{published ? new Date(published.published_at).toLocaleString() : "Not published yet"}</strong></div>
                      <div className="cms-publish-detail"><span>Latest version</span><strong>{published ? `Version ${published.version}` : "—"}</strong></div>
                      <div className="cms-action-row"><button className="cms-secondary-button" disabled={busy} onClick={() => onPreview(draft)} type="button">Preview draft</button><button className="cms-primary-button" disabled={busy || !dirty} onClick={saveDraft} type="button">{busy ? "Saving..." : "Save draft"}</button><button className="cms-publish-button" disabled={busy} onClick={publishDraft} type="button">{busy ? "Publishing..." : "Publish changes"}</button></div>
                    </section>
                    <section className="cms-info-card">
                      <div className="cms-card-heading"><div><h3>Quick start</h3><p>Common content tasks</p></div></div>
                      {PANELS.slice(1, 7).map(([id, label]) => (
                        <button className="cms-quick-link" key={id} onClick={() => setPanel(id)} type="button"><Icon name={id} />{label}<span>›</span></button>
                      ))}
                    </section>
                  </div>
                </section>
              )}

              {COLLECTIONS[panel] && (
                <CollectionEditor
                  items={draft[panel]}
                  onAdd={() => addItem(panel)}
                  onMove={(index, direction) => moveItem(panel, index, direction)}
                  onUpdate={(id, field, value) => updateItem(panel, id, field, value)}
                  section={panel}
                />
              )}

              {panel === "site" && (
                <section className="cms-panel-content">
                  <div className="cms-section-toolbar"><div><h2>Site settings</h2><p>Update shared labels and information displayed across the public site.</p></div></div>
                  <div className="cms-settings-card">
                    {[
                      ["siteTitle", "Site title"],
                      ["heroKicker", "Hero eyebrow text"],
                      ["announcementsTitle", "Announcements heading"],
                      ["servicesHeading", "Services heading"],
                      ["servicesSubheading", "Services introduction"],
                      ["paymentHeading", "Payment section heading"],
                      ["paymentDescription", "Payment introduction"],
                      ["stepsHeading", "How-it-works heading"],
                      ["footerTagline", "Footer tagline"],
                    ].map(([field, label]) => (
                      <label className="cms-field" key={field}>
                        <span>{label}</span>
                        {field.endsWith("Description") || field.endsWith("Subheading") ? (
                          <textarea onChange={(event) => updateSite(field, event.target.value)} rows={2} value={draft[field]} />
                        ) : (
                          <input onChange={(event) => updateSite(field, event.target.value)} value={draft[field]} />
                        )}
                      </label>
                    ))}
                  </div>
                  <div className="cms-info-card cms-settings-help"><h3>Change content safely</h3><p>Edits are drafts until published. Deactivated entries stay in the editor and can be activated later. Revisions keep a copy of every published version.</p></div>
                </section>
              )}

              {panel === "revisions" && (
                <section className="cms-panel-content">
                  <div className="cms-section-toolbar"><div><h2>Published revisions</h2><p>Restore a previous publication to the draft editor, review it, and publish it again when ready.</p></div></div>
                  {revisions.length ? (
                    <div className="cms-revision-list">{revisions.map((revision) => (
                      <article className="cms-revision-card" key={revision.id}>
                        <div className="cms-revision-icon"><Icon name="revisions" /></div>
                        <div className="cms-revision-info"><strong>Published version {revision.version}</strong><span>{new Date(revision.published_at).toLocaleString()}</span></div>
                        {revision.version === published?.version ? <span className="cms-status-pill is-active">Current live</span> : <button className="cms-secondary-button" disabled={busy} onClick={() => restoreRevision(revision.id)} type="button">Restore to draft</button>}
                      </article>
                    ))}</div>
                  ) : <div className="cms-empty-state">No published revisions yet. Your first publish will appear here.</div>}
                </section>
              )}

              {panel !== "overview" && (
                <div className="cms-sticky-publish">
                  <div><strong>{dirty ? "Unsaved changes" : "Draft status"}</strong><span>{published ? `Live version ${published.version}` : "No live version yet"}</span></div>
                  <div className="cms-action-row">
                    <button className="cms-secondary-button" disabled={busy} onClick={() => onPreview(draft)} type="button">Preview</button>
                    <button className="cms-secondary-button" disabled={busy || !dirty} onClick={saveDraft} type="button">{busy ? "Saving..." : "Save draft"}</button>
                    <button className="cms-publish-button" disabled={busy} onClick={publishDraft} type="button">{busy ? "Publishing..." : "Publish"}</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
