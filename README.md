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
| `ATLAS_ACCESS_PASSWORD` | Senha pessoal exclusiva com pelo menos 4 caracteres |
| `ATLAS_SESSION_SECRET` | Segredo aleatório com pelo menos 32 caracteres |
| `ATLAS_QUOTE_MAX_AGE_SECONDS` | Limite de idade das cotações; padrão 345600, alinhado à referência do backend |

Gere o segredo de sessão localmente:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Reinicie o servidor após editar o ambiente. Não utilize `NEXT_PUBLIC_` para essas variáveis e não versione `.env.local`.

## Integração

O backend é composto por jobs, serviços de domínio e Telegram; não oferece API HTTP de aplicação. O Atlas consulta a API REST do Supabase **apenas no servidor**, depois de autenticar o operador. As migrations existentes permitem leitura somente a `service_role`; nenhuma permissão, migration ou arquivo do backend foi alterado.

As consultas utilizam as tabelas reais: `assets`, `markets`, `exchanges`, `currencies`, `market_quotes`, `market_candles`, `analyses`, `analysis_metrics`, `portfolios`, `portfolio_snapshots`, `portfolio_transactions`, `opportunities`, `ai_runs`, `alerts`, `job_runs`, `fixed_income_instruments` e `fixed_income_snapshots`. Os valores `numeric` são solicitados como texto (`::text`) e validados com Zod; cálculos usam Decimal.js. A formatação monetária passa texto decimal diretamente ao Intl, preservando os centavos de valores grandes sem conversão para ponto flutuante. Timeout de 10 segundos por consulta; falhas ficam visíveis por seção. A chave secret moderna (`sb_secret_`) usa `apikey`; chaves legadas usam também Bearer.

O Atlas faz somente leituras. Operações, coletas, análises, alertas, políticas e execução de ordens continuam no backend. Este frontend não chama Gemini nem gera novas recomendações.

## Telas e recursos

- Visão geral com patrimônio da carteira selecionada, histórico, ativos e radar de sinais.
- Mercados com busca, filtros de mercado/tipo, ordenação por ativo ou empresa, paginação de 10/25/50 registros, favoritos, qualidade e horário de cada cotação, exportação CSV e detalhe com fechamentos diários de uma única fonte.
- Cripto em `/cripto`, com os pares spot BTCUSDT, ETHUSDT e SOLUSDT da Bybit, cotações em USDT e análises `analysis-v2` independentes de 15m/1h.
- Carteiras com seleção individual, moeda base, snapshots, resultado não realizado e até 30 movimentações recentes.
- Oportunidades com score persistido, política, evidências e interpretação/risco de IA quando associados ao registro.
- Alertas com filtro de status; renda fixa com referências de preço/taxa; monitoramento de execuções.
- Favoritos e ocultação de valores persistidos apenas neste navegador; filtros no endereço; navegação móvel e dados do gráfico acessíveis como tabela.

Não há cotações inventadas, conversão de moedas ou soma de carteiras. Preços inválidos são ocultados; antigos são identificados. A variação de preço compara duas coletas reais da mesma fonte e moeda, e não é chamada de variação diária. O gráfico de patrimônio inclui aportes/retiradas e não representa rentabilidade ajustada a fluxos. Snapshots e taxas refletem os registros do backend, com limites de leitura informados na interface.

## Radar cripto

Cripto fica fora da consulta geral de Mercados e da faixa de cotações, cujas regras são voltadas aos demais ativos. A seção Cripto lê o catálogo Bybit e os indicadores já persistidos pelo backend, somente no servidor autenticado. Não chama a Bybit nem recalcula indicadores técnicos no navegador. Cada intervalo busca seu último registro por `reference_at` com um limite independente, para que atualizações frequentes de 15m não ocultem a análise de 1h.

Uma cotação precisa ter qualidade `VALID`, fonte `bybit`, moeda USDT, preço positivo e idade de até 120 segundos; horários futuros são recusados. A análise precisa usar `analysis-v2`, conter os indicadores essenciais, referenciar um candle já fechado e ter início com idade de até `2 × intervalo + 120 segundos`. Registros calculados no futuro ou antes do fechamento também ficam indisponíveis. Uma cotação indisponível também oculta os indicadores daquele par, mesmo quando a análise persistida é recente. O frontend apenas traduz `TREND_DIRECTION` em ALTA/BAIXA/MISTA e formata os números, inclusive razões como percentuais. Volume ausente aparece como `—`.

