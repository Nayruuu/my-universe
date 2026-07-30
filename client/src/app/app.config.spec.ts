import { appConfig } from './app.config';

describe('configuration Angular', () => {
  it('active les fournisseurs globaux de l’application', () => {
    expect(appConfig.providers).toHaveLength(2);
  });
});
