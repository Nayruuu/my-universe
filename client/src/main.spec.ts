const bootstrapApplicationMock = vi.hoisted(() => vi.fn());

vi.mock('@angular/platform-browser', () => ({
  bootstrapApplication: bootstrapApplicationMock,
}));

describe('bootstrap de l’application', () => {
  beforeEach(() => {
    vi.resetModules();
    bootstrapApplicationMock.mockReset();
  });

  it('démarre le composant racine avec sa configuration', async () => {
    bootstrapApplicationMock.mockResolvedValue({});

    await import('./main');

    expect(bootstrapApplicationMock).toHaveBeenCalledOnce();
    expect(bootstrapApplicationMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ providers: expect.any(Array) }),
    );
  });

  it('journalise une erreur de démarrage', async () => {
    const error = new Error('échec de démarrage');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    bootstrapApplicationMock.mockRejectedValue(error);
    await import('./main');
    await Promise.resolve();

    expect(consoleError).toHaveBeenCalledWith(error);
  });
});