A ocultação de valores cobre cotação, fechamento, EMAs, ATR e quantidades de volume. Custos e spread aparecem como indisponíveis porque não têm persistência nesta entrega. Os horários exibidos são de Brasília; a leitura reflete a última atualização do painel. Um relógio a cada 15 segundos reavalia a validade usando o horário do servidor mais o tempo monotônico decorrido no navegador, retirando cotações e tendências vencidas sem precisar atualizar a página. Dados que chegaram com horários futuros continuam indisponíveis até uma nova consulta. A seção não oferece ordens, promessa de retorno ou recomendação de compra. O coletor e sua recorrência são publicados e verificados separadamente do frontend.

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

Playwright inicia duas instâncias da build de produção nas portas 3101/3102: uma sem configuração e outra com fixtures interceptadas pelo preload **exclusivo do processo de teste** `tests/mock-supabase.cjs`. Não existe modo de demonstração no código de produção. Os testes cobrem autenticação, sessão adulterada, logout, filtros, qualidade, CSV, moedas separadas, privacidade persistida, falha isolada, Cripto com janelas independentes, dados antigos/futuros/incompletos e layout móvel. Capturas ficam em `artifacts/` e não são versionadas.

Esses testes não validam a conexão com seu Supabase real. Essa verificação depende das credenciais do seu ambiente e de dados existentes.

## Ambiente na nuvem

```bash
cd /workspace/atlas-web
npm ci --cache /workspace/.npm-cache
npm run dev
```

O `DESIGN.md` existente foi preservado. Os filtros, a ordenação e a página ficam no endereço; alterar um filtro retorna à primeira página. A paginação organiza os ativos carregados (até 200 por consulta); não busca páginas adicionais do banco. O CSV inclui todos os ativos filtrados dessa consulta, mesmo quando há várias páginas na tela.

Se o ambiente já tiver Chromium, os testes podem usá-lo sem baixar outro navegador:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Sem essa variável, o Playwright utiliza o navegador instalado por `npx playwright install chromium`. As variáveis privadas podem ser injetadas pelas configurações seguras do ambiente, sem criar `.env.local`. GitHub conectado não disponibiliza automaticamente os secrets dos workflows ao processo local.

No runtime de nuvem com Node.js 24, execute `NODE_USE_ENV_PROXY=1 npm run dev` para usar o proxy herdado também nas consultas do servidor. As credenciais e o acesso pessoal podem estar em `.env.local` ignorado pelo Git; preserve esse arquivo e não copie seus valores para documentação ou commits.

## Publicação na Vercel

A raiz do projeto na Vercel é este repositório (`atlas-web`), com framework Next.js. `vercel.json` define instalação com `npm ci` e build com `npm run build`. Os arquivos de ambiente são excluídos do upload por `.vercelignore`; as variáveis privadas devem ser cadastradas em Production nas configurações do projeto Vercel.

Variáveis exigidas: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ATLAS_ACCESS_PASSWORD` e `ATLAS_SESSION_SECRET`. Use os valores locais existentes sem imprimir ou versionar os segredos. Nenhuma variável precisa de prefixo `NEXT_PUBLIC_`. O cookie de autenticação usa Secure em produção e o painel deve ser acessado por HTTPS.

Para publicar pelo agente, a sessão precisa de autenticação Vercel (token `VERCEL_TOKEN` nas configurações seguras do ambiente) e acesso a `api.vercel.com` e `vercel.com`. O token de deploy pertence à Vercel; ele não é a chave do Supabase. Depois de autenticar, vincule/crie o projeto, envie as quatro variáveis ao ambiente Production pelo canal seguro de entrada da CLI e execute `vercel deploy --prod`. Nunca forneça valores secretos como literais em comandos/documentação nem envie `.env.local` como arquivo público.

Após o deploy, valide na URL retornada pela Vercel: redirecionamento sem sessão para login, login com cookie Secure, consulta real dos ativos e ausência de erros nas seções. A validação local não comprova publicação.

URL de produção publicada: https://atlas-web-azure-two.vercel.app . Use a senha pessoal `ATLAS_ACCESS_PASSWORD` configurada no servidor; a cópia local fica em `.env.local` ignorado pelo Git. O deployment foi confirmado como READY na Vercel. O login e a consulta autenticada de ativos reais foram validados por HTTPS em produção após a atualização da senha pessoal.
