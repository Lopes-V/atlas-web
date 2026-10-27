import { notFound, redirect } from 'next/navigation';
import { Atlas } from '@/components/atlas';
import { authConfigured, isAuthenticated } from '@/lib/auth';
import { getDashboard, getCandles, databaseConfigured } from '@/lib/data';

export const dynamic = 'force-dynamic';
const routes = ['', 'cripto', 'mercados', 'carteira', 'oportunidades', 'alertas', 'renda-fixa', 'sistema', 'configuracoes'];
export default async function WorkspacePage({ params, searchParams }: { params: Promise<{ section?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ section = [] }, search] = await Promise.all([params, searchParams]);
  const route = section.join('/');
  if (!routes.includes(route)) notFound();
  if (authConfigured() && !await isAuthenticated()) redirect('/login');
  const data = await getDashboard();
  const assetId = typeof search.ativo === 'string' ? search.ativo : '';
  const asset = data.assets.data.find(row => row.id === assetId);
  const history = asset ? await getCandles(asset.id, asset.quotes[0]?.provider) : { data: [], error: null, limit: 366 };
  return <Atlas data={data} route={route} history={history} configuration={{ database: databaseConfigured(), access: authConfigured() }}/>;
}
