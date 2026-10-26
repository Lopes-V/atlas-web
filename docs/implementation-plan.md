# Atlas Web

## Direção e escopo
Painel pessoal de consulta para o backend Lopes-V/mercado_invest. Implementação autorizada pelo pedido de criação do frontend. O DESIGN.md existente, baseado na análise NerdWallet do getdesign.md, permanece preservado como fonte visual.

Next.js App Router e TypeScript permitem manter a chave Supabase apenas no servidor, respeitando o schema atual, que revoga acesso de anon e authenticated. Uma SPA exigiria criar e manter uma API Python ou alterar permissões de banco. A decisão de implementação é Next.js e acesso pessoal por senha, com sessão assinada; não há operações de escrita no banco.

## Design
Montserrat local substitui Gotham, conforme o próprio DESIGN.md. Verde #008254, forest #00482f, mint #effcf8, lime #e8fdac e canvas branco. Navegação lateral clara, faixa verde editorial na visão geral, tabelas sem divisórias verticais, botões de 2 px e painéis de 8 px. Sem sombras nos cartões. Navegação recolhível no celular; foco visível e movimento reduzido.

## Entregas
- [ ] Estrutura Next, dependências fixadas no lockfile e documentação de execução.
- [ ] Contratos validados com Zod, leitura PostgREST com timeout, erros por seção e sem dados financeiros fictícios.
- [ ] Sessão assinada, proteção de dados e login pessoal; sem acesso ao banco antes de autenticar.
- [ ] Visão geral, mercados com busca e filtro, detalhes e histórico por ativo, carteira com seleção, oportunidades, alertas, renda fixa e monitoramento.
- [ ] Favoritos e ocultação de valores locais, filtros por URL, atualização manual e exportação CSV.
- [ ] Testes de integridade financeira, autenticação e navegador, lint, tipos e build.

## Integridade dos dados
Não inventar cotações, percentuais ou séries. Mostrar timestamp e qualidade, sinalizar dados antigos, calcular diferenças apenas entre registros reais da mesma fonte, usar Decimal para aritmética. Carteiras e moedas não são somadas entre si. Análises e sinais são registros do backend, nunca recomendações geradas no frontend. Paginação e limites de consulta aparecem na interface.

## Validação
Testes unitários para seleção do registro mais recente, qualidade/antiguidade, precisão, CSV e sessão. Playwright para rotas, filtros, responsividade, navegação por teclado, falha de conexão e proteção dos dados. Sem credenciais locais, validação live depende da configuração de .env.local; fixtures só nos testes.
