import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUILT_IN_SECTIONS,
  DEFAULT_CMS_CONTENT,
  DEFAULT_SECTION_ORDER,
  normalizeCmsContent,
} from "./cmsContent";
import { sanitizeRichText } from "./richText";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import "./AdminPage.css";

const PANELS = [
  ["overview", "Dashboard"],
  ["heroSlides", "Hero slideshow"],
  ["layout", "Layout editor"],
  ["announcements", "Announcements"],
  ["services", "Services"],
  ["paymentMethods", "Payment methods"],
  ["steps", "How it works"],
  ["site", "Site settings"],
  ["revisions", "Revisions"],
  ["users", "User management"],
];

const CMS_PERMISSIONS = [
  ["edit_sections", "Edit page sections", "Hero slides, announcements, services, payment methods, and steps"],
  ["edit_layout", "Edit page layout", "Templates, section order, visibility, and custom sections"],
  ["edit_site_settings", "Edit site settings", "Site text, branding images, and colors"],
  ["save_draft", "Save drafts", "Save permitted changes without publishing them"],
  ["publish_content", "Publish changes", "Make saved website content live"],
  ["restore_revisions", "Restore revisions", "View revision history and restore a published version"],
];

const PASSWORD_RECOVERY_REDIRECT = "https://xmd5live01-prog.github.io/wbs/?cms-recovery=1";
const GOOGLE_OAUTH_REDIRECT = "https://xmd5live01-prog.github.io/wbs/?cms-oauth=1";
const SITE_COLORS = [
  ["primaryColor", "Primary color"],
  ["accentColor", "Accent color"],
  ["pageBackgroundColor", "Page background"],
  ["surfaceColor", "Card and section surface"],
  ["textColor", "Main text"],
  ["mutedTextColor", "Muted text"],
];
const LANDING_TEMPLATES = [
  ["classic", "Current layout", "Services, payments, then steps. Keep the existing look and section order."],
  ["modern-minimal", "Modern Minimal", "A clean, utility-focused design with payments first and structured sections."],
  ["warm-community", "Warm Community", "A civic, public-service presentation with services first and a restrained warm palette."],
  ["elegant-water", "Elegant Water", "A premium water-service look with a centered hero and clear section hierarchy."],
];
const MAX_MEDIA_SIZE = 5 * 1024 * 1024;
const MEDIA_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function getGoogleOAuthError() {
  const query = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const error = query.get("error") ?? fragment.get("error");
  if (!error) return "";

  return "Google sign-in could not be completed. In Supabase Authentication → Sign In / Providers → Google, verify that the Client ID and Client Secret belong to the same Google Web OAuth client. In Google Cloud, confirm the authorized redirect URI is https://hyxotymypbmkyzghwspj.supabase.co/auth/v1/callback. Then try again.";
}

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

function WaterLogo() {
  return (
    <svg aria-hidden="true" className="cms-water-logo" viewBox="0 0 40 40">
      <path d="M20 3C12 14 6 21 6 27a14 14 0 0 0 28 0c0-6-6-13-14-24z" fill="currentColor" />
      <path d="M12 28c3-3 5-3 8 0s5 3 8 0" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="2.2" />
    </svg>
  );
}

function RichTextEditor({ value, disabled, onChange }) {
  const editorRef = useRef(null);
  const savedSelectionRef = useRef(null);
  const initialValueRef = useRef(value);

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = sanitizeRichText(initialValueRef.current);
  }, []);

  function rememberSelection() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return;
    savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
  }

  function restoreSelection() {
    editorRef.current?.focus();
    const selection = window.getSelection();
    const range = savedSelectionRef.current;
    if (!selection || !range || !editorRef.current?.contains(range.commonAncestorContainer)) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function runCommand(command, argument = null) {
    restoreSelection();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, argument);
    rememberSelection();
    onChange(sanitizeRichText(editorRef.current?.innerHTML ?? ""));
  }

  function insertLink() {
    const href = window.prompt("Enter a website URL or page anchor (for example, https://example.com or #services):");
    if (!href?.trim()) return;
    runCommand("createLink", href.trim());
  }

  const tools = [
    ["bold", "Bold", "B"],
    ["italic", "Italic", "I"],
    ["underline", "Underline", "U"],
    ["strikeThrough", "Strikethrough", "S"],
    ["formatBlock", "Heading 2", "H2", "<h2>"],
    ["formatBlock", "Heading 3", "H3", "<h3>"],
    ["formatBlock", "Heading 4", "H4", "<h4>"],
    ["formatBlock", "Quote", "❝", "<blockquote>"],
    ["formatBlock", "Paragraph", "¶", "<p>"],
    ["insertHorizontalRule", "Horizontal line", "―"],
    ["insertUnorderedList", "Bulleted list", "• List"],
    ["insertOrderedList", "Numbered list", "1. List"],
    ["justifyLeft", "Align left", "⇤"],
    ["justifyCenter", "Align center", "↔"],
    ["justifyRight", "Align right", "⇥"],
    ["indent", "Indent", "→"],
    ["outdent", "Outdent", "←"],
  ];

  return (
    <div className={`cms-rich-editor${disabled ? " is-disabled" : ""}`}>
      <div aria-label="Text formatting" className="cms-rich-toolbar" role="toolbar" onMouseDown={rememberSelection}>
        {tools.map(([command, label, symbol, argument]) => (
          <button
            aria-label={label}
            disabled={disabled}
            key={`${command}-${label}`}
            onClick={() => runCommand(command, argument ?? null)}
            onMouseDown={(event) => { rememberSelection(); event.preventDefault(); }}
            title={label}
            type="button"
          >
            {symbol}
          </button>
        ))}
        <button aria-label="Insert link" disabled={disabled} onClick={insertLink} onMouseDown={rememberSelection} title="Insert link" type="button">↗ Link</button>
        <button aria-label="Remove formatting" disabled={disabled} onClick={() => runCommand("removeFormat")} onMouseDown={(event) => { rememberSelection(); event.preventDefault(); }} title="Remove formatting" type="button">Tx</button>
        <label className="cms-rich-color" title="Text color">
          <span aria-hidden="true">A</span>
          <input aria-label="Text color" disabled={disabled} onChange={(event) => runCommand("foreColor", event.target.value)} onMouseDown={rememberSelection} type="color" />
        </label>
        <label className="cms-rich-color cms-rich-highlight" title="Highlight color">
          <span aria-hidden="true">▰</span>
          <input aria-label="Highlight color" disabled={disabled} onChange={(event) => runCommand("hiliteColor", event.target.value)} onMouseDown={rememberSelection} type="color" />
        </label>
        <select
          aria-label="Font size"
          disabled={disabled}
          defaultValue="3"
          onChange={(event) => { if (event.target.value) runCommand("fontSize", event.target.value); }}
          onMouseDown={rememberSelection}
          title="Font size"
        >
          <option value="3">Normal</option>
          <option value="2">Small</option>
          <option value="4">Large</option>
          <option value="5">Extra large</option>
          <option value="6">Title</option>
        </select>
        <button aria-label="Undo" disabled={disabled} onClick={() => runCommand("undo")} onMouseDown={(event) => { rememberSelection(); event.preventDefault(); }} title="Undo" type="button">↶</button>
        <button aria-label="Redo" disabled={disabled} onClick={() => runCommand("redo")} onMouseDown={(event) => { rememberSelection(); event.preventDefault(); }} title="Redo" type="button">↷</button>
      </div>
      <div
        aria-label="Custom section text"
        aria-multiline="true"
        className="cms-rich-content"
        contentEditable={!disabled}
        onInput={(event) => onChange(sanitizeRichText(event.currentTarget.innerHTML))}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        ref={editorRef}
        role="textbox"
        suppressContentEditableWarning
      />
      <p className="cms-rich-help">Format text with headings, lists, links, alignment, text size, color, and highlights.</p>
    </div>
  );
}

