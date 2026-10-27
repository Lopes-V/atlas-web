# Atlas Web

## Direção e escopo
Painel pessoal de consulta para o backend Lopes-V/mercado_invest. Implementação autorizada pelo pedido de criação do frontend. O DESIGN.md existente, baseado na análise NerdWallet do getdesign.md, permanece preservado como fonte visual.

Next.js App Router e TypeScript permitem manter a chave Supabase apenas no servidor, respeitando o schema atual, que revoga acesso de anon e authenticated. Uma SPA exigiria criar e manter uma API Python ou alterar permissões de banco. A decisão de implementação é Next.js e acesso pessoal por senha, com sessão assinada; não há operações de escrita no banco.

## Design
Montserrat local substitui Gotham, conforme o próprio DESIGN.md. Verde #008254, forest #00482f, mint #effcf8, lime #e8fdac e canvas branco. Navegação lateral clara, faixa verde editorial na visão geral, tabelas sem divisórias verticais, botões de 2 px e painéis de 8 px. Sem sombras nos cartões. Navegação recolhível no celular; foco visível e movimento reduzido.

## Entregas
- [x] Estrutura Next, dependências fixadas no lockfile e documentação de execução.
- [x] Contratos validados com Zod, leitura PostgREST com timeout, erros por seção e sem dados financeiros fictícios.
- [x] Sessão assinada, proteção de dados e login pessoal; sem acesso ao banco antes de autenticar.
- [x] Visão geral, mercados com busca e filtro, detalhes e histórico por ativo, carteira com seleção, oportunidades, alertas, renda fixa e monitoramento.
- [x] Favoritos e ocultação de valores locais, filtros por URL, atualização manual e exportação CSV.
- [x] Testes de integridade financeira, autenticação e navegador, lint, tipos e build.

## Integridade dos dados
Não inventar cotações, percentuais ou séries. Mostrar timestamp e qualidade, sinalizar dados antigos, calcular diferenças apenas entre registros reais da mesma fonte, usar Decimal para aritmética. Carteiras e moedas não são somadas entre si. Análises e sinais são registros do backend, nunca recomendações geradas no frontend. Paginação e limites de consulta aparecem na interface.

## Validação
Testes unitários para seleção do registro mais recente, qualidade/antiguidade, precisão, CSV e sessão. Playwright para rotas, filtros, responsividade, navegação por teclado, falha de conexão e proteção dos dados. Sem credenciais locais, validação live depende da configuração de .env.local; fixtures só nos testes.

## Continuação — 2026-10-26

