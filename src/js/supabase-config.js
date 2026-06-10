export const CODEXA_SUPABASE = {
  url: import.meta.env.VITE_SUPABASE_URL || "",
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  leadTable: import.meta.env.VITE_SUPABASE_LEAD_TABLE || "leads",
  projectTable: import.meta.env.VITE_SUPABASE_PROJECT_TABLE || "portfolio_projects",
  categoryTable: import.meta.env.VITE_SUPABASE_CATEGORY_TABLE || "project_categories",
  projectBucket: import.meta.env.VITE_SUPABASE_PROJECT_BUCKET || "codexa-projects"
};

export const CODEXA_SITE = {
  whatsappNumber: import.meta.env.VITE_WHATSAPP_NUMBER || "6281234567890"
};
