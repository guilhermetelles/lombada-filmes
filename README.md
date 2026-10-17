# Lombada

App Android pessoal, que mantém um ranking compartilhado dos filmes que um grupo de pessoas veem juntas. Cada filme tem posição, data em que foi visto, comentário e as notas do IMDb, Letterboxd, Rotten Tomatoes e Metacritic.

## Partes

| Pasta       | O que é                                                                       | Tecnologia                                            |
| ----------- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| `android/`  | O app (ainda não começou)                                                     | Kotlin + Jetpack Compose                              |
| `backend/`  | Chaves das APIs, busca de filmes e notas, listas e convites, consumo das APIs | Vercel Functions, Node 24 + TypeScript                |
| `firebase/` | Regras e índices do Firestore, login com Google, emuladores                   | Firebase (projeto `lombada-db`, `southamerica-east1`) |

O app lê e grava a lista direto no Firestore, protegido pelas regras. O backend cuida do que precisa de segredo ou de privilégio: falar com TMDb, OMDb e Letterboxd, criar listas e validar códigos de convite.

## API do backend

Produção: **https://lombada-lovat.vercel.app** (Vercel, região `gru1`). Cada push na `main` de `guilhermetelles/lombada-filmes` publica em produção; outras branches viram deploy de preview.

As rotas do app exigem `Authorization: Bearer <ID token do Firebase Auth>`. Erros vêm como `{ error: { code, message } }`.

| Rota | O que faz |
|---|---|
| `GET /api/me` | Devolve o uid de quem chamou |
| `GET /api/search?q=` | Busca filmes no TMDb (pt-BR) |
| `GET /api/search/people?q=` | Busca atores e diretores no TMDb (até 5, com títulos conhecidos) |
| `GET /api/movies/{tmdbId}` | Filme com as quatro notas, diretores e elenco, buscando de novo só o que tem mais de 7 dias |
| `GET /api/people/{personId}` | Diretor ou ator (biografia, nascimento, foto, filmes dirigidos e atuados), buscando de novo depois de 30 dias |
| `POST /api/lists` | Cria uma lista e o primeiro código de convite |
| `POST /api/lists/join` | Entra numa lista com um código (`{ code }`) |
| `POST /api/lists/{listId}/invites` | Gera um código de convite novo (7 dias) |
| `POST /api/lists/{listId}/leave` | Sai da lista; a última pessoa a sair apaga a lista |
| `DELETE /api/lists/{listId}` | A dona apaga a lista, as entradas e os convites |
| `GET /api/cron/daily` | Rotina diária da Vercel (6h de Brasília): atualiza notas e diretores vencidos e apaga convites vencidos. Exige `Authorization: Bearer <CRON_SECRET>` em vez do ID token |

Para chamar as rotas na mão, `cd backend && npm run login-page` abre em http://localhost:5173 uma página de login com Google que mostra o uid e um ID token.

## Configuração

Os segredos ficam num `.env` na raiz (fora do git) e, em produção, nas variáveis de ambiente da Vercel:

```
FIREBASE_SERVICE_ACCOUNT=<JSON da conta de serviço do lombada-db, em uma linha>
TMDB_TOKEN=<token de leitura do TMDb>
OMDB_KEY=<chave da OMDb>
CRON_SECRET=<texto aleatório, 16+ caracteres; a Vercel manda nas chamadas do cron>
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
npm run check:firestore   # lê o lombada-db de verdade com a conta de serviço do .env
npm run record:fixtures   # regrava as respostas das APIs usadas nos testes
npm run login-page        # página local de login com Google (uid e ID token)
npm run seed:original-list:emulator   # ensaio da carga da lista original no emulador
npm run seed:original-list            # carga da lista original no lombada-db (já feita; pode rodar de novo sem duplicar)
npm run backfill:cast:dry-run         # ensaio da recarga do elenco (lê o lombada-db, não grava)
npm run backfill:cast                 # recarga do elenco e dos filmes atuados (já feita)
```

A carga lê o mock (`mock/index.html` e `mock/data/real.json`, fora do git) e o `OWNER_UID` do `.env`.

Só no firebase:

```bash
npm run deploy:rules      # roda os testes das regras e só publica se passarem
npm run deploy:indexes
```

Mock:

```bash
python3 mock/scripts/update_real_data.py   # atualiza capas, notas e sinopses; --refresh refaz tudo
```
