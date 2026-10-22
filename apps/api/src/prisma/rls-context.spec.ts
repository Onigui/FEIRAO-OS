import { isRlsPublicRead, runWithRlsPublicRead, runWithoutRlsPublicRead } from './rls-context';

/** Imita a PrismaPromise: só executa (e lê o contexto) quando alguém chama then(). */
function lazyQuery(): PromiseLike<boolean> {
  return {
    then(onFulfilled, onRejected) {
      return Promise.resolve(isRlsPublicRead()).then(onFulfilled, onRejected);
    },
  };
}

describe('runWithRlsPublicRead', () => {
  it('consulta preguiçosa roda DENTRO do contexto de leitura pública', async () => {
    await expect(runWithRlsPublicRead(() => lazyQuery())).resolves.toBe(true);
  });

  it('fora do helper continua desligado', async () => {
    await expect(Promise.resolve(lazyQuery())).resolves.toBe(false);
  });

  it('runWithoutRlsPublicRead desliga mesmo dentro de uma leitura pública', async () => {
    await expect(
      runWithRlsPublicRead(() => runWithoutRlsPublicRead(() => lazyQuery())),
    ).resolves.toBe(false);
  });
});
