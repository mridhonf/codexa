import "../css/style.css";
import { createClient } from "@supabase/supabase-js";
import { CODEXA_SUPABASE, CODEXA_SITE } from "./supabase-config.js";

(() => {
  const siteConfig = CODEXA_SITE || {};
  const supabaseConfig = CODEXA_SUPABASE || {};
  const whatsappNumber = siteConfig.whatsappNumber || "6281234567890";
  const hasSupabaseConfig = Boolean(supabaseConfig.url && supabaseConfig.anonKey);
  const supabaseClient = hasSupabaseConfig ? createClient(supabaseConfig.url, supabaseConfig.anonKey) : null;

  const defaultCategories = [
    { name: "Website", slug: "website", sort_order: 1, is_active: true },
    { name: "Dashboard", slug: "dashboard", sort_order: 2, is_active: true },
    { name: "UI/UX", slug: "uiux", sort_order: 3, is_active: true }
  ];

  let categories = [...defaultCategories];
  let cardCarouselTimers = [];
  let lastFocusedElement = null;
  let modalMedia = [];
  let modalIndex = 0;
  let lightboxIndex = 0;
  let touchStartX = 0;

  const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));

  const makeWhatsAppLink = (message) => `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  const categoryLabel = (slug = "website") => {
    const found = categories.find((item) => item.slug === slug);
    return found?.name || ({ website: "Website", dashboard: "Dashboard", uiux: "UI/UX" }[slug]) || "Project";
  };

  const normalizeMedia = (project = {}) => {
    const rawMedia = Array.isArray(project.media) ? project.media : [];
    const media = rawMedia
      .map((item) => ({
        url: String(item?.url || item?.image_url || "").trim(),
        path: String(item?.path || item?.image_path || "").trim(),
        device: ["desktop", "mobile"].includes(item?.device) ? item.device : (project.display_device || "desktop"),
        name: String(item?.name || project.title || "Preview project").trim()
      }))
      .filter((item) => item.url);

    if (!media.length && project.image_url) {
      media.push({
        url: project.image_url,
        path: project.image_path || "",
        device: project.display_device || "desktop",
        name: project.title || "Preview project"
      });
    }

    return media;
  };

  const safeJSONAttr = (value) => escapeHTML(JSON.stringify(value || []));

  const setWhatsAppLinks = () => {
    document.querySelectorAll(".js-whatsapp").forEach((link) => {
      const currentText = link.dataset.waMessage || "Halo Codexa, saya mau konsultasi project website.";
      link.href = makeWhatsAppLink(currentText);
    });
  };

  const menuToggle = document.querySelector(".menu-toggle");
  const mainNav = document.querySelector(".main-nav");
  const navLinks = document.querySelectorAll(".main-nav a");

  menuToggle?.addEventListener("click", () => {
    const isOpen = menuToggle.classList.toggle("is-open");
    mainNav?.classList.toggle("is-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      menuToggle?.classList.remove("is-open");
      mainNav?.classList.remove("is-open");
      menuToggle?.setAttribute("aria-expanded", "false");
    });
  });

  let revealObserver;
  const observeReveals = () => {
    revealObserver?.disconnect();
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );
    document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));
  };

  const sections = document.querySelectorAll("main section[id]");
  if (sections.length && navLinks.length) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.getAttribute("id");
          navLinks.forEach((link) => {
            link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
          });
        });
      },
      { rootMargin: "-42% 0px -52% 0px" }
    );
    sections.forEach((section) => navObserver.observe(section));
  }

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  document.querySelector(".back-top")?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  const projectGrid = document.getElementById("projectGrid");
  const filterRow = document.getElementById("projectFilterRow");
  const modal = document.getElementById("detailModal");
  const modalType = document.getElementById("modalType");
  const modalTitle = document.getElementById("modalTitle");
  const modalSubtitle = document.getElementById("modalSubtitle");
  const modalList = document.getElementById("modalList");
  const modalNote = document.getElementById("modalNote");
  const modalGallery = document.getElementById("modalGallery");
  const modalTrack = document.getElementById("modalGalleryTrack");
  const modalPrev = document.getElementById("modalPrev");
  const modalNext = document.getElementById("modalNext");
  const modalDots = document.getElementById("modalDots");
  const modalDevice = document.getElementById("modalDevice");
  const modalWhatsappBtn = document.getElementById("modalWhatsappBtn");
  const imageLightbox = document.getElementById("imageLightbox");
  const lightboxImage = document.getElementById("lightboxImage");
  const lightboxTitle = document.getElementById("lightboxTitle");
  const lightboxDevice = document.getElementById("lightboxDevice");
  const lightboxPrev = document.querySelector("[data-lightbox-prev]");
  const lightboxNext = document.querySelector("[data-lightbox-next]");

  const placeholderVisual = (category = "website") => {
    if (category === "dashboard") {
      return `<div class="project-visual dashboard-visual" aria-hidden="true"><div class="sidebar-mini"></div><div class="dash-main"><span></span><span></span><span></span><div></div></div></div>`;
    }
    if (category === "uiux") {
      return `<div class="project-visual mobile-visual" aria-hidden="true"><div class="mobile-ui"><b></b><span></span><span></span><i></i><i></i></div></div>`;
    }
    return `<div class="project-visual hotel-visual" aria-hidden="true"><div class="visual-window"><span></span><span></span><span></span></div><div class="visual-hero-line"></div><div class="visual-card-row"><i></i><i></i></div><div class="visual-bottom"></div></div>`;
  };

  const renderProjectMedia = (project) => {
    const media = normalizeMedia(project);
    if (!media.length) return placeholderVisual(project.category);
    const device = project.display_device || media[0]?.device || "desktop";
    const safeTitle = escapeHTML(project.title || "Project Codexa");

    return `
      <div class="project-thumb project-carousel device-${device === "mobile" ? "mobile" : "desktop"}" data-card-carousel>
        <div class="project-slide-stack">
          ${media.map((item, index) => `
            <img class="project-slide${index === 0 ? " is-active" : ""}" src="${escapeHTML(item.url)}" alt="Preview UI ${safeTitle}" loading="lazy" />
          `).join("")}
        </div>
        <span class="device-pill">${device === "mobile" ? "Mobile" : "Desktop"}</span>
        ${media.length > 1 ? `<div class="project-mini-dots">${media.map((_, index) => `<span class="${index === 0 ? "active" : ""}"></span>`).join("")}</div>` : ""}
      </div>`;
  };

  const renderProjectCard = (project, index = 0) => {
    const features = Array.isArray(project.features) ? project.features : String(project.features || "").split("|");
    const list = features.map((item) => String(item).trim()).filter(Boolean).join("|");
    const delay = index % 4 ? ` delay-${index % 4}` : "";
    const media = normalizeMedia(project);
    const displayDevice = project.display_device || media[0]?.device || "desktop";

    return `
      <article class="project-card reveal${delay} modal-trigger" tabindex="0" role="button" data-category="${escapeHTML(project.category || "website")}"
        data-type="Project"
        data-title="${escapeHTML(project.title || "Project Codexa")}"
        data-subtitle="${escapeHTML(project.subtitle || project.short_description || "Preview project Codexa.")}"
        data-list="${escapeHTML(list)}"
        data-note="${escapeHTML(project.note || "Project ini bisa dijadikan referensi awal untuk kebutuhan website kamu.")}"
        data-device="${escapeHTML(displayDevice)}"
        data-media="${safeJSONAttr(media)}">
        ${renderProjectMedia(project)}
        <div class="project-content">
          <span>${escapeHTML(categoryLabel(project.category))}</span>
          <h3>${escapeHTML(project.title || "Project Codexa")}</h3>
          <p>${escapeHTML(project.short_description || "Tampilan project yang rapi, ringan, dan fokus ke kebutuhan user.")}</p>
        </div>
      </article>`;
  };

  const getFilterButtons = () => Array.from(document.querySelectorAll(".filter-btn"));

  const applyProjectFilter = (filter = document.querySelector(".filter-btn.active")?.dataset.filter || "all") => {
    document.querySelectorAll(".project-card").forEach((card) => {
      const shouldShow = filter === "all" || card.dataset.category === filter;
      card.classList.toggle("is-hidden", !shouldShow);
    });
  };

  const bindFilterButtons = () => {
    getFilterButtons().forEach((button) => {
      button.addEventListener("click", () => {
        getFilterButtons().forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        applyProjectFilter(button.dataset.filter);
      });
    });
  };

  const renderFilters = (projects = []) => {
    if (!filterRow) return;
    const categoryMap = new Map();

    categories
      .filter((item) => item.is_active !== false)
      .forEach((item) => categoryMap.set(item.slug, item.name));

    projects.forEach((project) => {
      if (project.category && !categoryMap.has(project.category)) {
        categoryMap.set(project.category, categoryLabel(project.category));
      }
    });

    filterRow.innerHTML = `
      <button class="filter-btn active" type="button" data-filter="all">Semua</button>
      ${[...categoryMap.entries()].map(([slug, name]) => `<button class="filter-btn" type="button" data-filter="${escapeHTML(slug)}">${escapeHTML(name)}</button>`).join("")}
    `;
    bindFilterButtons();
  };

  const stopCardCarousels = () => {
    cardCarouselTimers.forEach((timer) => clearInterval(timer));
    cardCarouselTimers = [];
  };

  const initCardCarousels = () => {
    stopCardCarousels();
    document.querySelectorAll("[data-card-carousel]").forEach((carousel, carouselIndex) => {
      const slides = Array.from(carousel.querySelectorAll(".project-slide"));
      const dots = Array.from(carousel.querySelectorAll(".project-mini-dots span"));
      if (slides.length <= 1) return;

      let active = 0;
      const goTo = (next) => {
        active = next % slides.length;
        slides.forEach((slide, index) => slide.classList.toggle("is-active", index === active));
        dots.forEach((dot, index) => dot.classList.toggle("active", index === active));
      };

      const timer = setInterval(() => goTo(active + 1), 3200 + (carouselIndex % 3) * 450);
      cardCarouselTimers.push(timer);
    });
  };

  const updateModalGallery = () => {
    if (!modalTrack || !modalDots || !modalGallery) return;
    const hasMedia = modalMedia.length > 0;
    modalGallery.hidden = !hasMedia;
    if (!hasMedia) {
      modalTrack.innerHTML = "";
      modalDots.innerHTML = "";
      return;
    }

    modalTrack.style.transform = `translateX(-${modalIndex * 100}%)`;
    Array.from(modalTrack.children).forEach((slide, index) => {
      slide.classList.toggle("is-active", index === modalIndex);
    });
    modalDots.querySelectorAll("button").forEach((dot, index) => {
      dot.classList.toggle("active", index === modalIndex);
      dot.setAttribute("aria-current", index === modalIndex ? "true" : "false");
    });
    if (modalDevice) {
      const device = modalMedia[modalIndex]?.device || "desktop";
      modalDevice.textContent = device === "mobile" ? "Web Mobile" : "Web Desktop";
    }
  };

  const setupModalGallery = (media) => {
    modalMedia = media || [];
    modalIndex = 0;

    if (!modalTrack || !modalDots || !modalGallery) return;

    if (!modalMedia.length) {
      updateModalGallery();
      return;
    }

    modalTrack.innerHTML = modalMedia.map((item, index) => `
      <figure class="modal-slide ${item.device === "mobile" ? "is-mobile" : "is-desktop"}${index === 0 ? " is-active" : ""}">
        <button class="modal-zoom-trigger" type="button" data-zoom-index="${index}" aria-label="Perbesar gambar ${index + 1}">
          <img src="${escapeHTML(item.url)}" alt="${escapeHTML(item.name || "Preview project Codexa")}" />
          <span class="modal-zoom-hint">Klik untuk perbesar</span>
        </button>
      </figure>
    `).join("");

    modalDots.innerHTML = modalMedia.map((_, index) => `
      <button type="button" aria-label="Lihat gambar ${index + 1}" class="${index === 0 ? "active" : ""}" data-modal-dot="${index}"></button>
    `).join("");

    const multiple = modalMedia.length > 1;
    if (modalPrev) modalPrev.hidden = !multiple;
    if (modalNext) modalNext.hidden = !multiple;
    if (modalDots) modalDots.hidden = !multiple;
    updateModalGallery();
  };

  const moveModalGallery = (step) => {
    if (!modalMedia.length) return;
    modalIndex = (modalIndex + step + modalMedia.length) % modalMedia.length;
    updateModalGallery();
  };

  const updateLightbox = () => {
    if (!imageLightbox || !lightboxImage || !modalMedia.length) return;
    const current = modalMedia[lightboxIndex] || modalMedia[0];
    lightboxImage.src = current.url;
    lightboxImage.alt = current.name || "Preview project Codexa";
    if (lightboxTitle) lightboxTitle.textContent = current.name || modalTitle?.textContent || "Preview project Codexa";
    if (lightboxDevice) lightboxDevice.textContent = current.device === "mobile" ? "Web Mobile" : "Web Desktop";

    const multiple = modalMedia.length > 1;
    if (lightboxPrev) lightboxPrev.hidden = !multiple;
    if (lightboxNext) lightboxNext.hidden = !multiple;
  };

  const openImageLightbox = (index = modalIndex) => {
    if (!imageLightbox || !lightboxImage || !modalMedia.length) return;
    lightboxIndex = Number.isFinite(index) ? index : modalIndex;
    if (lightboxIndex < 0 || lightboxIndex >= modalMedia.length) lightboxIndex = 0;
    updateLightbox();
    imageLightbox.classList.add("is-open");
    imageLightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
    imageLightbox.querySelector(".image-lightbox-close")?.focus?.();
  };

  const closeImageLightbox = () => {
    if (!imageLightbox) return;
    imageLightbox.classList.remove("is-open");
    imageLightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
    if (lightboxImage) lightboxImage.src = "";
  };

  const moveImageLightbox = (step) => {
    if (!modalMedia.length) return;
    lightboxIndex = (lightboxIndex + step + modalMedia.length) % modalMedia.length;
    modalIndex = lightboxIndex;
    updateModalGallery();
    updateLightbox();
  };

  const parseTriggerMedia = (trigger) => {
    try {
      const media = JSON.parse(trigger.dataset.media || "[]");
      if (Array.isArray(media)) return media.filter((item) => item?.url);
    } catch (_error) {
      return [];
    }
    return [];
  };

  const openModal = (trigger) => {
    if (!modal) return;
    lastFocusedElement = document.activeElement;
    const listItems = (trigger.dataset.list || "")
      .split("|")
      .filter(Boolean)
      .map((item) => `<li>${escapeHTML(item)}</li>`)
      .join("");

    const title = trigger.dataset.title || "Detail Codexa";
    const type = trigger.dataset.type || "Detail";
    const media = parseTriggerMedia(trigger);

    modalType.textContent = type;
    modalTitle.textContent = title;
    modalSubtitle.textContent = trigger.dataset.subtitle || "";
    modalList.innerHTML = listItems;
    modalNote.textContent = trigger.dataset.note || "";
    setupModalGallery(media);

    if (modalWhatsappBtn) {
      const label = type.toLowerCase().includes("project") ? "project sejenis" : "kebutuhan sejenis";
      modalWhatsappBtn.href = makeWhatsAppLink(`Halo Codexa, saya tertarik bahas ${label}: "${title}".`);
    }

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    modal.querySelector(".modal-close")?.focus();
  };

  const closeModal = () => {
    if (!modal) return;
    closeImageLightbox();
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    lastFocusedElement?.focus?.();
  };

  document.addEventListener("click", (event) => {
    const zoomTrigger = event.target.closest("[data-zoom-index]");
    if (zoomTrigger) {
      event.preventDefault();
      event.stopPropagation();
      const index = Number(zoomTrigger.dataset.zoomIndex || modalIndex || 0);
      openImageLightbox(index);
      return;
    }

    if (event.target.closest("[data-close-lightbox]")) {
      event.preventDefault();
      event.stopPropagation();
      closeImageLightbox();
      return;
    }

    if (event.target.closest("[data-lightbox-prev]")) {
      event.preventDefault();
      event.stopPropagation();
      moveImageLightbox(-1);
      return;
    }

    if (event.target.closest("[data-lightbox-next]")) {
      event.preventDefault();
      event.stopPropagation();
      moveImageLightbox(1);
      return;
    }

    const dot = event.target.closest("[data-modal-dot]");
    if (dot) {
      event.stopPropagation();
      modalIndex = Number(dot.dataset.modalDot || 0);
      updateModalGallery();
      return;
    }

    if (event.target.closest("[data-modal-prev]")) {
      event.stopPropagation();
      moveModalGallery(-1);
      return;
    }

    if (event.target.closest("[data-modal-next]")) {
      event.stopPropagation();
      moveModalGallery(1);
      return;
    }

    const closer = event.target.closest("[data-close-modal]");
    if (closer) closeModal();

    const trigger = event.target.closest(".modal-trigger");
    if (trigger) openModal(trigger);
  });

  modalTrack?.addEventListener("touchstart", (event) => {
    touchStartX = event.touches[0]?.clientX || 0;
  }, { passive: true });

  modalTrack?.addEventListener("touchend", (event) => {
    const endX = event.changedTouches[0]?.clientX || 0;
    const delta = endX - touchStartX;
    if (Math.abs(delta) > 42) moveModalGallery(delta > 0 ? -1 : 1);
  }, { passive: true });

  document.addEventListener("keydown", (event) => {
    if (imageLightbox?.classList.contains("is-open")) {
      if (event.key === "Escape") closeImageLightbox();
      if (event.key === "ArrowLeft") moveImageLightbox(-1);
      if (event.key === "ArrowRight") moveImageLightbox(1);
      return;
    }

    if (event.key === "Escape" && modal?.classList.contains("is-open")) closeModal();
    if (modal?.classList.contains("is-open") && event.key === "ArrowLeft") moveModalGallery(-1);
    if (modal?.classList.contains("is-open") && event.key === "ArrowRight") moveModalGallery(1);
    if ((event.key === "Enter" || event.key === " ") && event.target.classList.contains("modal-trigger")) {
      event.preventDefault();
      openModal(event.target);
    }
  });

  const fetchCategories = async () => {
    if (!supabaseClient) {
      renderFilters([]);
      return;
    }

    try {
      const { data, error } = await supabaseClient
        .from(supabaseConfig.categoryTable || "project_categories")
        .select("name,slug,sort_order,is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      if (Array.isArray(data) && data.length) categories = data;
    } catch (error) {
      console.warn("Kategori dari Supabase belum bisa dimuat. Filter fallback tetap dipakai.", error.message);
    }
  };

  const fetchProjects = async () => {
    if (!projectGrid || !supabaseClient) {
      renderFilters([]);
      bindFilterButtons();
      initCardCarousels();
      return;
    }

    try {
      const { data, error } = await supabaseClient
        .from(supabaseConfig.projectTable || "portfolio_projects")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!Array.isArray(data) || data.length === 0) {
        renderFilters([]);
        bindFilterButtons();
        initCardCarousels();
        return;
      }

      renderFilters(data);
      projectGrid.innerHTML = data.map(renderProjectCard).join("");
      applyProjectFilter();
      observeReveals();
      initCardCarousels();
    } catch (error) {
      console.warn("Project dari Supabase belum bisa dimuat. Fallback static tetap dipakai.", error.message);
      renderFilters([]);
      bindFilterButtons();
      initCardCarousels();
    }
  };

  const saveLeadToSupabase = async (payload) => {
    if (!supabaseClient) return { skipped: true };
    const { error } = await supabaseClient
      .from(supabaseConfig.leadTable || "leads")
      .insert(payload);
    if (error) throw error;
    return { saved: true };
  };

  const briefForm = document.getElementById("briefForm");
  const formStatus = document.getElementById("formStatus");

  briefForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(briefForm);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      project_type: String(formData.get("project_type") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      source: "codexa-portfolio"
    };

    if (!payload.name || !payload.project_type || !payload.message) {
      formStatus.textContent = "Lengkapi brief dulu ya.";
      return;
    }

    const whatsappMessage = `Halo Codexa, saya ${payload.name}. Saya mau konsultasi ${payload.project_type}. Brief singkat: ${payload.message}`;
    formStatus.textContent = "Mengarahkan ke WhatsApp...";

    try {
      await saveLeadToSupabase(payload);
      formStatus.textContent = supabaseClient ? "Brief tersimpan. Membuka WhatsApp..." : "Membuka WhatsApp...";
    } catch (_error) {
      formStatus.textContent = "Supabase belum aktif, tapi WhatsApp tetap dibuka.";
    }

    window.open(makeWhatsAppLink(whatsappMessage), "_blank", "noopener");
    briefForm.reset();
  });

  const init = async () => {
    setWhatsAppLinks();
    observeReveals();
    bindFilterButtons();
    await fetchCategories();
    await fetchProjects();
  };

  init();
})();
