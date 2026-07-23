import Ajv from 'ajv';

/**
 * DocumentEngine — localStorage document persistence with optional JSON Schema validation.
 *
 * @example
 * import { DocumentEngine } from '@adamlockhart/document-engine';
 * const docs = new DocumentEngine('my-app');
 * docs.save('untitled', { version: '1.0', data: [] });
 * const doc = docs.load('untitled');
 *
 * @example With schema validation
 * import schema from './my-schema.json';
 * const docs = new DocumentEngine('my-app', { schema });
 * docs.save('untitled', badDoc); // throws if invalid
 */
export class DocumentEngine {
  /**
   * @param {string} namespace - prefix for localStorage keys to avoid collisions
   * @param {object} [options]
   * @param {object} [options.schema] - JSON Schema object; if provided, documents are validated on save and load
   */
  constructor(namespace, options = {}) {
    if (!namespace) throw new TypeError('namespace is required');
    this._namespace = namespace;
    this._validate = null;

    if (options.schema) {
      const ajv = new Ajv({ allErrors: true });
      this._validate = ajv.compile(options.schema);
    }
  }

  /**
   * Get the localStorage key for a document name.
   * @param {string} name
   * @returns {string}
   */
  _key(name) {
    return `${this._namespace}:${name}`;
  }

  /**
   * Validate a document against the schema (if one was provided).
   * @param {object} doc
   * @throws {Error} if validation fails
   */
  _assertValid(doc) {
    if (!this._validate) return;
    const valid = this._validate(doc);
    if (!valid) {
      const errors = this._validate.errors
        .map((e) => `${e.instancePath || '/'} ${e.message}`)
        .join('; ');
      throw new Error(`Document validation failed: ${errors}`);
    }
  }

  /**
   * Save a document to localStorage.
   * @param {string} name
   * @param {object} doc
   * @throws {Error} if schema validation fails
   */
  save(name, doc) {
    this._assertValid(doc);
    localStorage.setItem(this._key(name), JSON.stringify(doc));

    // Update the index
    const names = this.list();
    if (!names.includes(name)) {
      names.push(name);
      localStorage.setItem(`${this._namespace}:__index__`, JSON.stringify(names));
    }
  }

  /**
   * Load a document from localStorage.
   * @param {string} name
   * @returns {object|null} the parsed document, or null if not found
   * @throws {Error} if schema validation fails on the stored document
   */
  load(name) {
    const raw = localStorage.getItem(this._key(name));
    if (raw === null) return null;
    const doc = JSON.parse(raw);
    this._assertValid(doc);
    return doc;
  }

  /**
   * List all saved document names.
   * @returns {string[]}
   */
  list() {
    const raw = localStorage.getItem(`${this._namespace}:__index__`);
    if (!raw) return [];
    return JSON.parse(raw);
  }

  /**
   * Remove a document from localStorage.
   * @param {string} name
   */
  remove(name) {
    localStorage.removeItem(this._key(name));
    const names = this.list().filter((n) => n !== name);
    localStorage.setItem(`${this._namespace}:__index__`, JSON.stringify(names));
  }
}
