const LIGHT_SLICE = ['#2563EB', '#10B981', '#F59E0B', '#0EA5E9', '#1E40AF', '#059669', '#DC2626', '#0284C7'];
const DARK_SLICE = ['#60a5fa', '#34d399', '#fbbf24', '#38bdf8', '#93c5fd', '#6ee7b7', '#f87171', '#7dd3fc'];

export function getCategorySliceColor(index, isDarkMode) {
  const palette = isDarkMode ? DARK_SLICE : LIGHT_SLICE;
  return palette[((index % palette.length) + palette.length) % palette.length];
}

export function getCategorySliceColorForId(categoryId, isDarkMode = false) {
  const raw = String(categoryId);
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash + raw.charCodeAt(i) * (i + 1)) % 9973;
  }
  return getCategorySliceColor(hash, isDarkMode);
}
