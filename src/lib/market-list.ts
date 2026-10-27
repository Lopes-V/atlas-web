export function marketPage<T extends { symbol: string; name: string }>(
  assets: readonly T[],
  options: { page?: string | null; pageSize?: string | null; sort?: string | null } = {},
) {
  const pageSize = [10, 25, 50].includes(Number(options.pageSize)) ? Number(options.pageSize) : 10;
  const totalPages = Math.max(1, Math.ceil(assets.length / pageSize));
  const requested = Number(options.page ?? 1);
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, totalPages) : 1;
  const sort = ['symbol-asc', 'symbol-desc', 'name-asc'].includes(options.sort ?? '') ? options.sort! : 'symbol-asc';
  const ordered = [...assets].sort((a, b) => {
    const comparison = sort === 'name-asc' ? a.name.localeCompare(b.name, 'pt-BR') : a.symbol.localeCompare(b.symbol, 'pt-BR');
    return (sort === 'symbol-desc' ? -comparison : comparison) || a.symbol.localeCompare(b.symbol, 'pt-BR');
  });
  const start = (page - 1) * pageSize;
  return { items: ordered.slice(start, start + pageSize), page, pageSize, totalPages, start, sort };
}
