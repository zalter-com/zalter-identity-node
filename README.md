# Zalter Identity - Node.js SDK

An **ESM** software developer kit meant to be used for using the API services offered by Zalter.

## Requirements

Node.js version **15** or higher. For security reasons the latest version is preferred.

## Installation

Use `npm` to install the `@zalter/identity` node module:

```bash
npm install @zalter/identity
```

## Usage

```javascript
import { createClient } from '@zalter/identity';

const credentials = {}; // your credentials

const client = await createClient({
  credentials
});

try {
  const res = await client.getPubKey('nhrnCEGxNH8');
  console.log(res);
} catch (err) {
  console.error(err);
}

// Destroy the client
client.destroy();
```

## Documentation

[Zalter Docs Website](https://developer.zalter.com/)