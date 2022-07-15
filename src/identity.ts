import { constants as http2Constants } from 'http2';
import * as CBOR from '@stablelib/cbor';
import { ApiClient } from './api-client';
import { BASE_ENDPOINT } from './constants';
import { createServiceException } from './exception';
import { ContentType } from './http';
import { Credentials, Endpoint } from './types';

const {
  HTTP2_HEADER_CONTENT_TYPE,
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_STATUS,
  HTTP2_METHOD_POST
} = http2Constants;

interface GetPublicKeyResponse {
  id: string;
  alg: string;
  key: Uint8Array;
  subId: string;
}

interface IdentityClientConfig {
  projectId: string;
  credentials: Credentials;
  endpoint: Endpoint;
}

/** A client for the Zalter Identity Service */
class IdentityClient {
  readonly #projectId: string;
  readonly #apiClient: ApiClient;
  readonly #credentials: Credentials;

  /**
   * @param {Object} config
   * @param {string} config.projectId
   * @param {Object} config.credentials
   * @param {Object} config.endpoint
   */
  constructor(config: IdentityClientConfig) {
    this.#projectId = config.projectId;
    this.#credentials = config.credentials;

    this.#apiClient = new ApiClient({
      credentials: this.#credentials,
      endpoint: config.endpoint || BASE_ENDPOINT
    });
  }

  /** Destroy instance */
  destroy() {
    this.#apiClient.destroy();
  }

  /**
   * Get public key.
   * @param {string} keyId
   * @return {Promise<Object>}
   */
  getPublicKey(keyId: string): Promise<GetPublicKeyResponse> {
    return this.#apiClient
      .request({
        headers: {
          [HTTP2_HEADER_PATH]: '/v1/pks:get',
          [HTTP2_HEADER_METHOD]: HTTP2_METHOD_POST,
          [HTTP2_HEADER_CONTENT_TYPE]: ContentType.APPLICATION_CBOR
        },
        body: CBOR.encode({
          keyId,
          projectId: this.#projectId
        }),
        options: {
          signRequest: true,
          verifyResponse: true
        }
      })
      .then((response) => {
        if (response.headers[HTTP2_HEADER_STATUS] >= 300) {
          return createServiceException(response);
        }

        return CBOR.decode(new Uint8Array(response.body));
      });
  }
}

/**
 * Create Zalter Identity Service client.
 * @param {Object} config
 * @param {string} config.projectId
 * @param {string} config.credentials
 * @param {Object} [config.endpoint]
 */
export const createClient = async (config: { projectId: string; credentials: string; endpoint?: Endpoint; }): Promise<IdentityClient> => {
  if (typeof config?.projectId === 'undefined') {
    throw new Error('\'projectId\' must be provided');
  }

  if (typeof config?.credentials === 'undefined') {
    throw new Error('\'credentials\' must be provided');
  }

  // Decode the credentials

  let credentials: Credentials;

  try {
    credentials = CBOR.decode(Buffer.from(config.credentials, 'base64'));
  } catch {
    throw new Error('Invalid credentials');
  }

  if (credentials._v !== 'v1') {
    throw new Error(`Credentials type "${credentials._v}" not supported`);
  }

  return new IdentityClient({
    projectId: config.projectId,
    credentials,
    endpoint: config.endpoint
  });
};