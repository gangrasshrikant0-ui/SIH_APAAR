const DEMO_RESPONSES = Object.freeze({
  '900000000001': { outcome: 'PENDING', message: 'Demo mode does not contact an official provider.' },
  '900000000002': { outcome: 'TIMEOUT', message: 'Synthetic provider timeout; this does not invalidate the ID.' },
  '900000000003': { outcome: 'RATE_LIMITED', message: 'Synthetic provider rate limit; retry later.' },
  '900000000004': { outcome: 'UNAUTHORIZED', message: 'Synthetic provider authorization failure; this does not invalidate the ID.' },
  '900000000005': { outcome: 'PROVIDER_ERROR', message: 'Synthetic provider error; this does not invalidate the ID.' },
  '900000000006': { outcome: 'NO_MATCH', message: 'Synthetic authorized source returned no match.' },
  '900000000007': { outcome: 'PENDING', name: 'Synthetic Official Name', dob: '2003-12-31', message: 'Synthetic fields are available for comparison; official verification is not connected.' }
});

class ApaarVerificationService {
  constructor({ mode = process.env.APAAR_VERIFICATION_MODE || 'DEMO', provider = null } = {}) {
    this.mode = mode.toUpperCase();
    this.provider = provider;
  }

  async verify(apaarId) {
    if (this.mode !== 'DEMO') {
      if (!this.provider || typeof this.provider.verify !== 'function') {
        return { outcome: 'PENDING', mode: this.mode, source: 'NOT_CONFIGURED',
          message: 'Authorized verification provider is not configured.' };
      }
      return this.provider.verify(apaarId);
    }
    const response = DEMO_RESPONSES[apaarId] || {
      outcome: 'NOT_AVAILABLE', message: 'No deterministic synthetic response exists for this ID.'
    };
    return { ...response, mode: 'DEMO', source: 'SYNTHETIC_DATASET' };
  }
}

module.exports = { ApaarVerificationService, DEMO_RESPONSES };
