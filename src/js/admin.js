import "../css/style.css";
import "../css/admin.css";
import { createClient } from "@supabase/supabase-js";
import { CODEXA_SUPABASE } from "./supabase-config.js";

(() => {
  const cfg = CODEXA_SUPABASE || {};
  const hasSupabaseConfig = Boolean(cfg.url && cfg.anonKey);
  const supabaseClient = hasSupabaseConfig ? createClient(cfg.url, cfg.anonKey) : null;
  const projectTable = cfg.projectTable || "portfolio_projects";
  let categoryTable = cfg.categoryTable || "project_categories";
  const projectBucket = cfg.projectBucket || "codexa-projects";

  const uniqueItems = (items = []) => [...new Set(items.filter(Boolean))];
  const categoryTableCandidates = () => uniqueItems([categoryTable, "project_categories", "portfolio_categories"]);
  const isMissingTableError = (error = {}) => {
    const message = String(error.message || "").toLowerCase();
    return error.code === "PGRST205" || message.includes("could not find the table") || message.includes("schema cache");
  };

  const defaultCategories = [
    { name: "Website", slug: "website", sort_order: 1, is_active: true },
    { name: "Dashboard", slug: "dashboard", sort_order: 2, is_active: true },
    { name: "UI/UX", slug: "uiux", sort_order: 3, is_active: true }
  ];

  const loginView = document.getElementById("loginView");
  const dashboardView = document.getElementById("dashboardView");
  const setupAlert = document.getElementById("setupAlert");
  const loginForm = document.getElementById("loginForm");
  const loginStatus = document.getElementById("loginStatus");
  const logoutBtn = document.getElementById("logoutBtn");

  const projectForm = document.getElementById("projectForm");
  const projectStatus = document.getElementById("projectStatus");
  const projectList = document.getElementById("adminProjectList");
  const projectImage = document.getElementById("projectImage");
  const projectCategorySelect = document.getElementById("projectCategorySelect");
  const imagePreview = document.getElementById("imagePreview");
  const imagePreviewList = document.getElementById("imagePreviewList");
  const clearImageBtn = document.getElementById("clearImageBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  const editorTitle = document.getElementById("editorTitle");
  const refreshProjectsBtn = document.getElementById("refreshProjectsBtn");
  const totalProjects = document.getElementById("totalProjects");
  const activeProjects = document.getElementById("activeProjects");

  const categoryForm = document.getElementById("categoryForm");
  const categoryList = document.getElementById("categoryList");
  const categoryStatus = document.getElementById("categoryStatus");

  let projects = [];
  let categories = [...defaultCategories];
  let selectedFiles = [];
  let existingMedia = [];
  let previewObjectUrls = [];
  let sessionReady = false;

  const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));

  const slugify = (value = "") => String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " dan ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56) || "kategori";

  const setStatus = (element, message, isError = false) => {
    if (!element) return;
    element.textContent = message;
    element.style.color = isError ? "#ffb4b4" : "";
  };

  const setView = (view) => {
    const loginActive = view === "login";
    if (loginView) {
      loginView.hidden = !loginActive;
      loginView.style.display = loginActive ? "grid" : "none";
    }
    if (dashboardView) {
      dashboardView.hidden = loginActive;
      dashboardView.style.display = loginActive ? "none" : "block";
    }
  };

  const showLogin = () => {
    sessionReady = false;
    setView("login");
  };

  const showDashboard = async () => {
    setView("dashboard");
    if (sessionReady) return;
    sessionReady = true;
    await loadAll();
  };

  const categoryName = (slug = "") => {
    const found = categories.find((item) => item.slug === slug);
    return found?.name || slug || "Project";
  };

  const normalizeMedia = (project = {}) => {
    const rawMedia = Array.isArray(project.media) ? project.media : [];
    const media = rawMedia
      .map((item) => ({
        url: String(item?.url || item?.image_url || "").trim(),
        path: String(item?.path || item?.image_path || "").trim(),
        device: ["desktop", "mobile"].includes(item?.device) ? item.device : (project.display_device || "desktop"),
        name: String(item?.name || "Foto project").trim()
      }))
      .filter((item) => item.url);

    if (!media.length && project.image_url) {
      media.push({
        url: project.image_url,
        path: project.image_path || "",
        device: project.display_device || "desktop",
        name: "Foto utama"
      });
    }

    return media;
  };

  const revokePreviews = () => {
    previewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    previewObjectUrls = [];
  };

  const renderPreview = () => {
    revokePreviews();
    if (!imagePreview || !imagePreviewList) return;
    const pending = selectedFiles.map((file, index) => {
      const objectUrl = URL.createObjectURL(file);
      previewObjectUrls.push(objectUrl);
      const device = projectForm?.elements.display_device?.value || "desktop";
      return {
        type: "pending",
        index,
        url: objectUrl,
        name: file.name,
        device
      };
    });

    const items = [
      ...existingMedia.map((item, index) => ({ ...item, type: "existing", index })),
      ...pending
    ];

    if (!items.length) {
      imagePreview.hidden = true;
      imagePreviewList.innerHTML = "";
      return;
    }

    imagePreview.hidden = false;
    imagePreviewList.innerHTML = items.map((item) => `
      <article class="preview-tile ${item.device === "mobile" ? "is-mobile" : "is-desktop"}">
        <img src="${escapeHTML(item.url)}" alt="${escapeHTML(item.name || "Preview project")}" />
        <div class="preview-meta">
          <span>${item.device === "mobile" ? "Web Mobile" : "Web Desktop"}</span>
          <button type="button" class="mini-btn danger" data-preview-action="${item.type === "existing" ? "remove-existing" : "remove-pending"}" data-index="${item.index}">Hapus</button>
        </div>
      </article>
    `).join("");
  };

  const resetPreview = () => {
    revokePreviews();
    selectedFiles = [];
    existingMedia = [];
    if (projectImage) projectImage.value = "";
    if (imagePreviewList) imagePreviewList.innerHTML = "";
    if (imagePreview) imagePreview.hidden = true;
  };

  const resetForm = () => {
    projectForm?.reset();
    if (!projectForm) return;
    projectForm.elements.id.value = "";
    projectForm.elements.image_url.value = "";
    projectForm.elements.image_path.value = "";
    projectForm.elements.sort_order.value = "1";
    projectForm.elements.display_device.value = "desktop";
    projectForm.elements.is_active.checked = true;
    resetPreview();
    cancelEditBtn.hidden = true;
    editorTitle.textContent = "Tambah project baru";
    setStatus(projectStatus, "");
  };

  const safeFileName = (name = "project") => name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 80) || "project";

  const uploadImages = async (files, device) => {
    if (!files.length) return [];
    const uploaded = [];

    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const path = `projects/${Date.now()}-${id}-${safeFileName(file.name || `project.${ext}`)}`;

      const { error } = await supabaseClient.storage
        .from(projectBucket)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false
        });

      if (error) throw error;

      const { data } = supabaseClient.storage.from(projectBucket).getPublicUrl(path);
      uploaded.push({
        url: data.publicUrl,
        path,
        device,
        name: file.name
      });
    }

    return uploaded;
  };

  const removeStorageObjects = async (paths = []) => {
    const cleanPaths = paths.filter(Boolean);
    if (!cleanPaths.length) return;
    await supabaseClient.storage.from(projectBucket).remove(cleanPaths);
  };

  const parseFeatures = (value = "") => String(value)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  const populateCategorySelect = (selected = "") => {
    if (!projectCategorySelect) return;
    const activeCategories = categories.filter((item) => item.is_active !== false);
    const source = activeCategories.length ? activeCategories : defaultCategories;

    projectCategorySelect.innerHTML = source.map((item) => `
      <option value="${escapeHTML(item.slug)}">${escapeHTML(item.name)}</option>
    `).join("");

    if (selected && [...projectCategorySelect.options].some((option) => option.value === selected)) {
      projectCategorySelect.value = selected;
    }
  };

  const renderCategories = () => {
    populateCategorySelect(projectForm?.elements.category?.value || "");
    if (!categoryList) return;

    if (!categories.length) {
      categoryList.innerHTML = `<div class="empty-row">Belum ada kategori.</div>`;
      return;
    }

    categoryList.innerHTML = categories.map((category) => `
      <article class="category-item">
        <div>
          <strong>${escapeHTML(category.name)}</strong>
          <span>${escapeHTML(category.slug)}</span>
        </div>
        <button type="button" class="mini-btn danger" data-category-action="delete" data-slug="${escapeHTML(category.slug)}">Hapus</button>
      </article>
    `).join("");
  };

  const renderList = () => {
    if (!projectList) return;

    totalProjects.textContent = String(projects.length);
    activeProjects.textContent = String(projects.filter((project) => project.is_active).length);

    if (!projects.length) {
      projectList.innerHTML = `<div class="empty-row">Belum ada project. Tambahkan LuxeStay, Dabsen, atau project lain dari form sebelah.</div>`;
      return;
    }

    projectList.innerHTML = projects.map((project) => {
      const media = normalizeMedia(project);
      const thumb = media[0]?.url || "";
      const device = project.display_device || media[0]?.device || "desktop";

      return `
        <article class="admin-project-item" data-id="${escapeHTML(project.id)}">
          <div class="admin-project-thumb ${device === "mobile" ? "is-mobile" : "is-desktop"}">
            ${thumb ? `<img src="${escapeHTML(thumb)}" alt="Preview ${escapeHTML(project.title)}">` : `<span>No image</span>`}
          </div>
          <div class="admin-project-content">
            <h3>${escapeHTML(project.title)}</h3>
            <p>${escapeHTML(project.short_description || project.subtitle || "Belum ada deskripsi.")}</p>
            <div class="admin-item-meta">
              <span>${escapeHTML(categoryName(project.category || "website"))}</span>
              <span>${device === "mobile" ? "Web Mobile" : "Web Desktop"}</span>
              <span>${media.length} Foto</span>
              <span>Urutan ${Number(project.sort_order || 0)}</span>
              <span class="${project.is_active ? "active" : ""}">${project.is_active ? "Tampil" : "Draft"}</span>
            </div>
            <div class="admin-card-actions">
              <button class="mini-btn" type="button" data-action="edit" data-id="${escapeHTML(project.id)}">Edit</button>
              <button class="mini-btn danger" type="button" data-action="delete" data-id="${escapeHTML(project.id)}">Hapus</button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  };

  const loadCategories = async () => {
    if (!supabaseClient) {
      categories = [...defaultCategories];
      renderCategories();
      return;
    }

    let lastError = null;
    for (const tableName of categoryTableCandidates()) {
      try {
        const { data, error } = await supabaseClient
          .from(tableName)
          .select("id,name,slug,sort_order,is_active,created_at")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });

        if (error) throw error;
        categoryTable = tableName;
        categories = Array.isArray(data) && data.length ? data : [...defaultCategories];
        renderCategories();
        setStatus(categoryStatus, "");
        return;
      } catch (error) {
        lastError = error;
        if (!isMissingTableError(error)) break;
      }
    }

    categories = [...defaultCategories];
    renderCategories();
    setStatus(categoryStatus, `Kategori belum bisa dimuat: ${lastError?.message || "table kategori belum tersedia"}`, true);
  };

  const insertCategory = async (payload) => {
    let lastError = null;
    for (const tableName of categoryTableCandidates()) {
      const { error } = await supabaseClient.from(tableName).insert(payload);
      if (!error) {
        categoryTable = tableName;
        return;
      }
      lastError = error;
      if (!isMissingTableError(error)) break;
    }
    throw lastError || new Error("Table kategori belum tersedia.");
  };

  const removeCategory = async (slug) => {
    let lastError = null;
    for (const tableName of categoryTableCandidates()) {
      const { error } = await supabaseClient.from(tableName).delete().eq("slug", slug);
      if (!error) {
        categoryTable = tableName;
        return;
      }
      lastError = error;
      if (!isMissingTableError(error)) break;
    }
    throw lastError || new Error("Table kategori belum tersedia.");
  };

  const loadProjects = async () => {
    if (!supabaseClient) return;
    projectList.innerHTML = `<div class="loading-row">Memuat data...</div>`;

    try {
      const { data, error } = await supabaseClient
        .from(projectTable)
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      projects = Array.isArray(data) ? data : [];
      renderList();
    } catch (error) {
      projectList.innerHTML = `<div class="empty-row">Gagal memuat project: ${escapeHTML(error.message)}</div>`;
    }
  };

  const loadAll = async () => {
    await loadCategories();
    await loadProjects();
  };

  const getFormPayload = (media) => {
    const formData = new FormData(projectForm);
    const primaryMedia = media[0] || null;
    return {
      title: String(formData.get("title") || "").trim(),
      category: String(formData.get("category") || "website"),
      short_description: String(formData.get("short_description") || "").trim(),
      subtitle: String(formData.get("subtitle") || "").trim(),
      features: parseFeatures(formData.get("features") || ""),
      note: String(formData.get("note") || "").trim(),
      sort_order: Number(formData.get("sort_order") || 0),
      display_device: String(formData.get("display_device") || "desktop"),
      is_active: Boolean(formData.get("is_active")),
      media,
      image_url: primaryMedia?.url || null,
      image_path: primaryMedia?.path || null
    };
  };

  const fillForm = (project) => {
    resetPreview();
    const media = normalizeMedia(project);
    existingMedia = media;
    projectForm.elements.id.value = project.id || "";
    projectForm.elements.title.value = project.title || "";
    populateCategorySelect(project.category || "website");
    projectForm.elements.short_description.value = project.short_description || "";
    projectForm.elements.subtitle.value = project.subtitle || "";
    projectForm.elements.features.value = Array.isArray(project.features) ? project.features.join("\n") : "";
    projectForm.elements.note.value = project.note || "";
    projectForm.elements.sort_order.value = Number(project.sort_order || 0);
    projectForm.elements.display_device.value = ["desktop", "mobile"].includes(project.display_device) ? project.display_device : "desktop";
    projectForm.elements.is_active.checked = Boolean(project.is_active);
    projectForm.elements.image_url.value = project.image_url || "";
    projectForm.elements.image_path.value = project.image_path || "";
    renderPreview();
    cancelEditBtn.hidden = false;
    editorTitle.textContent = "Edit project";
    setStatus(projectStatus, "Mode edit aktif. Tambahkan foto baru atau hapus foto yang tidak dipakai.");
    document.querySelector(".editor-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const deleteProject = async (projectId) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    const ok = confirm(`Hapus project "${project.title}"?`);
    if (!ok) return;

    try {
      const media = normalizeMedia(project);
      const { error } = await supabaseClient.from(projectTable).delete().eq("id", projectId);
      if (error) throw error;
      await removeStorageObjects(media.map((item) => item.path));
      setStatus(projectStatus, "Project berhasil dihapus.");
      await loadProjects();
    } catch (error) {
      setStatus(projectStatus, `Gagal hapus project: ${error.message}`, true);
    }
  };

  const deleteCategory = async (slug) => {
    if (["website", "dashboard", "uiux"].includes(slug)) {
      setStatus(categoryStatus, "Kategori bawaan sebaiknya jangan dihapus.", true);
      return;
    }

    const ok = confirm(`Hapus kategori "${slug}"? Project yang memakai kategori ini tidak ikut terhapus.`);
    if (!ok) return;

    try {
      await removeCategory(slug);
      setStatus(categoryStatus, "Kategori berhasil dihapus.");
      await loadCategories();
    } catch (error) {
      setStatus(categoryStatus, `Gagal hapus kategori: ${error.message}`, true);
    }
  };

  projectImage?.addEventListener("change", () => {
    revokePreviews();
    const incomingFiles = Array.from(projectImage.files || []);
    const allowed = ["image/png", "image/jpeg", "image/webp"];

    for (const file of incomingFiles) {
      if (!allowed.includes(file.type)) {
        setStatus(projectStatus, "Format gambar harus PNG, JPG, atau WEBP.", true);
        projectImage.value = "";
        renderPreview();
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setStatus(projectStatus, `Ukuran ${file.name} lebih dari 5MB.`, true);
        projectImage.value = "";
        renderPreview();
        return;
      }
    }

    const fileMap = new Map(selectedFiles.map((file) => [`${file.name}-${file.size}-${file.lastModified}`, file]));
    incomingFiles.forEach((file) => fileMap.set(`${file.name}-${file.size}-${file.lastModified}`, file));
    selectedFiles = Array.from(fileMap.values());

    const dt = new DataTransfer();
    selectedFiles.forEach((file) => dt.items.add(file));
    projectImage.files = dt.files;

    renderPreview();
    setStatus(projectStatus, selectedFiles.length ? `${selectedFiles.length} foto siap diupload saat project disimpan. Kamu bisa pilih file lagi kalau mau menambah foto lain.` : "");
  });

  projectForm?.elements.display_device?.addEventListener("change", renderPreview);

  imagePreviewList?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-preview-action]");
    if (!button) return;
    const index = Number(button.dataset.index);

    if (button.dataset.previewAction === "remove-existing") {
      existingMedia.splice(index, 1);
    }

    if (button.dataset.previewAction === "remove-pending") {
      selectedFiles.splice(index, 1);
      const dt = new DataTransfer();
      selectedFiles.forEach((file) => dt.items.add(file));
      projectImage.files = dt.files;
    }

    revokePreviews();
    renderPreview();
  });

  clearImageBtn?.addEventListener("click", () => {
    resetPreview();
    projectForm.elements.image_url.value = "";
    projectForm.elements.image_path.value = "";
    setStatus(projectStatus, "Semua foto di form sudah dikosongkan. Simpan project untuk menerapkan perubahan.");
  });

  cancelEditBtn?.addEventListener("click", resetForm);
  refreshProjectsBtn?.addEventListener("click", loadAll);

  projectList?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const projectId = button.dataset.id;
    const action = button.dataset.action;
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;

    if (action === "edit") fillForm(project);
    if (action === "delete") deleteProject(projectId);
  });

  categoryList?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category-action]");
    if (!button) return;
    if (button.dataset.categoryAction === "delete") deleteCategory(button.dataset.slug);
  });

  categoryForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabaseClient) return;

    const formData = new FormData(categoryForm);
    const name = String(formData.get("name") || "").trim();
    const slug = slugify(formData.get("slug") || name);
    const sortOrder = Number(formData.get("sort_order") || categories.length + 1);

    if (!name) {
      setStatus(categoryStatus, "Nama kategori wajib diisi.", true);
      return;
    }

    try {
      setStatus(categoryStatus, "Menyimpan kategori...");
      await insertCategory({ name, slug, sort_order: sortOrder, is_active: true });
      categoryForm.reset();
      categoryForm.elements.sort_order.value = String(categories.length + 1);
      setStatus(categoryStatus, "Kategori berhasil ditambahkan dan sudah masuk ke pilihan project.");
      await loadCategories();
    } catch (error) {
      setStatus(categoryStatus, `Gagal tambah kategori: ${error.message}`, true);
    }
  });

  projectForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabaseClient) return;

    const editingId = projectForm.elements.id.value;
    const oldProject = editingId ? projects.find((item) => item.id === editingId) : null;
    const oldMedia = normalizeMedia(oldProject || {});
    const device = projectForm.elements.display_device.value || "desktop";

    try {
      const basePayload = getFormPayload(existingMedia);
      if (!basePayload.title || !basePayload.short_description || !basePayload.subtitle) {
        setStatus(projectStatus, "Nama project, deskripsi singkat, dan detail popup wajib diisi.", true);
        return;
      }

      setStatus(projectStatus, selectedFiles.length ? `Mengupload ${selectedFiles.length} foto...` : "Menyimpan project...");
      const uploadedMedia = await uploadImages(selectedFiles, device);
      const media = [...existingMedia, ...uploadedMedia].map((item) => ({
        url: item.url,
        path: item.path || "",
        device: ["desktop", "mobile"].includes(item.device) ? item.device : device,
        name: item.name || "Foto project"
      }));

      const payload = getFormPayload(media);
      const removedPaths = oldMedia
        .filter((oldItem) => oldItem.path && !media.some((newItem) => newItem.path === oldItem.path))
        .map((item) => item.path);

      if (editingId) {
        const { error } = await supabaseClient.from(projectTable).update(payload).eq("id", editingId);
        if (error) throw error;
        await removeStorageObjects(removedPaths);
        setStatus(projectStatus, "Project berhasil diperbarui.");
      } else {
        const { error } = await supabaseClient.from(projectTable).insert(payload);
        if (error) throw error;
        setStatus(projectStatus, "Project baru berhasil ditambahkan.");
      }

      resetForm();
      await loadProjects();
    } catch (error) {
      setStatus(projectStatus, `Gagal menyimpan: ${error.message}`, true);
    }
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabaseClient) return;

    const formData = new FormData(loginForm);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    setStatus(loginStatus, "Memeriksa akun...");
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus(loginStatus, `Login gagal: ${error.message}`, true);
      return;
    }

    loginForm.reset();
    setStatus(loginStatus, "");
    await showDashboard();
  });

  logoutBtn?.addEventListener("click", async () => {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    projects = [];
    sessionReady = false;
    resetForm();
    showLogin();
    setStatus(loginStatus, "Kamu sudah logout.");
  });

  const init = async () => {
    if (!hasSupabaseConfig) {
      setupAlert.hidden = false;
      loginForm?.querySelectorAll("input, button").forEach((el) => { el.disabled = true; });
      setStatus(loginStatus, "Isi konfigurasi Supabase dulu supaya dashboard aktif.", true);
      showLogin();
      renderCategories();
      return;
    }

    setView("login");
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) await showDashboard();
    else showLogin();

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      if (session) await showDashboard();
      else showLogin();
    });
  };

  init();
})();
