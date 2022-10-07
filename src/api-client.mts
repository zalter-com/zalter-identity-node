import { constants as http2Constants } from 'http2';
import * as CBOR from '@stablelib/cbor';
import * as Ed25519 from '@stablelib/ed25519';
import { Client as Http2Client, Headers, Response } from '@zalter/http2-client-node';
import { API_VERSION } from './constants.mjs';
import { HttpHeader } from './http.mjs';
import { logger } from './logger.mjs';
import { TimeDrifter } from './time-drifter.mjs';
import { Credentials, Endpoint } from './types.mjs';

const { HTTP2_HEADER_STATUS, HTTP2_HEADER_DATE, HTTP2_HEADER_AUTHORITY, HTTP_STATUS_UNAUTHORIZED } = http2Constants;

const http2Client = new Http2Client();

const timeDrifter = new TimeDrifter();

interface RequestParams {
  headers?: Headers;
  body?: string | ArrayBufferLike;
  options?: {
    signRequest?: boolean;
    verifyResponse?: boolean;
  };
}

interface Request {
  headers?: Headers;
  body?: string | ArrayBufferLike;
}

interface SignOptions {
  now?: number;
  expiresIn?: number;
}

const addBaseHeaders = (headers?: Headers): Headers => {
  return Object.assign({}, headers, {
    [HttpHeader.X_ZALTER_VERSION]: API_VERSION
  });
};

interface ApiClientConfig {
  credentials: Credentials;
  endpoint: Endpoint;
}

export class ApiClient {
  readonly #credentials: Credentials;

  readonly #endpoint: Endpoint;

  /**
   * @param {Object} config
   * @param {Object} config.credentials
   * @param {Object} config.endpoint
   */
  constructor(config: ApiClientConfig) {
    this.#credentials = config.credentials;
    this.#endpoint = config.endpoint;
  }

  /** Close all active server sessions */
  destroy() {
    http2Client.destroy();
  }

