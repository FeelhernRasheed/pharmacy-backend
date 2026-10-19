import { applyTrustProxy } from './trust-proxy';

describe('applyTrustProxy', () => {
  let expressApp: { set: jest.Mock };

  beforeEach(() => {
    expressApp = { set: jest.fn() };
  });

  it('leaves Express untouched when TRUST_PROXY is unset (default off)', () => {
    applyTrustProxy(expressApp, undefined);

    expect(expressApp.set).not.toHaveBeenCalled();
  });

  it('applies a hop count as a number', () => {
    applyTrustProxy(expressApp, 1);

    expect(expressApp.set).toHaveBeenCalledWith(
      'trust proxy',
      1,
    );
  });

  it('applies an explicit address list as an array', () => {
    applyTrustProxy(expressApp, '10.0.0.0/8,192.168.1.10');

    expect(expressApp.set).toHaveBeenCalledWith(
      'trust proxy',
      ['10.0.0.0/8', '192.168.1.10'],
    );
  });
});
