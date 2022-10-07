import { constants as http2Constants } from 'http2';
import * as CBOR from '@stablelib/cbor';
import { Response } from '@zalter/http2-client-node';
import { ContentType } from './http.mjs';

const { HTTP2_HEADER_CONTENT_TYPE } = http2Constants;

export class ServiceException extends Error {
  /**
   * @type string
   */
  code: string;

  /**
   * @param {object} options
   * @param {string} options.code
   * @param {string} options.message
   */
  constructor(options) {
    super(options.message);
    this.code = options.code;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message
    };
  }
}

/**
 * @param {Object} response
 * @return {Promise<never>}
 * @throws ServiceException
 */
export async function createServiceException(response: Response): Promise<never> {
  let data;

  try {
    switch (response.headers[HTTP2_HEADER_CONTENT_TYPE]) {
      case ContentType.APPLICATION_CBOR: {
        data = CBOR.decode(new Uint8Array(response.body));
        break;
      }

      case ContentType.APPLICATION_JSON: {
        data = JSON.parse(response.body.toString());
        break;
      }
    }
  } catch {}

  throw new ServiceException({
    code: data?.error?.code || 'unknown_error',
    message: data?.error?.message || 'Something went wrong'
  });
}