  async request(params: RequestParams): Promise<Response> {
    const request: Request = {
      headers: addBaseHeaders({
        ...params.headers,
        [HTTP2_HEADER_AUTHORITY]: this.#endpoint.authority // otherwise it uses default port when missing
      }),
      body: params.body
    };

    // Sign the request.

    if (params.options?.signRequest) {
      await this.#signRequest(request, {
        now: Math.floor(timeDrifter.date.getTime() / 1000)
      });
    }

    let response;

    try {
      response = await http2Client.request(this.#endpoint.scheme + '://' + this.#endpoint.authority, request);
    } catch (err) {
      logger.error(err);
      throw err;
    }

    // Might be a drift
    if (params.options?.signRequest && response.headers[HTTP2_HEADER_STATUS] === HTTP_STATUS_UNAUTHORIZED) {
      const date = response.headers[HTTP2_HEADER_DATE];

      if (timeDrifter.update(date)) {
        response = await this.request(params);
      }
    }

    if (response.headers[HTTP2_HEADER_STATUS] >= 300) {
      return response;
    }

    if (!params.options?.verifyResponse) {
      return response;
    }

    // Verify response signature.

    if (params.options?.verifyResponse) {
      const isValid = await this.#verifyResponse(response);

      if (!isValid) {
        throw new Error('Response couldn\'t be verified');
      }
    }

    return response;
  }

  async #signRequest(request: Request, options?: SignOptions): Promise<void> {
    options = options || {};

    let created: number = Math.floor(Date.now() / 1000);
    let expires: number | undefined;

    if (typeof options.now !== 'undefined') {
      if (typeof options.now !== 'number') {
        throw new Error('\'now\' should be a number of seconds');
      } else {
        created = options.now;
      }
    }

    if (typeof options.expiresIn !== 'undefined') {
      if (typeof options.expiresIn !== 'number') {
        throw new Error('\'expiresIn\' should be a number of seconds');
      } else {
        expires = created + options.expiresIn;
      }
    }

    // We have no control over other headers added by proxies or other network interceptors.

    const signedHeaders = Object.keys(request.headers).sort();

    const sortedHeaders = signedHeaders.reduce((acc, key) => {
      acc[key] = request.headers[key];
      return acc;
    }, {});

    let body;

    if (typeof request.body === 'undefined') {
      body = new Uint8Array(0);
    } else if (typeof request.body === 'string') {
      body = Buffer.from(request.body);
    } else if (request.body instanceof Uint8Array) {
      body = request.body;
    } else if (request.body instanceof ArrayBuffer) {
      body = new Uint8Array(request.body);
    } else {
      throw new Error('\'body\' must be string, ArrayBuffer or TypedArray');
    }

    const dataToSign = new Uint8Array(Buffer.concat([
      CBOR.encode({
        alg: this.#credentials.subSigAlg,
        keyId: this.#credentials.subSigKeyId,
        created,
        expires,
        signedHeaders
      }),
      CBOR.encode(sortedHeaders),
      body
    ]));

    const sig = Ed25519.sign(this.#credentials.subSigPrivKey, dataToSign);

    const signature = {
      alg: this.#credentials.subSigAlg,
      keyId: this.#credentials.subSigKeyId,
      created,
      expires,
      signedHeaders,
      sig
    };

    request.headers[HttpHeader.X_ZALTER_SIGNATURE] = Buffer.from(CBOR.encode(signature)).toString('base64');
  }

  async #verifyResponse(response: Response): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);

    const signatureHeader = response.headers[HttpHeader.X_ZALTER_SIGNATURE];

    if (!signatureHeader) {
      logger.error('Response is missing signature header');
      return false;
    }

    let signature;

    try {
      signature = CBOR.decode(Buffer.from(signatureHeader, 'base64'));
    } catch {
      logger.error('Signature verification failed: Unable to decode the signature header');
      return false;
    }

    if (signature.alg !== 'Ed25519') {
      logger.error('Signature verification failed: Invalid \'signature.alg\' value');
      return false;
    }

    if (typeof signature.keyId !== 'string') {
      logger.error('Signature verification failed: Invalid \'signature.keyId\' value');
      return false;
    }

    // TODO: Verify keyId is known

    if (!(signature.sig instanceof Uint8Array)) {
      logger.error('Signature verification failed: Invalid \'signature.sig\' value');
      return false;
    }

    // TODO: Verify signature.created and signature.expires are not before now when defined

    if (typeof signature.created !== 'undefined') {
      if (typeof signature.created !== 'number') {
        logger.error('Signature verification failed: Invalid \'signature.created\' value');
        return false;
      }
    }

    if (typeof signature.expires !== 'undefined') {
      if (typeof signature.expires !== 'number') {
        logger.error('Signature verification failed: Invalid \'signature.expires\' value');
        return false;
      } else {
        if (now >= signature.expires) {
          logger.error('Signature verification failed: Signature expired');
          return false;
        }
      }
    }

    if (
      !(Array.isArray(signature.signedHeaders)) ||
      !signature.signedHeaders.every((item) => (typeof item === 'string'))
    ) {
      logger.error('Signature verification failed: Invalid \'signature.signedHeaders\' value');
      return false;
    }

    const signedHeadersData = (signature.signedHeaders || [])
      .sort()
      .reduce((acc, key) => {
        acc[key] = response.headers[key];
        return acc;
      }, {});

    const body = response.body ? new Uint8Array(response.body) : new Uint8Array(0);

    const dataToVerify = Buffer.concat([
      CBOR.encode({
        alg: signature.alg,
        keyId: signature.keyId,
        created: signature.created,
        expires: signature.expires,
        signedHeaders: signature.signedHeaders
      }),
      CBOR.encode(signedHeadersData),
      body
    ]);

    try {
      return Ed25519.verify(this.#credentials.issSigPubKey, dataToVerify, signature.sig);
    } catch (err) {
      logger.error('Invalid signature', err);
      return false;
    }
  }
}