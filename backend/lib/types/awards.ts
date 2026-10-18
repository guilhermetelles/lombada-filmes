/** Prêmios de filmes e pessoas (movies/{tmdbId}.awards e people/{id}.awards). */

/** Premiação: as conhecidas têm nome fixo; outras chegam com o nome da fonte. */
export type AwardOrg = 'Oscar' | 'Framboesa de Ouro' | 'BAFTA' | 'Globo de Ouro' | 'Saturn' | 'Cannes' | (string & {});

/** Vitória ou indicação. */
export type AwardKind = 'win' | 'nom';

/** Um prêmio ou uma indicação. Categoria e ano podem faltar (a Wikipedia nem sempre traz). */
export type AwardItem = {
  org: AwardOrg;
  cat: string | null;
  kind: AwardKind;
  year: number | null;
  for?: string | null | undefined; // por qual filme (prêmios de pessoas, qualificador P1686); ausente quando a fonte não diz
};

/** Campo awards de movies/{tmdbId} e people/{id}. */
export type Awards = {
  items: AwardItem[];
  summary: string | null; // texto curto da OMDb (Awards), quando houver
  fetchedAt: Date;
};
