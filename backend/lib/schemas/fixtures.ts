import * as z from 'zod';

// Formato bruto das respostas que scripts/record-fixtures.ts grava. Só as partes que o script
// enxuga são tipadas; o resto passa como veio (looseObject mantém os campos desconhecidos).

export const TmdbDetailsToRecord = z.looseObject({
  credits: z.looseObject({ crew: z.array(z.looseObject({ job: z.string() })) }),
  translations: z.looseObject({ translations: z.array(z.looseObject({ iso_639_1: z.string() })) }),
});

export const TmdbSearchToRecord = z.looseObject({ results: z.array(z.unknown()) });
