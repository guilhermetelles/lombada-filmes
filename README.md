# Lombada

App Android pessoal, que mantém um ranking compartilhado dos filmes que um grupo de pessoas veem juntas. Cada filme tem posição, data em que foi visto, comentário e as notas do IMDb, Letterboxd, Rotten Tomatoes e Metacritic.

Versão atual do app: **0.3.1**. Abas Lista (ranking, ordem em que vimos e tier list), Quero ver (fila compartilhada com sorteio), Sugestões (com busca avançada em texto livre), Quiz (uma pergunta por dia e placar do mês) e Relatórios. A página de filme vale para qualquer filme, da lista ou não, com compatibilidade, curiosidades, prêmios (Framboesa de Ouro incluída) e filmes parecidos. A Atividade da lista e as notificações avisam quando a outra pessoa mexe na lista ou na fila, e trazem um assunto por dia (quiz, comentário do dia, curiosidade, duelo, aniversários, estreias, streaming, retrospectiva do mês).

## Partes

| Pasta       | O que é                                                                                                  | Tecnologia                                            |
| ----------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `android/`  | O app, distribuído pelo Firebase App Distribution                                                         | Kotlin + Jetpack Compose, FCM, WorkManager            |
| `backend/`  | Chaves das APIs, filmes, notas e prêmios, listas e convites, fila, sugestões, quiz, notificações, consumo | Vercel Functions, Node 24 + TypeScript                |
| `firebase/` | Regras e índices do Firestore, login com Google, emuladores                                               | Firebase (projeto `lombada-db`, `southamerica-east1`) |

O app lê e grava a lista direto no Firestore, protegido pelas regras. O backend cuida do que precisa de segredo ou de privilégio: falar com TMDb, OMDb, Letterboxd, bechdeltest.com, Wikidata, Wikipedia e Gemini; criar listas e validar convites; escrever a fila, as sugestões, o quiz, o placar e a Atividade; e mandar as notificações pelo FCM.

O Gemini (plano grátis do Google AI Studio) interpreta a busca em texto livre e escreve os motivos das sugestões, o texto da retrospectiva e algumas perguntas do quiz. Os comentários vão só como texto, sem nomes e sem guardar no Google (`store: false`), com o consentimento das duas registrado no `PRODUCT.md`.

## API do backend

Produção: **https://lombada-lovat.vercel.app** (Vercel, região `gru1`). Cada push na `main` de `guilhermetelles/lombada-filmes` publica em produção; outras branches viram deploy de preview.

As rotas do app exigem `Authorization: Bearer <ID token do Firebase Auth>`. Erros vêm como `{ error: { code, message } }`. O plano Hobby da Vercel aceita 12 funções por publicação: as rotas da versão 0.3 passam por uma função só, `api/router.ts`, pelas reescritas do `vercel.json`.

| Rota | O que faz |
|---|---|
| `GET /api/me` | Devolve o uid de quem chamou e sincroniza nome e foto do Google em `memberProfiles` das listas da pessoa |
| `GET /api/search?q=` | Busca filmes no TMDb (pt-BR) |
| `GET /api/search/people?q=` | Busca atores e diretores no TMDb (até 5, com títulos conhecidos) |
| `POST /api/search/interpret` | Transforma um texto livre ("comédia com casal gay") em filtros da busca avançada, pelo Gemini (até 30 por pessoa por dia) |
| `GET /api/discover?listId=&…` | Busca avançada no TMDb (região BR) por gênero, década, duração, humor, tema e streaming, ordenada pela compatibilidade com a lista |
| `GET /api/movies/{tmdbId}` | Filme com as quatro notas, diretores e elenco (nome e foto), buscando de novo o que tem mais de 7 dias, e o Teste de Bechdel do bechdeltest.com (`bechdel`; página relida aos 30 dias, filme fora do site procurado de novo aos 7). Com `?listId=`, acrescenta a compatibilidade com a lista (`compat`) |
| `GET /api/people/{personId}` | Diretor ou ator (biografia, nascimento, foto, filmes dirigidos e atuados), buscado só quando a tela é aberta e de novo depois de 30 dias |
| `POST /api/lists` | Cria uma lista e o primeiro código de convite |
| `POST /api/lists/join` | Entra numa lista com um código (`{ code }`) |
| `POST /api/lists/{listId}/invites` | Gera um código de convite novo (7 dias) |
| `POST /api/lists/{listId}/leave` | Sai da lista; a última pessoa a sair apaga a lista |
| `DELETE /api/lists/{listId}` | A dona apaga a lista, as entradas e os convites |
| `POST /api/lists/{listId}/queue` | Põe um filme no "Quero ver" (`{ tmdbId }`) e avisa a outra pessoa |
| `DELETE /api/lists/{listId}/queue/{tmdbId}` | Tira um filme do "Quero ver" e avisa a outra pessoa |
| `POST /api/lists/{listId}/events` | Recebe do app o que mudou na lista (adicionou, moveu, comentou, retirou), grava na Atividade e avisa a outra pessoa na hora |
| `POST /api/lists/{listId}/quiz/{dia}/answer` | Responde a pergunta do dia (`{ optionId }`): uma resposta por pessoa, só no dia, 10 pontos por acerto no placar do mês |
| `POST /api/me/devices`, `DELETE /api/me/devices` | Registra ou tira o token do aparelho para as notificações (até 5 por pessoa) |
| `GET /api/me/notify`, `PUT /api/me/notify` | Preferências das notificações (frequência, horário, tipos, avisos de atividade) |
| `POST /api/me/notify-test` | Manda uma notificação de teste para os aparelhos de quem chamou |

