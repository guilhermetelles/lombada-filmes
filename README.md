# Lombada

App Android pessoal, que mantém um ranking compartilhado dos filmes que um grupo de pessoas veem juntas. Cada filme tem posição, data em que foi visto, comentário e as notas do IMDb, Letterboxd, Rotten Tomatoes e Metacritic.

## Partes

| Pasta       | O que é                                                                       | Tecnologia                                            |
| ----------- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| `android/`  | O app (ainda não começou)                                                     | Kotlin + Jetpack Compose                              |
| `backend/`  | Chaves das APIs, busca de filmes e notas, listas e convites, consumo das APIs | Vercel Functions, Node 24 + TypeScript                |
| `firebase/` | Regras e índices do Firestore, login com Google, emuladores                   | Firebase (projeto `lombada-db`, `southamerica-east1`) |

O app lê e grava a lista direto no Firestore, protegido pelas regras. O backend cuida do que precisa de segredo ou de privilégio: falar com TMDb, OMDb e Letterboxd, criar listas e validar códigos de convite.

## Configuração

Os segredos ficam num `.env` na raiz (fora do git) e, em produção, nas variáveis de ambiente da Vercel:

```
FIREBASE_SERVICE_ACCOUNT=<JSON da conta de serviço do lombada-db, em uma linha>
TMDB_TOKEN=<token de leitura do TMDb>
OMDB_KEY=<chave da OMDb>
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
```

Só no firebase:

```bash
npm run deploy:rules      # roda os testes das regras e só publica se passarem
npm run deploy:indexes
```

Mock:

```bash
python3 mock/scripts/update_real_data.py   # atualiza capas, notas e sinopses; --refresh refaz tudo
```
