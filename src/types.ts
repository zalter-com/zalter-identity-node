export interface Credentials {
  _v: string;
  issSigAlg: string;
  issSigKeyId: string;
  issSigPubKey: Uint8Array;
  subId: string;
  subSigAlg: string;
  subSigKeyId: string;
  subSigPrivKey: Uint8Array;
}

export interface Endpoint {
  authority: string;
  scheme: 'http' | 'https';
}