import * as Ed25519 from '@stablelib/ed25519';

/**
 * A utility class to verify signatures.
 */
export class Verifier {
  /**
   * Verify signature.
   * @param {Uint8Array} key
   * @param {string} alg
   * @param {Uint8Array} sig
   * @param {Uint8Array} data
   */
  static verify(key: Uint8Array, alg: string, sig: Uint8Array, data: Uint8Array): boolean {
    if (alg !== 'Ed25519') {
      throw new Error('Algorithm not supported');
    }

    return Ed25519.verify(key, data, sig);
  }
}