/**
 * Dashboard hero/tab copy only (browser localStorage). User accounts live in Supabase only.
 */
(function () {
  const STORAGE_CONFIG = "cloudpulse_site_config";

  const DEFAULT_SITE_CONFIG = {
    eyebrow: "Cloud Operations Command Center",
    badge1: "Live Telemetry",
    badge2: "Auto Alerting",
    badge3: "Forecasting",
    heroTitleRest: ": Centralized Cloud Performance Monitoring",
    heroSubtitle:
      "Live monitoring for CPU, memory, storage, and network usage across multiple cloud instances with automated alerts and exportable performance reports.",
    tabOverview: "Overview",
    tabPerformance: "Performance",
    tabReliability: "Reliability",
    tabFinops: "FinOps",
    tabHistory: "History"
  };

  function getSiteConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_CONFIG);
      if (!raw) return { ...DEFAULT_SITE_CONFIG };
      return { ...DEFAULT_SITE_CONFIG, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SITE_CONFIG };
    }
  }

  function saveSiteConfig(partial) {
    const merged = { ...getSiteConfig(), ...partial };
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(merged));
    return merged;
  }

  function resetSiteConfig() {
    localStorage.removeItem(STORAGE_CONFIG);
    return { ...DEFAULT_SITE_CONFIG };
  }

  function applySiteConfigToDashboard() {
    const cfg = getSiteConfig();
    const eyebrow = document.querySelector(".hero .eyebrow");
    if (eyebrow) eyebrow.textContent = cfg.eyebrow || DEFAULT_SITE_CONFIG.eyebrow;
    const badges = document.querySelectorAll(".hero-badges span");
    const bs = [cfg.badge1, cfg.badge2, cfg.badge3];
    badges.forEach((el, i) => {
      if (bs[i]) el.textContent = bs[i];
    });
    const heroRest = document.getElementById("heroTitleRest");
    if (heroRest) heroRest.textContent = cfg.heroTitleRest || DEFAULT_SITE_CONFIG.heroTitleRest;
    const heroSub = document.getElementById("siteHeroSubtitle");
    if (heroSub) heroSub.textContent = cfg.heroSubtitle || DEFAULT_SITE_CONFIG.heroSubtitle;

    const tabMap = [
      ["overview", cfg.tabOverview],
      ["performance", cfg.tabPerformance],
      ["reliability", cfg.tabReliability],
      ["finops", cfg.tabFinops],
      ["history", cfg.tabHistory]
    ];
    tabMap.forEach(([target, label]) => {
      const btn = document.querySelector(`.tab-btn[data-tab-target="${target}"]`);
      if (btn && label) btn.textContent = label;
    });
  }

  window.SiteConfig = {
    STORAGE_CONFIG,
    DEFAULT_SITE_CONFIG,
    getSiteConfig,
    saveSiteConfig,
    resetSiteConfig,
    applySiteConfigToDashboard
  };
})();
