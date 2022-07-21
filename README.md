# Zalter Identity - Node.js SDK

An **ESM** and **CJS** software developer kit meant to be used with the Identity API services offered by Zalter.

## Requirements

Node.js version **15** or higher. For security reasons the latest version is preferred.

## Installation

Use `npm` to install the `@zalter/identity` node module:

```bash
npm install @zalter/identity
```

## Usage

```javascript
import { IdentityClient } from '@zalter/identity';

const config = {
  projectId: '<your-project-id>',
  credentials: '<your-credentials>' // your credentials
};

const identityClient = new IdentityClient(config);

const keyId = '<a-signing-key-id>';

try {
  const res = await identityClient.getPublicKey(keyId);
  console.log(res);
} catch (err) {
  console.error(err);
}

// Destroy the client
identityClient.destroy();
```

## Documentation

[Zalter Docs Website](https://developer.zalter.com/)