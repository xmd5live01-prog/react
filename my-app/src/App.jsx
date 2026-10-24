import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import LandingPage from "./LandingPage";
import { DEFAULT_CMS_CONTENT, normalizeCmsContent } from "./cmsContent";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

const WaterBillInquiry = lazy(() => import("./WaterBillInquiry"));
const AdminPage = lazy(() => import("./AdminPage"));

function getRoute() {
  if (window.location.hash === "#/admin" || new URLSearchParams(window.location.search).has("cms-recovery")) return "admin";
  if (window.location.hash === "#/preview") return "preview";
  return "public";
}

export default function App() {
  const [route, setRoute] = useState(getRoute);
  const [showBillPortal, setShowBillPortal] = useState(false);
  const [publishedContent, setPublishedContent] = useState(DEFAULT_CMS_CONTENT);
  const [previewContent, setPreviewContent] = useState(null);
  const [contentError, setContentError] = useState("");

  useEffect(() => {
    const updateRoute = () => setRoute(getRoute());
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);

  useEffect(() => {
    if (route === "preview" && !previewContent) {
      window.location.hash = "/";
    }
  }, [route, previewContent]);

  useEffect(() => {
    if (route !== "public" || !isSupabaseConfigured) return undefined;

    let active = true;
    async function loadPublishedContent() {
      const { data, error } = await supabase
        .from("cms_public_content")
        .select("content")
        .eq("singleton_id", true)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setPublishedContent(DEFAULT_CMS_CONTENT);
        setContentError("Showing default website content because published CMS content could not be loaded.");
        return;
      }
      setContentError("");
      if (data?.content) setPublishedContent(normalizeCmsContent(data.content));
    }

    loadPublishedContent().catch(() => {
      if (active) {
        setPublishedContent(DEFAULT_CMS_CONTENT);
        setContentError("Showing default website content because published CMS content could not be loaded.");
      }
    });
    return () => { active = false; };
  }, [route]);

  const openAdmin = useCallback(() => {
    setShowBillPortal(false);
    window.location.hash = "/admin";
  }, []);

  const openPublicSite = useCallback(() => {
    setShowBillPortal(false);
    setPreviewContent(null);
    window.location.hash = "/";
  }, []);

  const previewDraft = useCallback((draft) => {
    setPreviewContent(normalizeCmsContent(draft));
    window.location.hash = "/preview";
  }, []);

  if (showBillPortal) {
    return (
      <Suspense fallback={<p className="p-6 text-center font-sans">Opening bill search...</p>}>
        <WaterBillInquiry onBack={() => setShowBillPortal(false)} />
      </Suspense>
    );
  }

  if (route === "admin") {
    return (
      <Suspense fallback={<p className="p-6 text-center font-sans">Opening the CMS...</p>}>
        <AdminPage onPreview={previewDraft} onPublicSite={openPublicSite} />
      </Suspense>
    );
  }

  const isPreview = route === "preview" && Boolean(previewContent);
  return (
    <LandingPage
      content={isPreview ? previewContent : publishedContent}
      contentError={isPreview ? "" : contentError}
      onExitPreview={openPublicSite}
      onOpenAdmin={openAdmin}
      onSearchBill={() => setShowBillPortal(true)}
      preview={isPreview}
    />
  );
}