function Icon({ name }) {
  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    heroSlides: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m4 16 5-5 4 4 3-3 4 4" /></>,
    announcements: <><path d="M4 11v2a2 2 0 0 0 2 2h2l7 4V5l-7 4H6a2 2 0 0 0-2 2Z" /><path d="m15 9 5-2v10l-5-2M8 15l1.5 5" /></>,
    services: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h10M7 13h7M7 17h4" /></>,
    paymentMethods: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
    steps: <><circle cx="5" cy="6" r="2" /><circle cx="5" cy="12" r="2" /><circle cx="5" cy="18" r="2" /><path d="M11 6h9M11 12h9M11 18h9" /></>,
    layout: <><rect x="3" y="4" width="18" height="5" rx="1" /><rect x="3" y="11" width="18" height="4" rx="1" /><rect x="3" y="17" width="18" height="3" rx="1" /></>,
    site: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.7Z" /></>,
    revisions: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
  };
  return (
    <svg aria-hidden="true" className="cms-icon" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}

function LoginScreen({ onLogin, onGoogleLogin, onResetPassword, busy, error, notice }) {
  const [email, setEmail] = useState("xmd5live01@gmail.com");
  const [password, setPassword] = useState("");

  return (
    <main className="cms-login-shell">
      <form className="cms-login-card" onSubmit={(event) => { event.preventDefault(); onLogin(email, password); }}>
        <div className="cms-login-mark"><WaterLogo /></div>
        <p className="cms-eyebrow">HINUNANGAN WATER SYSTEM</p>
        <h1>Sign in to Admin Page</h1>
        <p className="cms-login-description">Manage the public website, announcements, services, and payment information.</p>
        {error && <p className="cms-alert cms-alert-error" role="alert">{error}</p>}
        <button className="cms-google-button" disabled={busy} onClick={onGoogleLogin} type="button">
          <span aria-hidden="true">G</span>
          Continue with Google
        </button>
        <p className="cms-login-divider"><span>or use your password</span></p>
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
        <p className="cms-login-footnote">Google sign-in only grants Admin Page access to email addresses approved by the site administrator.</p>
      </form>
    </main>
  );
}