As rotinas são chamadas pelo Vercel Cron e exigem `Authorization: Bearer <CRON_SECRET>` em vez do ID token. Horários em UTC (Brasília é UTC−3):

| Rotina | Quando | O que faz |
|---|---|---|
| `GET /api/cron/enrich` | 07:00 | Dados extras do TMDb (título no Brasil, orçamento, bilheteria, saga, palavras-chave, parecidos, streaming no Brasil), prêmios pelo Wikidata e pela Wikipedia, pessoas recorrentes da lista; continua de onde parou se passar de 240 s |
| `GET /api/cron/recs` | 08:00 | Sugestões de cada lista: candidatos do TMDb, modelo de pares sobre o ranking, variedade, motivos pelo Gemini; grava `recs/current` |
| `GET /api/cron/quiz-and-month` | 08:30 | Pergunta do dia de cada lista (12 tipos); no dia 1, fecha o placar do mês, avisa quem venceu e gera a retrospectiva |
| `GET /api/cron/daily` | 09:00 | Atualiza as notas com mais de 7 dias (só Letterboxd e OMDb), o Teste de Bechdel pelo índice do bechdeltest.com (casa até 30 filmes novos) e apaga convites vencidos |
| `GET /api/cron/notify-09`, `-12`, `-19`, `-21` | 12:00, 15:00, 22:00, 00:00 | Notificação diária de quem escolheu esse horário (9h, 12h, 19h ou 21h de Brasília), com um assunto por dia e sem repetir no mesmo dia |

Para chamar as rotas na mão, `cd backend && npm run login-page` abre em http://localhost:5173 uma página de login com Google que mostra o uid e um ID token.

## Configuração

Os segredos ficam num `.env` na raiz (fora do git) e, em produção, nas variáveis de ambiente da Vercel:

```
FIREBASE_SERVICE_ACCOUNT=<JSON da conta de serviço do lombada-db, em uma linha>
TMDB_TOKEN=<token de leitura do TMDb>
OMDB_KEY=<chave da OMDb>
CRON_SECRET=<texto aleatório, 16+ caracteres; a Vercel manda nas chamadas do cron>
GEMINI_API_KEY=<chave do Google AI Studio; opcional: sem ela, a busca em texto livre fica indisponível e os motivos, o quiz e a retrospectiva usam regras simples>
OWNER_UID=<uid da dona da lista original; só a carga usa>
```

Os emuladores do Firebase precisam de Java 11+ no `PATH`. O Firebase CLI roda com `npx -y firebase-tools`, sem instalação global.

## Comandos

`backend/` e `firebase/` são pacotes separados, com os mesmos scripts:

```bash
npm install
npm run typecheck
npm run lint        # Biome; npm run format corrige
npm test            # sobe os emuladores do Firebase (precisa de Java 11+)
```

Só no backend:

```bash
npm run check:firestore   # lê o lombada-db de verdade com a conta de serviço do .env e resume o Teste de Bechdel de cada lista
npm run record:fixtures   # regrava as respostas das APIs usadas nos testes (-- bechdel regrava só as do bechdeltest.com)
npm run login-page        # página local de login com Google (uid e ID token)
npm run migrate:member-profiles -- --dry-run   # confere nome e foto das pessoas nas listas; sem --dry-run, grava (já feito; pode rodar de novo)
npm run seed:original-list:emulator   # ensaio da carga da lista original no emulador
npm run seed:original-list            # carga da lista original no lombada-db (já feita; pode rodar de novo sem duplicar)
```

A carga lê o mock (`mock/index.html` e `mock/data/real.json`, fora do git) e o `OWNER_UID` do `.env`.

Só no firebase:

```bash
npm run deploy:rules      # roda os testes das regras e só publica se passarem
npm run deploy:indexes
```

App (de dentro de `android/`; SDK em `~/Android/Sdk` e JDK 21 em `~/.local/jdk-21`):

```bash
./gradlew assembleDebug                                  # compila
./gradlew spotlessCheck lint testDebugUnitTest           # formatação (ktlint), lint e testes de unidade
./scripts/emulator-tests.sh                              # testes instrumentados no celular pareado, contra os emuladores
./scripts/distribute.sh "notas da versão" email1,email2  # versão assinada pelo App Distribution (aumente versionCode antes)
```

Mock:

```bash
python3 mock/scripts/update_real_data.py   # atualiza capas, notas e sinopses; --refresh refaz tudo
```