- A cópia inicial continha somente LICENSE. Atualizada por fast-forward para o frontend já iniciado em `origin/main` (1a15be2); implementação e DESIGN.md preservados.
- Corrigido lockfile inconsistente que impedia `npm ci` com npm 11; instalação limpa repetível.
- Continuação da listagem: ordenação alfabética e paginação 10/25/50, filtros persistidos em URL, reset de página ao filtrar e CSV de todos os resultados filtrados da consulta. Limite remoto de 200 permanece explícito.
- Corrigido overflow móvel: `.table-scroll` contém agora os rótulos `.sr-only` posicionados absolutamente, evitando que sua posição gere largura adicional no documento.
- Chromium de sistema opcional por `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; não altera o comportamento padrão do Playwright.
- Validação real do Supabase permanece pendente: nenhuma conexão Supabase ou variável privada foi disponibilizada à sessão. Fixtures só nos testes, nenhum dado demonstrativo inserido na aplicação.

Validação desta continuação: `npm ci` repetido com sucesso; lint, typecheck e build aprovados; 10 testes unitários e 8 testes Playwright aprovados com Chromium do sistema. A suíte verificou CSV completo na segunda página e responsividade com registros. Revisão independente sem achados bloqueantes. Acesso HTTP local confirmou o painel de configuração sem credenciais; Supabase live não validado.

## Revisão de precisão monetária

O teste de regressão reproduziu a perda de precisão: `12345678901234567890.12` aparecia como `12.345.678.901.234.567.000,00` após conversão para Number. A formatação agora entrega texto decimal ao Intl, preservando `12.345.678.901.234.567.890,12`. Cobertura para BRL, USD negativo, centavos, arredondamento e ausência de valores; fixture de alta precisão restrita ao processo de testes do navegador.

As consultas foram conferidas contra os nomes de campos e relacionamentos das migrations locais do backend. A confirmação remota ainda exige credenciais reais: runtime e bindings foram verificados novamente, sem URL, chave ou conector Supabase disponível. Não houve mudança de schema nem escrita no banco.

Validação da revisão monetária: 12 testes unitários e 9 testes de navegador aprovados; lint, build, typecheck e checagem HTTP local aprovados.

## Conexão Supabase validada

Com autorização do usuário, a URL e a chave de servidor foram configuradas exclusivamente no arquivo local ignorado `.env.local` (permissões 0600). Senha pessoal e segredo de sessão foram gerados localmente sem valores na documentação ou no Git.

As sete consultas reais retornaram HTTP 200. Login e renderização foram verificados no navegador para visão geral, mercados, carteira, oportunidades, alertas, renda fixa, sistema e detalhe de um ativo, sem erros de seção. Carteira e renda fixa estavam sem registros no momento da consulta. O navegador não fez chamadas diretas ao Supabase; a chave não apareceu no HTML nem nos bundles públicos. Nenhuma escrita ou migration foi executada.

No runtime de nuvem com Node 24, iniciar com `NODE_USE_ENV_PROXY=1 npm run dev` preserva a rota de rede e a autenticação fornecidas pelo ambiente. Esses resultados descrevem a instância atual; publicação e restauração futura não foram validadas.

## Preparação de publicação na Vercel

Build de produção, lint e 12 testes unitários aprovados após configuração do Supabase. Adicionados `vercel.json` com detecção Next.js/instalação congelada e `.vercelignore` para excluir credenciais locais, dependências, caches e artefatos do upload. `.vercel/` fica ignorado pelo Git.

A CLI Vercel 65.3.1 foi instalada no cache de ferramentas e confirmou sessão desconectada. `api.vercel.com` retornou 403 na conexão pelo proxy do ambiente. Requisitos de `VERCEL_TOKEN` e destinos Vercel foram salvos no rascunho, sem valores secretos. Publicação ainda não executada; depende de autenticação Vercel e aplicação dos requisitos de rede ao runtime. Ao retomar, verificar estado atual e repetir apenas as operações afetadas. As quatro variáveis privadas do Atlas devem ser enviadas ao projeto Vercel por canal seguro; nenhum valor foi copiado para arquivos versionados.

## Publicação concluída na Vercel

Projeto: `atlas-web`, equipe `turis-projects-dc350ba8`. URL de produção: https://atlas-web-azure-two.vercel.app . Deployment `dpl_3tUke2HTiSJPnJGkocZEdy2CaC8n`, estado READY confirmado pela CLI e pela consulta de inspeção. A publicação foi feita a partir da versão atual do checkout, sem push dos arquivos locais ao GitHub.

As quatro variáveis de produção foram cadastradas: SUPABASE_URL como configuração; SUPABASE_SECRET_KEY, ATLAS_ACCESS_PASSWORD e ATLAS_SESSION_SECRET como secrets. Valores nunca foram incluídos em documentação, comandos literais de deploy ou código versionado. O projeto foi vinculado ao repositório GitHub pela CLI Vercel durante a criação.

A autenticação foi concluída pelo fluxo oficial de dispositivo da Vercel; não é necessário solicitar outro token enquanto a sessão local estiver válida. O teste HTTP externo do domínio publicado foi bloqueado pelo proxy do ambiente com 403. Os dois domínios de deploy foram adicionados ao rascunho de rede para revisão. Estado READY na Vercel está confirmado; login e consultas no endereço de produção ainda precisam de validação externa. Os mesmos fluxos com dados reais já foram validados na instância local.

## Alteração da senha pessoal

A pedido do usuário, o acesso passou a aceitar senhas de quatro caracteres, mantendo obrigatório o segredo de sessão de pelo menos 32 caracteres. A configuração privada local e o secret Production da Vercel foram atualizados sem registrar o valor escolhido em arquivos versionados.

A regressão foi reproduzida no navegador: com a regra anterior, uma senha curta desabilitava a configuração de autenticação. A regra foi corrigida e a suíte de navegação passou a usar exclusivamente uma senha curta de teste. Resultado: 13 testes unitários e 9 testes de navegador aprovados; lint, build e typecheck aprovados. O hash que assina as sessões continua dependendo da senha, invalidando sessões anteriores após a troca.

A atualização foi publicada no deployment `dpl_78yWbCdFovQ39XhRMJ4mwoVrkYkr`, READY, mantendo https://atlas-web-azure-two.vercel.app . A validação HTTPS de produção confirmou redirecionamento sem sessão, login com a senha atualizada, emissão de cookie Secure e consulta autenticada de ativos reais sem erros. A validação externa anteriormente pendente foi concluída nesta atualização.