function PasswordRecoveryScreen({ busy, error, onUpdatePassword, temporaryPassword = false }) {
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
        <div className="cms-login-mark"><WaterLogo /></div>
        <p className="cms-eyebrow">HINUNANGAN WATER SYSTEM</p>
        <h1>{temporaryPassword ? "Change your temporary password" : "Set your Admin Page password"}</h1>
        <p className="cms-login-description">
          {temporaryPassword
            ? "Before you can continue, replace the temporary password with a new password."
            : "Choose a new password for your administrator account."}
        </p>
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
  const [isCmsUser, setIsCmsUser] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessPermissions, setAccessPermissions] = useState([]);
  const [adminCheckedUserId, setAdminCheckedUserId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(() => new URLSearchParams(window.location.search).has("cms-recovery"));
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [contentRetry, setContentRetry] = useState(0);
  const [error, setError] = useState(getGoogleOAuthError);
  const [notice, setNotice] = useState("");
  const [panel, setPanel] = useState("overview");
  const [draft, setDraft] = useState(() => clone(DEFAULT_CMS_CONTENT));
  const [revisions, setRevisions] = useState([]);
  const [managedUsers, setManagedUsers] = useState([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("editor");
  const [newUserPermissions, setNewUserPermissions] = useState(["edit_sections", "save_draft"]);
  const [addingUser, setAddingUser] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState("");
  const [passwordResetUserId, setPasswordResetUserId] = useState("");
  const [passwordResetValue, setPasswordResetValue] = useState("");
  const [resettingUserId, setResettingUserId] = useState("");
  const [published, setPublished] = useState(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [dirty, setDirty] = useState(false);
  const userId = session?.user?.id;
  const authGenerationRef = useRef(0);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setPasswordChangeRequired(Boolean(data.session?.user?.app_metadata?.cms_password_change_required));
      setAuthChecked(true);
      if (new URLSearchParams(window.location.search).has("cms-oauth")) {
        window.history.replaceState(null, "", `${window.location.pathname}#/admin`);
      }
    }).catch((sessionError) => {
      if (mounted) {
        setError(sessionError instanceof Error ? sessionError.message : "Unable to check your sign-in session.");
        setAuthChecked(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setPasswordChangeRequired(Boolean(nextSession?.user?.app_metadata?.cms_password_change_required));
      if (nextSession || event === "SIGNED_OUT") setError("");
      if (event === "SIGNED_OUT") {
        authGenerationRef.current += 1;
        setNotice("");
        setPasswordChangeRequired(false);
        setIsCmsUser(false);
        setIsAdmin(false);
        setAccessPermissions([]);
        setAdminCheckedUserId(null);
        setManagedUsers([]);
        setPasswordResetUserId("");
        setPasswordResetValue("");
        setContentLoaded(false);
      }
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    if (passwordChangeRequired) return undefined;

    let mounted = true;
    const authGeneration = authGenerationRef.current;
    async function loadCms() {
      setLoadingContent(true);
      setContentLoaded(false);
      const { data: accessResult, error: accessError } = await supabase.rpc("cms_get_access");
      if (accessError) throw accessError;
      if (!mounted || authGenerationRef.current !== authGeneration) return;
      setAdminCheckedUserId(userId);
      if (!accessResult) {
        setIsCmsUser(false);
        setIsAdmin(false);
        setAccessPermissions([]);
        setLoadingContent(false);
        return;
      }
      const administrator = accessResult.role === "admin";
      const permissions = Array.isArray(accessResult.permissions) ? accessResult.permissions : [];
      setIsCmsUser(true);
      setIsAdmin(administrator);
      setAccessPermissions(permissions);

      const [{ data: draftRow, error: draftError }, { data: publicRow, error: publicError }, { data: revisionRows, error: revisionError }] = await Promise.all([
        supabase.from("cms_content_drafts").select("content,updated_at").eq("singleton_id", true).maybeSingle(),
        supabase.from("cms_public_content").select("version,published_at").eq("singleton_id", true).maybeSingle(),
        administrator || permissions.includes("restore_revisions")
          ? supabase.from("cms_content_revisions").select("id,version,published_at").order("version", { ascending: false }).limit(20)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (draftError) throw draftError;
      if (publicError) throw publicError;
      if (revisionError) throw revisionError;
      if (!mounted || authGenerationRef.current !== authGeneration) return;
      setDraft(normalizeCmsContent(draftRow?.content ?? clone(DEFAULT_CMS_CONTENT)));
      setHasDraft(Boolean(draftRow));
      setPublished(publicRow);
      setRevisions(revisionRows ?? []);
      setDirty(false);
      setPanel("overview");
      setContentLoaded(true);
      setLoadingContent(false);
    }

    loadCms().catch((loadError) => {
      if (!mounted || authGenerationRef.current !== authGeneration) return;
      setIsCmsUser(false);
      setIsAdmin(false);
      setAdminCheckedUserId(userId);
      setError(loadError instanceof Error ? loadError.message : "Unable to load CMS content.");
      setLoadingContent(false);
    });

    return () => { mounted = false; };
  }, [userId, contentRetry, passwordChangeRequired]);

  useEffect(() => {
    if (!isAdmin || !userId) return undefined;

    let mounted = true;
    const authGeneration = authGenerationRef.current;
    supabase.from("cms_users").select("user_id,email,role,permissions,active,created_at").order("created_at", { ascending: false })
      .then(({ data, error: usersError }) => {
        if (!mounted || authGenerationRef.current !== authGeneration) return;
        if (usersError) setError(usersError.message);
        else setManagedUsers(data ?? []);
      });
    return () => { mounted = false; };
  }, [isAdmin, userId]);

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

  async function loginWithGoogle() {
    setBusy(true);
    setError("");
    try {
      const { error: loginError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: GOOGLE_OAUTH_REDIRECT,
          queryParams: { prompt: "select_account" },
        },
      });
      if (loginError) {
        setError(loginError.message);
        setBusy(false);
      }
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to start Google sign-in.");
      setBusy(false);
    }
  }

  async function requestPasswordReset(email) {
    if (!email.trim()) {
      setError("Enter your administrator email first.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: PASSWORD_RECOVERY_REDIRECT,
    });
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
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      if (passwordChangeRequired) {
        const { error: completionError } = await supabase.functions.invoke("manage-cms-users", {
          body: { action: "complete_password_change" },
        });
        if (completionError) {
          const message = await getFunctionErrorMessage(completionError, "Unable to complete the required password change.");
          setError(`Your password was updated, but the required password change could not be completed: ${message}`);
          return;
        }
        const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshedData.session) {
          setError(`Your password was updated, but your sign-in session could not be refreshed. Please submit your new password again to retry. ${refreshError?.message ?? ""}`.trim());
          return;
        }
        setSession(refreshedData.session);
        const stillRequiresChange = Boolean(refreshedData.session.user.app_metadata?.cms_password_change_required);
        setPasswordChangeRequired(stillRequiresChange);
        if (stillRequiresChange) {
          setError("Your password was updated, but the temporary-password requirement is still active. Please submit your new password again.");
          return;
        }
      }
      setPasswordRecovery(false);
      setNotice(passwordChangeRequired
        ? "Your password has been changed. You are signed in to the CMS."
        : "Password updated. You are signed in to the CMS.");
      window.history.replaceState(null, "", `${window.location.pathname}#/admin`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update your password.");
    } finally {
      setBusy(false);
    }
  }

  function updateSite(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setNotice("");
  }

  function chooseTemplate(template) {
    const customIds = draft.customSections.map((section) => `custom:${section.id}`);
    const templateOrder = DEFAULT_SECTION_ORDER[template] ?? DEFAULT_SECTION_ORDER.classic;
    setDraft((current) => ({
      ...current,
      landingTemplate: template,
      layoutOrder: [
        ...templateOrder.filter((id) => id !== "footer"),
        ...customIds,
        "footer",
      ],
    }));
    setDirty(true);
    setNotice("");
  }

  function moveLayoutSection(index, direction) {
    setDraft((current) => {
      const layoutOrder = [...current.layoutOrder];
      const target = index + direction;
      if (
        target < 0
        || target >= layoutOrder.length
        || layoutOrder[index] === "footer"
        || layoutOrder[target] === "footer"
      ) return current;
      [layoutOrder[index], layoutOrder[target]] = [layoutOrder[target], layoutOrder[index]];
      return { ...current, layoutOrder };
    });
    setDirty(true);
    setNotice("");
  }

  function toggleLayoutSection(sectionId) {
    setDraft((current) => ({
      ...current,
      hiddenSections: current.hiddenSections.includes(sectionId)
        ? current.hiddenSections.filter((id) => id !== sectionId)
        : [...current.hiddenSections, sectionId],
    }));
    setDirty(true);
    setNotice("");
  }

  function addCustomSection() {
    const section = {
      id: crypto.randomUUID(),
      title: "New section",
      text: "Add your section content here.",
      imageUrl: "",
      imageAlt: "",
      buttonText: "",
      buttonUrl: "",
      layout: "text",
      background: "surface",
    };
    setDraft((current) => {
      const layoutOrder = [...current.layoutOrder];
      const footerIndex = layoutOrder.indexOf("footer");
      layoutOrder.splice(footerIndex === -1 ? layoutOrder.length : footerIndex, 0, `custom:${section.id}`);
      return { ...current, customSections: [...current.customSections, section], layoutOrder };
    });
    setDirty(true);
    setNotice("");
  }

  function updateCustomSection(sectionId, field, value) {
    setDraft((current) => ({
      ...current,
      customSections: current.customSections.map((section) => (
        section.id === sectionId ? { ...section, [field]: value } : section
      )),
    }));
    setDirty(true);
    setNotice("");
  }

  function removeCustomSection(sectionId) {
    setDraft((current) => ({
      ...current,
      customSections: current.customSections.filter((section) => section.id !== sectionId),
      layoutOrder: current.layoutOrder.filter((id) => id !== `custom:${sectionId}`),
      hiddenSections: current.hiddenSections.filter((id) => id !== `custom:${sectionId}`),
    }));
    setDirty(true);
    setNotice("");
  }

  async function uploadCustomSectionImage(sectionId, file) {
    if (!file) return;
    const extension = MEDIA_TYPES[file.type];
    if (!extension) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_MEDIA_SIZE) {
      setError("Images must be 5 MB or smaller.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    const path = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("cms-media")
      .upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
    if (uploadError) {
      setError(uploadError.message);
      setBusy(false);
      return;
    }

    const { data } = supabase.storage.from("cms-media").getPublicUrl(path);
    updateCustomSection(sectionId, "imageUrl", data.publicUrl);
    setNotice("Image uploaded. Save the draft and publish it to update the public site.");
    setBusy(false);
  }

  async function uploadSiteImage(field, file) {
    if (!file) return;
    const extension = MEDIA_TYPES[file.type];
    if (!extension) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_MEDIA_SIZE) {
      setError("Images must be 5 MB or smaller.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    const path = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("cms-media")
      .upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
    if (uploadError) {
      setError(uploadError.message);
      setBusy(false);
      return;
    }

    const { data } = supabase.storage.from("cms-media").getPublicUrl(path);
    updateSite(field, data.publicUrl);
    setNotice("Image uploaded. Save the draft and publish it to update the public site.");
    setBusy(false);
  }

  function resetBranding() {
    setDraft((current) => ({
      ...current,
      siteLogoImage: DEFAULT_CMS_CONTENT.siteLogoImage,
      heroBackgroundImage: DEFAULT_CMS_CONTENT.heroBackgroundImage,
      ...Object.fromEntries(SITE_COLORS.map(([field]) => [field, DEFAULT_CMS_CONTENT[field]])),
    }));
    setDirty(true);
    setNotice("");
    setError("");
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
    const { error: saveError } = await supabase.rpc("cms_save_draft", { p_content: draft });
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
    const { error: saveError } = await supabase.rpc("cms_save_draft", { p_content: draft });
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

  async function getFunctionErrorMessage(functionError, fallback = "Unable to create the CMS user.") {
    const response = functionError?.context;
    if (!(response instanceof Response)) return functionError?.message ?? fallback;

    let responseBody;
    try {
      responseBody = await response.clone().json();
    } catch {
      return `User management failed (${response.status}). ${functionError.message}`;
    }

    const detail = typeof responseBody?.error === "string"
      ? responseBody.error
      : typeof responseBody?.message === "string"
        ? responseBody.message
        : "";
    return detail
      ? `User management failed (${response.status}): ${detail}`
      : `User management failed (${response.status}). ${functionError.message}`;
  }

  async function addManagedUser(event) {
    event.preventDefault();
    const authGeneration = authGenerationRef.current;
    setAddingUser(true);
    setError("");
    setNotice("");

    try {
      const { error: createError } = await supabase.functions.invoke("manage-cms-users", {
        body: {
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
          permissions: newUserRole === "admin" ? [] : newUserPermissions,
        },
      });
      if (authGenerationRef.current !== authGeneration) return;
      if (createError) {
        const message = await getFunctionErrorMessage(createError);
        if (authGenerationRef.current !== authGeneration) return;
        setError(message);
        return;
      }

      const { data, error: usersError } = await supabase
        .from("cms_users")
        .select("user_id,email,role,permissions,active,created_at")
        .order("created_at", { ascending: false });
      if (authGenerationRef.current !== authGeneration) return;
      if (usersError) {
        setError(`Account created, but the user list could not be refreshed: ${usersError.message}`);
      } else {
        setManagedUsers(data ?? []);
        setNewUserEmail("");
        setNewUserPassword("");
        setNotice("User account created and role assigned. Share the temporary password securely and ask the user to change it after signing in.");
      }
    } catch (createError) {
      if (authGenerationRef.current !== authGeneration) return;
      setError(createError instanceof Error ? createError.message : "Unable to create the CMS user.");
    } finally {
      if (authGenerationRef.current === authGeneration) setAddingUser(false);
    }
  }

  async function setManagedUserActive(user, active) {
    if (!active && !window.confirm(`Deactivate ${user.email}? They will lose CMS access and be signed out.`)) return;

    const authGeneration = authGenerationRef.current;
    setUpdatingUserId(user.user_id);
    setError("");
    setNotice("");
    try {
      const { error: updateError } = await supabase.functions.invoke("manage-cms-users", {
        body: { action: "set_active", userId: user.user_id, active },
      });
      if (authGenerationRef.current !== authGeneration) return;
      if (updateError) {
        const message = await getFunctionErrorMessage(updateError);
        if (authGenerationRef.current !== authGeneration) return;
        setError(message);
        return;
      }

      const { data, error: usersError } = await supabase
        .from("cms_users")
        .select("user_id,email,role,permissions,active,created_at")
        .order("created_at", { ascending: false });
      if (authGenerationRef.current !== authGeneration) return;
      if (usersError) {
        setError(`User status changed, but the user list could not be refreshed: ${usersError.message}`);
      } else {
        setManagedUsers(data ?? []);
        setNotice(`${user.email} ${active ? "reactivated" : "deactivated"} successfully.`);
      }
    } catch (updateError) {
      if (authGenerationRef.current !== authGeneration) return;
      setError(updateError instanceof Error ? updateError.message : "Unable to update this CMS user's status.");
    } finally {
      if (authGenerationRef.current === authGeneration) setUpdatingUserId("");
    }
  }

  async function resetManagedUserPassword(user) {
    const authGeneration = authGenerationRef.current;
    setResettingUserId(user.user_id);
    setError("");
    setNotice("");
    try {
      const { error: resetError } = await supabase.functions.invoke("manage-cms-users", {
        body: {
          action: "reset_password",
          userId: user.user_id,
          password: passwordResetValue,
        },
      });
      if (authGenerationRef.current !== authGeneration) return;
      if (resetError) {
        const message = await getFunctionErrorMessage(resetError);
        if (authGenerationRef.current !== authGeneration) return;
        setError(message);
        return;
      }

      setPasswordResetUserId("");
      setPasswordResetValue("");
      setNotice(`Temporary password reset for ${user.email}. Share it securely and ask them to change it after signing in.`);
    } catch (resetError) {
      if (authGenerationRef.current !== authGeneration) return;
      setError(resetError instanceof Error ? resetError.message : "Unable to reset this CMS user's password.");
    } finally {
      if (authGenerationRef.current === authGeneration) setResettingUserId("");
    }
  }

  if (!isSupabaseConfigured) {
    return <main className="cms-login-shell"><div className="cms-login-card"><p className="cms-eyebrow">CMS SETUP REQUIRED</p><h1>Connect Supabase</h1><p className="cms-login-description">Set the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY build variables, then rebuild the site.</p><button className="cms-secondary-button" onClick={onPublicSite} type="button">Return to website</button></div></main>;
  }

  if (!authChecked) {
    return <main className="cms-login-shell"><p className="cms-login-description">Checking administrator session...</p></main>;
  }

  if (passwordRecovery) {
    if (!session) return <main className="cms-login-shell"><p className="cms-login-description">Validating password reset link...</p></main>;
    return <PasswordRecoveryScreen busy={busy} error={error} onUpdatePassword={updatePassword} temporaryPassword={passwordChangeRequired} />;
  }

  if (!session) return <LoginScreen busy={busy} error={error} notice={notice} onGoogleLogin={loginWithGoogle} onLogin={login} onResetPassword={requestPasswordReset} />;

  if (passwordChangeRequired) {
    return <PasswordRecoveryScreen busy={busy} error={error} onUpdatePassword={updatePassword} temporaryPassword />;
  }

  if (adminCheckedUserId !== userId || loadingContent) {
    return <main className="cms-login-shell"><p className="cms-login-description">Verifying administrator access...</p></main>;
  }

  if (!isCmsUser) {
    return (
      <main className="cms-login-shell">
        <div className="cms-login-card">
          <p className="cms-eyebrow">ACCESS RESTRICTED</p>
          <h1>CMS access required</h1>
          <p className="cms-login-description">This sign-in email does not have an active CMS role. Ask an Administrator to check that your account is assigned and active.</p>
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
  const hasPermission = (permission) => isAdmin || accessPermissions.includes(permission);
  const canOpenPanel = (id) => {
    if (id === "overview") return true;
    if (id === "users") return isAdmin;
    if (["heroSlides", "announcements", "services", "paymentMethods", "steps"].includes(id)) return hasPermission("edit_sections");
    if (id === "layout") return hasPermission("edit_layout");
    if (id === "site") return hasPermission("edit_site_settings") || hasPermission("edit_layout");
    if (id === "revisions") return hasPermission("restore_revisions");
    return false;
  };
  const visiblePanels = PANELS.filter(([id]) => canOpenPanel(id));

  return (
    <div className="cms-admin">
      <aside className="cms-sidebar">
        <button className="cms-brand" onClick={onPublicSite} type="button">
          <span className="cms-brand-mark"><WaterLogo /></span>
          <span>Admin Page<small>Hinunangan Water System</small></span>
        </button>
        <div className="cms-side-label">WORKSPACE</div>
        <nav aria-label="CMS sections" className="cms-nav">
          {visiblePanels.map(([id, label]) => (
            <button aria-current={panel === id ? "page" : undefined} className={panel === id ? "is-selected" : ""} key={id} onClick={() => { setPanel(id); setError(""); setNotice(""); }} type="button">
              <Icon name={id} /><span>{label}</span>
              {id === "revisions" && revisions.length > 0 && <small>{revisions.length}</small>}
            </button>
          ))}
        </nav>
        <div className="cms-sidebar-bottom">
          <div className="cms-user-badge"><span>{session.user.email?.slice(0, 1).toUpperCase()}</span><div><strong>{isAdmin ? "Administrator" : "Editor"}</strong><small>{session.user.email}</small></div></div>
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
                      <button className="cms-stat-card" disabled={!canOpenPanel(section)} key={section} onClick={() => setPanel(section)} type="button">
                        <span>{label}</span><strong>{active}</strong><small>active of {total}</small>
                      </button>
                    ))}
                  </div>
                  <div className="cms-overview-grid">
                    <section className="cms-info-card">
                      <div className="cms-card-heading"><div><h3>Publishing</h3><p>{dirty ? "You have unsaved changes." : hasDraft ? "Your latest draft is saved." : "Start from the current website content."}</p></div><span className={`cms-status-pill ${dirty ? "is-draft" : "is-active"}`}>{dirty ? "Unsaved" : hasDraft ? "Draft saved" : "Ready"}</span></div>
                      <div className="cms-publish-detail"><span>Last published</span><strong>{published ? new Date(published.published_at).toLocaleString() : "Not published yet"}</strong></div>
                      <div className="cms-publish-detail"><span>Latest version</span><strong>{published ? `Version ${published.version}` : "—"}</strong></div>
                      <div className="cms-action-row"><button className="cms-secondary-button" disabled={busy} onClick={() => onPreview(draft)} type="button">Preview draft</button>{hasPermission("save_draft") && <button className="cms-primary-button" disabled={busy || !dirty} onClick={saveDraft} type="button">{busy ? "Saving..." : "Save draft"}</button>}{hasPermission("publish_content") && <button className="cms-publish-button" disabled={busy} onClick={publishDraft} type="button">{busy ? "Publishing..." : "Publish changes"}</button>}</div>
                    </section>
                    <section className="cms-info-card">
                      <div className="cms-card-heading"><div><h3>Quick start</h3><p>Common content tasks</p></div></div>
                      {visiblePanels.filter(([id]) => ["heroSlides", "layout", "announcements", "services", "paymentMethods", "steps"].includes(id)).map(([id, label]) => (
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

              {panel === "users" && isAdmin && (
                <section className="cms-panel-content">
                  <div className="cms-section-toolbar">
                    <div><h2>User management</h2><p>Create CMS accounts and decide what Editors can manage.</p></div>
                  </div>
                  <form className="cms-info-card cms-user-form" onSubmit={addManagedUser}>
                    <div className="cms-branding-heading"><div><h3>Add a user</h3><p>Accounts use the email and temporary password you provide. Share the password privately.</p></div></div>
                    <label className="cms-field">
                      <span>Email address</span>
                      <input autoComplete="off" disabled={addingUser} onChange={(event) => setNewUserEmail(event.target.value)} required type="email" value={newUserEmail} />
                    </label>
                    <label className="cms-field">
                      <span>Temporary password (at least 12 characters)</span>
                      <input autoComplete="new-password" disabled={addingUser} minLength={12} onChange={(event) => setNewUserPassword(event.target.value)} required type="password" value={newUserPassword} />
                    </label>
                    <label className="cms-field">
                      <span>Role</span>
                      <select disabled={addingUser} onChange={(event) => setNewUserRole(event.target.value)} value={newUserRole}>
                        <option value="editor">Editor</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </label>
                    {newUserRole === "editor" && (
                      <fieldset className="cms-permission-list">
                        <legend>Editor permissions</legend>
                        <p>Choose only the tasks this Editor needs. Permissions are checked again by Supabase when changes are saved, published, or restored.</p>
                        {CMS_PERMISSIONS.map(([permission, label, description]) => (
                          <label className="cms-permission-option" key={permission}>
                            <input
                              checked={newUserPermissions.includes(permission)}
                              disabled={addingUser}
                              onChange={(event) => setNewUserPermissions((current) => event.target.checked
                                ? [...current, permission]
                                : current.filter((item) => item !== permission))}
                              type="checkbox"
                            />
                            <span><strong>{label}</strong><small>{description}</small></span>
                          </label>
                        ))}
                      </fieldset>
                    )}
                    {newUserRole === "admin" && <p className="cms-user-admin-note">Administrators can manage users and have all CMS permissions.</p>}
                    <button className="cms-primary-button" disabled={addingUser} type="submit">{addingUser ? "Adding user..." : "Add user"}</button>
                  </form>
                  <section className="cms-info-card cms-managed-users">
                    <div className="cms-branding-heading"><div><h3>CMS users</h3><p>{managedUsers.filter((user) => user.active).length} active of {managedUsers.length} account{managedUsers.length === 1 ? "" : "s"}</p></div></div>
                    {managedUsers.length ? (
                      <div className="cms-managed-user-list">
                        {managedUsers.map((user) => (
                          <article className={`cms-managed-user${user.active ? "" : " is-inactive"}`} key={user.user_id}>
                            <div><strong>{user.email}</strong><small>Added {new Date(user.created_at).toLocaleDateString()}</small></div>
                            <span className={`cms-status-pill ${user.active ? "is-active" : "is-draft"}`}>{user.active ? (user.role === "admin" ? "Administrator" : "Editor") : "Deactivated"}</span>
                            <p>{user.active ? (user.role === "admin" ? "All CMS permissions" : CMS_PERMISSIONS.filter(([permission]) => user.permissions?.includes(permission)).map(([, label]) => label).join(", ") || "No permissions assigned") : `Inactive ${user.role === "admin" ? "Administrator" : "Editor"} account`}</p>
                            <button
                              className={`cms-user-status-button${user.active ? " is-deactivate" : " is-activate"}`}
                              disabled={updatingUserId !== "" || user.user_id === userId}
                              onClick={() => setManagedUserActive(user, !user.active)}
                              title={user.user_id === userId ? "You cannot change your own account status" : undefined}
                              type="button"
                            >
                              {updatingUserId === user.user_id ? "Updating..." : user.active ? "Deactivate" : "Reactivate"}
                            </button>
                            <button
                              className="cms-user-password-button"
                              disabled={updatingUserId !== "" || resettingUserId !== "" || user.user_id === userId}
                              onClick={() => {
                                setPasswordResetUserId((current) => current === user.user_id ? "" : user.user_id);
                                setPasswordResetValue("");
                              }}
                              type="button"
                            >
                              Reset password
                            </button>
                            {passwordResetUserId === user.user_id && (
                              <form
                                className="cms-user-password-form"
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  resetManagedUserPassword(user);
                                }}
                              >
                                <label className="cms-field">
                                  <span>New temporary password (at least 12 characters)</span>
                                  <input
                                    autoComplete="new-password"
                                    disabled={resettingUserId === user.user_id}
                                    minLength={12}
                                    onChange={(event) => setPasswordResetValue(event.target.value)}
                                    required
                                    type="password"
                                    value={passwordResetValue}
                                  />
                                </label>
                                <div className="cms-action-row">
                                  <button className="cms-primary-button" disabled={resettingUserId === user.user_id} type="submit">
                                    {resettingUserId === user.user_id ? "Resetting..." : "Set temporary password"}
                                  </button>
                                  <button
                                    className="cms-secondary-button"
                                    disabled={resettingUserId === user.user_id}
                                    onClick={() => { setPasswordResetUserId(""); setPasswordResetValue(""); }}
                                    type="button"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            )}
                          </article>
                        ))}
                      </div>
                    ) : <div className="cms-empty-state">No CMS user accounts were found.</div>}
                  </section>
                </section>
              )}

              {panel === "layout" && (
                <section className="cms-panel-content">
                  <div className="cms-section-toolbar">
                    <div><h2>Layout editor</h2><p>Arrange page sections, hide sections you do not need, and create custom content sections.</p></div>
                    <button className="cms-primary-button" disabled={busy} onClick={addCustomSection} type="button">＋ Add section</button>
                  </div>
                  <div className="cms-info-card cms-layout-list-card">
                    <div className="cms-branding-heading"><div><h3>Page structure</h3><p>Use the arrows to reorder sections. Hidden sections remain editable and can be restored.</p></div></div>
                    <ol className="cms-layout-list">
                      {draft.layoutOrder.map((sectionId, index) => {
                        const customSection = sectionId.startsWith("custom:")
                          ? draft.customSections.find((section) => `custom:${section.id}` === sectionId)
                          : null;
                        const label = customSection?.title || BUILT_IN_SECTIONS.find(([id]) => id === sectionId)?.[1] || "Custom section";
                        const isHidden = draft.hiddenSections.includes(sectionId);
                        return (
                          <li className={`cms-layout-row${isHidden ? " is-hidden" : ""}`} key={sectionId}>
                            <span className="cms-layout-position">{index + 1}</span>
                            <div className="cms-layout-name"><strong>{label}</strong><small>{sectionId === "footer" ? "Fixed footer; visibility only" : customSection ? "Custom content" : "Built-in page section"}</small></div>
                            <label className="cms-layout-toggle"><input checked={!isHidden} onChange={() => toggleLayoutSection(sectionId)} type="checkbox" /><span>{isHidden ? "Hidden" : "Visible"}</span></label>
                            <div className="cms-layout-actions">
                              <button aria-label={`Move ${label} up`} disabled={busy || index === 0 || sectionId === "footer" || draft.layoutOrder[index - 1] === "footer"} onClick={() => moveLayoutSection(index, -1)} type="button">↑</button>
                              <button aria-label={`Move ${label} down`} disabled={busy || index === draft.layoutOrder.length - 1 || sectionId === "footer" || draft.layoutOrder[index + 1] === "footer"} onClick={() => moveLayoutSection(index, 1)} type="button">↓</button>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                  <div className="cms-layout-custom-list">
                    {draft.customSections.map((section) => (
                      <article className="cms-info-card cms-custom-section-card" key={section.id}>
                        <div className="cms-custom-section-header">
                          <div><h3>{section.title || "Untitled section"}</h3><p>Edit the section content shown on your public landing page.</p></div>
                          <button className="cms-reset-image" disabled={busy} onClick={() => removeCustomSection(section.id)} type="button">Remove section</button>
                        </div>
                        <div className="cms-custom-section-fields">
                          <label className="cms-field"><span>Section heading</span><input disabled={busy} onChange={(event) => updateCustomSection(section.id, "title", event.target.value)} value={section.title} /></label>
                          <div className="cms-field cms-field-text"><span>Content</span><RichTextEditor disabled={busy} onChange={(value) => updateCustomSection(section.id, "text", value)} value={section.text} /></div>
                          <label className="cms-field"><span>Layout</span><select disabled={busy} onChange={(event) => updateCustomSection(section.id, "layout", event.target.value)} value={section.layout}><option value="text">Text only</option><option value="image-left">Image left</option><option value="image-right">Image right</option><option value="centered">Centered</option></select></label>
                          <label className="cms-field"><span>Background</span><select disabled={busy} onChange={(event) => updateCustomSection(section.id, "background", event.target.value)} value={section.background}><option value="surface">Surface</option><option value="page">Page background</option><option value="primary">Primary color</option></select></label>
                          <label className="cms-field"><span>Button label (optional)</span><input disabled={busy} onChange={(event) => updateCustomSection(section.id, "buttonText", event.target.value)} value={section.buttonText} /></label>
                          <label className="cms-field"><span>Button link (optional)</span><input disabled={busy} onChange={(event) => updateCustomSection(section.id, "buttonUrl", event.target.value)} placeholder="https://... or #services" value={section.buttonUrl} /></label>
                        </div>
                        <div className="cms-custom-media">
                          <div className="cms-media-preview">
                            {section.imageUrl ? <img alt={section.imageAlt || `${section.title} preview`} src={section.imageUrl} /> : <span>Optional section image</span>}
                          </div>
                          <div className="cms-custom-media-controls">
                            <label className="cms-field"><span>Upload image (JPG, PNG, WebP; max 5 MB)</span><input accept="image/jpeg,image/png,image/webp" disabled={busy || !hasPermission("edit_site_settings")} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; uploadCustomSectionImage(section.id, file); }} type="file" /></label>
                            <label className="cms-field"><span>Image description (accessibility)</span><input disabled={busy} onChange={(event) => updateCustomSection(section.id, "imageAlt", event.target.value)} value={section.imageAlt} /></label>
                          </div>
                          {!hasPermission("edit_site_settings") && <p className="cms-user-admin-note">Image uploads require the Editor permission “Edit site settings”.</p>}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {panel === "site" && (
                <section className="cms-panel-content">
                  <div className="cms-section-toolbar"><div><h2>Site settings</h2><p>Update shared labels, branding, and colors displayed across the public site.</p></div>{hasPermission("edit_site_settings") && <button className="cms-secondary-button" disabled={busy} onClick={resetBranding} type="button">Reset branding</button>}</div>
                  <div className="cms-info-card cms-branding-card">
                    <div className="cms-branding-heading"><div><h3>Landing page template</h3><p>Choose a layout variation. All templates use the same editable content, images, and color palette.</p></div></div>
                    {!hasPermission("edit_layout") && <p className="cms-user-admin-note">Changing the template requires the Editor permission “Edit page layout”.</p>}
                    <div className="cms-template-grid">
                      {LANDING_TEMPLATES.map(([id, label, description]) => (
                        <button
                          aria-pressed={draft.landingTemplate === id}
                          className={`cms-template-card${draft.landingTemplate === id ? " is-selected" : ""}`}
                          disabled={busy || !hasPermission("edit_layout")}
                          key={id}
                          onClick={() => chooseTemplate(id)}
                          type="button"
                        >
                          <span aria-hidden="true" className={`cms-template-preview cms-template-preview-${id}`}>
                            <i /><i /><i /><i />
                          </span>
                          <span className="cms-template-title">{label}{draft.landingTemplate === id && <small>Selected</small>}</span>
                          <span className="cms-template-description">{description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="cms-info-card cms-branding-card">
                    <div className="cms-branding-heading"><div><h3>Site images</h3><p>JPG, PNG, or WebP; maximum file size 5 MB.</p></div></div>
                    <div className="cms-media-grid">
                      {[
                        ["siteLogoImage", "Site logo", "Use a square or wide image with a transparent background for best results."],
                        ["heroBackgroundImage", "Hero background", "This image is displayed behind the homepage hero content."],
                      ].map(([field, label, help]) => (
                        <div className="cms-media-field" key={field}>
                          <div className="cms-media-preview">
                            {draft[field] ? <img alt={`${label} preview`} src={draft[field]} /> : <span>No image selected</span>}
                          </div>
                          <label className="cms-field">
                            <span>{label}</span>
                            <input
                              accept="image/jpeg,image/png,image/webp"
                              disabled={busy || !hasPermission("edit_site_settings")}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                uploadSiteImage(field, file);
                              }}
                              type="file"
                            />
                          </label>
                          <p>{help}</p>
                          {draft[field] &&                           <button className="cms-reset-image" disabled={busy || !hasPermission("edit_site_settings")} onClick={() => updateSite(field, "")} type="button">Remove from draft</button>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="cms-info-card cms-branding-card">
                    <div className="cms-branding-heading"><div><h3>Site color palette</h3><p>Choose colors used by headings, controls, cards, backgrounds, and page text.</p></div></div>
                    <div className="cms-color-grid">
                      {SITE_COLORS.map(([field, label]) => (
                        <label className="cms-color-field" key={field}>
                          <span>{label}</span>
                          <div>
                            <input aria-label={`${label} picker`} disabled={busy || !hasPermission("edit_site_settings")} onChange={(event) => updateSite(field, event.target.value)} type="color" value={draft[field]} />
                            <code>{draft[field]}</code>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
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
                          <textarea disabled={busy || !hasPermission("edit_site_settings")} onChange={(event) => updateSite(field, event.target.value)} rows={2} value={draft[field]} />
                        ) : (
                          <input disabled={busy || !hasPermission("edit_site_settings")} onChange={(event) => updateSite(field, event.target.value)} value={draft[field]} />
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

              {panel !== "overview" && panel !== "users" && (hasPermission("save_draft") || hasPermission("publish_content")) && (
                <div className="cms-sticky-publish">
                  <div><strong>{dirty ? "Unsaved changes" : "Draft status"}</strong><span>{published ? `Live version ${published.version}` : "No live version yet"}</span></div>
                  <div className="cms-action-row">
                    <button className="cms-secondary-button" disabled={busy} onClick={() => onPreview(draft)} type="button">Preview</button>
                    {hasPermission("save_draft") && <button className="cms-secondary-button" disabled={busy || !dirty} onClick={saveDraft} type="button">{busy ? "Saving..." : "Save draft"}</button>}
                    {hasPermission("publish_content") && <button className="cms-publish-button" disabled={busy} onClick={publishDraft} type="button">{busy ? "Publishing..." : "Publish"}</button>}
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
