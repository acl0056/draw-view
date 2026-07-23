# @adamlockhart/document-engine

localStorage document persistence with optional JSON Schema validation.

## Install

```sh
npm install @adamlockhart/document-engine
```

## Usage

```js
import { DocumentEngine } from '@adamlockhart/document-engine';

const docs = new DocumentEngine('my-app');

docs.save('untitled', { version: '1.0', data: [] });
const doc = docs.load('untitled');
const names = docs.list();
docs.remove('untitled');
```

### With schema validation

```js
import { DocumentEngine } from '@adamlockhart/document-engine';
import schema from './my-schema.json';

const docs = new DocumentEngine('my-app', { schema });

// Throws if the document doesn't match the schema:
docs.save('untitled', invalidDoc);
docs.load('untitled'); // also validates on load
```

## API

### `new DocumentEngine(namespace, options?)`

| Param | Type | Description |
|-------|------|-------------|
| `namespace` | `string` | Prefix for localStorage keys |
| `options.schema` | `object` | Optional JSON Schema; validates on save and load |

### Methods

- `save(name, doc)` — save a document (validates if schema provided)
- `load(name)` — load a document, returns `null` if not found (validates if schema provided)
- `list()` — list all saved document names
- `remove(name)` — delete a document

## License

MIT
