# Atlas Web

Frontend pessoal para o [Investment Bot](https://github.com/Lopes-V/mercado_invest), desenvolvido com Next.js App Router, React e TypeScript.

O visual segue o `DESIGN.md` já fornecido neste repositório: análise NerdWallet do [getdesign.md](https://getdesign.md/), com verde profundo, superfícies mint, bordas discretas e Montserrat local como substituta de Gotham. O arquivo original foi preservado.

## Executar

Requer Node.js 22.9+ e npm.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Abra **http://127.0.0.1:3001**. Sem configuração, o painel apresenta estados vazios e orienta a conexão, sem dados financeiros fictícios.

Para consultar seus dados, preencha `.env.local`:

| Variável | Uso |
| --- | --- |
| `SUPABASE_URL` | URL HTTPS do mesmo projeto usado pelo backend |
| `SUPABASE_SECRET_KEY` | Chave secret/service_role, exclusivamente no servidor |
| `ATLAS_ACCESS_PASSWORD` | Senha pessoal exclusiva com pelo menos 12 caracteres |
| `ATLAS_SESSION_SECRET` | Segredo aleatório com pelo menos 32 caracteres |
| `ATLAS_QUOTE_MAX_AGE_SECONDS` | Limite de idade das cotações; padrão 345600, alinhado à referência do backend |

Gere o segredo de sessão localmente:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Reinicie o servidor após editar o ambiente. Não utilize `NEXT_PUBLIC_` para essas variáveis e não versione `.env.local`.

## Integração

O backend é composto por jobs, serviços de domínio e Telegram; não oferece API HTTP de aplicação. O Atlas consulta a API REST do Supabase **apenas no servidor**, depois de autenticar o operador. As migrations existentes permitem leitura somente a `service_role`; nenhuma permissão, migration ou arquivo do backend foi alterado.

As consultas utilizam as tabelas reais: `assets`, `markets`, `currencies`, `market_quotes`, `market_candles`, `portfolios`, `portfolio_snapshots`, `portfolio_transactions`, `opportunities`, `ai_runs`, `alerts`, `job_runs`, `fixed_income_instruments` e `fixed_income_snapshots`. Os valores `numeric` são solicitados como texto (`::text`) e validados com Zod; cálculos usam Decimal.js. Timeout de 10 segundos por consulta; falhas ficam visíveis por seção. A chave secret moderna (`sb_secret_`) usa `apikey`; chaves legadas usam também Bearer.

O Atlas faz somente leituras. Operações, coletas, análises, alertas, políticas e execução de ordens continuam no backend. Este frontend não chama Gemini nem gera novas recomendações.

## Telas e recursos

- Visão geral com patrimônio da carteira selecionada, histórico, ativos e radar de sinais.
- Mercados com busca, filtros de mercado/tipo, favoritos, qualidade e horário de cada cotação, exportação CSV e detalhe com fechamentos diários de uma única fonte.
- Carteiras com seleção individual, moeda base, snapshots, resultado não realizado e até 30 movimentações recentes.
- Oportunidades com score persistido, política, evidências e interpretação/risco de IA quando associados ao registro.
- Alertas com filtro de status; renda fixa com referências de preço/taxa; monitoramento de execuções.
- Favoritos e ocultação de valores persistidos apenas neste navegador; filtros no endereço; navegação móvel e dados do gráfico acessíveis como tabela.

Não há cotações inventadas, conversão de moedas ou soma de carteiras. Preços inválidos são ocultados; antigos são identificados. A variação de preço compara duas coletas reais da mesma fonte e moeda, e não é chamada de variação diária. O gráfico de patrimônio inclui aportes/retiradas e não representa rentabilidade ajustada a fluxos. Snapshots e taxas refletem os registros do backend, com limites de leitura informados na interface.

## Acesso e produção

Acesso pessoal por senha, cookie HttpOnly/SameSite, sessão HMAC com duração de 8 horas e invalidação ao trocar senha/segredo. Em produção o cookie exige HTTPS. Sem senha e segredo válidos, o Atlas não lê o banco. Tentativas de login têm uma janela limitada por processo; para várias instâncias públicas, utilize identidade gerenciada e limitação distribuída. A aplicação não possui recuperação de senha por e-mail; altere o valor no servidor.

```powershell
npm run build
npm start
```

`npm start` escuta somente em `127.0.0.1:3001`. Em hospedagem, execute `npx next start --hostname 0.0.0.0 --port 3001` atrás de HTTPS e configure as variáveis no servidor. Nenhum deploy é necessário para uso local.

## Verificação

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright inicia duas instâncias da build de produção nas portas 3101/3102: uma sem configuração e outra com fixtures interceptadas pelo preload **exclusivo do processo de teste** `tests/mock-supabase.cjs`. Não existe modo de demonstração no código de produção. Os testes cobrem autenticação, sessão adulterada, logout, filtros, qualidade, CSV, moedas separadas, privacidade persistida, falha isolada e layout móvel. Capturas ficam em `artifacts/` e não são versionadas.

Esses testes não validam a conexão com seu Supabase real. Essa verificação depende das credenciais do seu ambiente e de dados existentes.
