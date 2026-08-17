// node_modules/@netlify/runtime-utils/dist/main.js
var getString = (input) => typeof input === "string" ? input : JSON.stringify(input);
var base64Decode = globalThis.Buffer ? (input) => Buffer.from(input, "base64").toString() : (input) => atob(input);
var base64Encode = globalThis.Buffer ? (input) => Buffer.from(getString(input)).toString("base64") : (input) => btoa(getString(input));
var getEnvironment = () => {
  const { Deno, Netlify, process } = globalThis;
  return Netlify?.env ?? Deno?.env ?? {
    delete: (key) => delete process?.env[key],
    get: (key) => process?.env[key],
    has: (key) => Boolean(process?.env[key]),
    set: (key, value) => {
      if (process?.env) {
        process.env[key] = value;
      }
    },
    toObject: () => process?.env ?? {}
  };
};

// node_modules/@netlify/otel/dist/main.js
var GET_TRACER = "__netlify__getTracer";
var getTracer = (name, version) => {
  return globalThis[GET_TRACER]?.(name, version);
};
function withActiveSpan(tracer, name, optionsOrFn, contextOrFn, fn) {
  const func = typeof contextOrFn === "function" ? contextOrFn : typeof optionsOrFn === "function" ? optionsOrFn : fn;
  if (!func) {
    throw new Error("function to execute with active span is missing");
  }
  if (!tracer) {
    return func();
  }
  return tracer.withActiveSpan(name, optionsOrFn, contextOrFn, func);
}

// node_modules/@netlify/blobs/dist/chunk-YAGWSQMB.js
var getEnvironmentContext = () => {
  const context = globalThis.netlifyBlobsContext || getEnvironment().get("NETLIFY_BLOBS_CONTEXT");
  if (typeof context !== "string" || !context) {
    return {};
  }
  const data = base64Decode(context);
  try {
    return JSON.parse(data);
  } catch {
  }
  return {};
};
var MissingBlobsEnvironmentError = class extends Error {
  constructor(requiredProperties) {
    super(
      `The environment has not been configured to use Netlify Blobs. To use it manually, supply the following properties when creating a store: ${requiredProperties.join(
        ", "
      )}`
    );
    this.name = "MissingBlobsEnvironmentError";
  }
};
var BASE64_PREFIX = "b64;";
var METADATA_HEADER_INTERNAL = "x-amz-meta-user";
var METADATA_HEADER_EXTERNAL = "netlify-blobs-metadata";
var METADATA_MAX_SIZE = 2 * 1024;
var encodeMetadata = (metadata) => {
  if (!metadata) {
    return null;
  }
  const encodedObject = base64Encode(JSON.stringify(metadata));
  const payload = `b64;${encodedObject}`;
  if (METADATA_HEADER_EXTERNAL.length + payload.length > METADATA_MAX_SIZE) {
    throw new Error("Metadata object exceeds the maximum size");
  }
  return payload;
};
var decodeMetadata = (header) => {
  if (!header?.startsWith(BASE64_PREFIX)) {
    return {};
  }
  const encodedData = header.slice(BASE64_PREFIX.length);
  const decodedData = base64Decode(encodedData);
  const metadata = JSON.parse(decodedData);
  return metadata;
};
var getMetadataFromResponse = (response) => {
  if (!response.headers) {
    return {};
  }
  const value = response.headers.get(METADATA_HEADER_EXTERNAL) || response.headers.get(METADATA_HEADER_INTERNAL);
  try {
    return decodeMetadata(value);
  } catch {
    throw new Error(
      "An internal error occurred while trying to retrieve the metadata for an entry. Please try updating to the latest version of the Netlify Blobs client."
    );
  }
};
var NF_ERROR = "x-nf-error";
var NF_REQUEST_ID = "x-nf-request-id";
var BlobsInternalError = class extends Error {
  constructor(res) {
    let details = res.headers.get(NF_ERROR) || `${res.status} status code`;
    if (res.headers.has(NF_REQUEST_ID)) {
      details += `, ID: ${res.headers.get(NF_REQUEST_ID)}`;
    }
    super(`Netlify Blobs has generated an internal error (${details})`);
    this.name = "BlobsInternalError";
  }
};
var collectIterator = async (iterator) => {
  const result = [];
  for await (const item of iterator) {
    result.push(item);
  }
  return result;
};
function withSpan(span, name, fn) {
  if (span) return fn(span);
  return withActiveSpan(getTracer(), name, (span2) => {
    return fn(span2);
  });
}
var BlobsConsistencyError = class extends Error {
  constructor() {
    super(
      `Netlify Blobs has failed to perform a read using strong consistency because the environment has not been configured with a 'uncachedEdgeURL' property`
    );
    this.name = "BlobsConsistencyError";
  }
};
var regions = {
  "us-east-1": true,
  "us-east-2": true,
  "eu-central-1": true,
  "ap-southeast-1": true,
  "ap-southeast-2": true
};
var isValidRegion = (input) => Object.keys(regions).includes(input);
var InvalidBlobsRegionError = class extends Error {
  constructor(region) {
    super(
      `${region} is not a supported Netlify Blobs region. Supported values are: ${Object.keys(regions).join(", ")}.`
    );
    this.name = "InvalidBlobsRegionError";
  }
};
var DEFAULT_RETRY_DELAY = getEnvironment().get("NODE_ENV") === "test" ? 1 : 5e3;
var MIN_RETRY_DELAY = 1e3;
var MAX_RETRY = 5;
var RATE_LIMIT_HEADER = "X-RateLimit-Reset";
var fetchAndRetry = async (fetch, url, options, attemptsLeft = MAX_RETRY) => {
  try {
    const res = await fetch(url, options);
    if (attemptsLeft > 0 && (res.status === 429 || res.status >= 500)) {
      const delay = getDelay(res.headers.get(RATE_LIMIT_HEADER));
      await sleep(delay);
      return fetchAndRetry(fetch, url, options, attemptsLeft - 1);
    }
    return res;
  } catch (error) {
    if (attemptsLeft === 0) {
      throw error;
    }
    const delay = getDelay();
    await sleep(delay);
    return fetchAndRetry(fetch, url, options, attemptsLeft - 1);
  }
};
var getDelay = (rateLimitReset) => {
  if (!rateLimitReset) {
    return DEFAULT_RETRY_DELAY;
  }
  return Math.max(Number(rateLimitReset) * 1e3 - Date.now(), MIN_RETRY_DELAY);
};
var sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});
var SIGNED_URL_ACCEPT_HEADER = "application/json;type=signed-url";
var Client = class {
  constructor({ apiURL, consistency, edgeURL, fetch, region, siteID, token, uncachedEdgeURL }) {
    this.apiURL = apiURL;
    this.consistency = consistency ?? "eventual";
    this.edgeURL = edgeURL;
    this.fetch = fetch ?? globalThis.fetch;
    this.region = region;
    this.siteID = siteID;
    this.token = token;
    this.uncachedEdgeURL = uncachedEdgeURL;
    if (!this.fetch) {
      throw new Error(
        "Netlify Blobs could not find a `fetch` client in the global scope. You can either update your runtime to a version that includes `fetch` (like Node.js 18.0.0 or above), or you can supply your own implementation using the `fetch` property."
      );
    }
  }
  async getFinalRequest({
    consistency: opConsistency,
    key,
    metadata,
    method,
    parameters = {},
    storeName
  }) {
    const encodedMetadata = encodeMetadata(metadata);
    const consistency = opConsistency ?? this.consistency;
    let urlPath = `/${this.siteID}`;
    if (storeName) {
      urlPath += `/${storeName}`;
    }
    if (key) {
      urlPath += `/${key}`;
    }
    if (this.edgeURL) {
      if (consistency === "strong" && !this.uncachedEdgeURL) {
        throw new BlobsConsistencyError();
      }
      const headers = {
        authorization: `Bearer ${this.token}`
      };
      if (encodedMetadata) {
        headers[METADATA_HEADER_INTERNAL] = encodedMetadata;
      }
      if (this.region) {
        urlPath = `/region:${this.region}${urlPath}`;
      }
      const url2 = new URL(urlPath, consistency === "strong" ? this.uncachedEdgeURL : this.edgeURL);
      for (const key2 in parameters) {
        url2.searchParams.set(key2, parameters[key2]);
      }
      return {
        headers,
        url: url2.toString()
      };
    }
    const apiHeaders = { authorization: `Bearer ${this.token}` };
    const url = new URL(`/api/v1/blobs${urlPath}`, this.apiURL ?? "https://api.netlify.com");
    for (const key2 in parameters) {
      url.searchParams.set(key2, parameters[key2]);
    }
    if (this.region) {
      url.searchParams.set("region", this.region);
    }
    if (storeName === void 0 || key === void 0) {
      return {
        headers: apiHeaders,
        url: url.toString()
      };
    }
    if (encodedMetadata) {
      apiHeaders[METADATA_HEADER_EXTERNAL] = encodedMetadata;
    }
    if (method === "head" || method === "delete") {
      return {
        headers: apiHeaders,
        url: url.toString()
      };
    }
    const res = await this.fetch(url.toString(), {
      headers: { ...apiHeaders, accept: SIGNED_URL_ACCEPT_HEADER },
      method
    });
    if (res.status !== 200) {
      throw new BlobsInternalError(res);
    }
    const { url: signedURL } = await res.json();
    const userHeaders = encodedMetadata ? { [METADATA_HEADER_INTERNAL]: encodedMetadata } : void 0;
    return {
      headers: userHeaders,
      url: signedURL
    };
  }
  async makeRequest({
    body,
    conditions = {},
    consistency,
    headers: extraHeaders,
    key,
    metadata,
    method,
    parameters,
    storeName
  }) {
    const { headers: baseHeaders = {}, url } = await this.getFinalRequest({
      consistency,
      key,
      metadata,
      method,
      parameters,
      storeName
    });
    const headers = {
      ...baseHeaders,
      ...extraHeaders
    };
    if (method === "put") {
      headers["cache-control"] = "max-age=0, stale-while-revalidate=60";
    }
    if ("onlyIfMatch" in conditions && conditions.onlyIfMatch) {
      headers["if-match"] = conditions.onlyIfMatch;
    } else if ("onlyIfNew" in conditions && conditions.onlyIfNew) {
      headers["if-none-match"] = "*";
    }
    const options = {
      body,
      headers,
      method
    };
    if (body instanceof ReadableStream) {
      options.duplex = "half";
    }
    return fetchAndRetry(this.fetch, url, options);
  }
};
var getClientOptions = (options, contextOverride) => {
  const context = contextOverride ?? getEnvironmentContext();
  const siteID = context.siteID ?? options.siteID;
  const token = context.token ?? options.token;
  if (!siteID || !token) {
    throw new MissingBlobsEnvironmentError(["siteID", "token"]);
  }
  if (options.region !== void 0 && !isValidRegion(options.region)) {
    throw new InvalidBlobsRegionError(options.region);
  }
  const clientOptions = {
    apiURL: context.apiURL ?? options.apiURL,
    consistency: options.consistency,
    edgeURL: context.edgeURL ?? options.edgeURL,
    fetch: options.fetch,
    region: options.region,
    siteID,
    token,
    uncachedEdgeURL: context.uncachedEdgeURL ?? options.uncachedEdgeURL
  };
  return clientOptions;
};

// node_modules/@netlify/blobs/dist/main.js
var DEPLOY_STORE_PREFIX = "deploy:";
var LEGACY_STORE_INTERNAL_PREFIX = "netlify-internal/legacy-namespace/";
var SITE_STORE_PREFIX = "site:";
var STATUS_OK = 200;
var STATUS_PRE_CONDITION_FAILED = 412;
var Store = class _Store {
  constructor(options) {
    this.client = options.client;
    if ("deployID" in options) {
      _Store.validateDeployID(options.deployID);
      let name = DEPLOY_STORE_PREFIX + options.deployID;
      if (options.name) {
        name += `:${options.name}`;
      }
      this.name = name;
    } else if (options.name.startsWith(LEGACY_STORE_INTERNAL_PREFIX)) {
      const storeName = options.name.slice(LEGACY_STORE_INTERNAL_PREFIX.length);
      _Store.validateStoreName(storeName);
      this.name = storeName;
    } else {
      _Store.validateStoreName(options.name);
      this.name = SITE_STORE_PREFIX + options.name;
    }
  }
  async delete(key) {
    const res = await this.client.makeRequest({ key, method: "delete", storeName: this.name });
    if (![200, 204, 404].includes(res.status)) {
      throw new BlobsInternalError(res);
    }
  }
  async deleteAll() {
    let totalDeletedBlobs = 0;
    let hasMore = true;
    while (hasMore) {
      const res = await this.client.makeRequest({ method: "delete", storeName: this.name });
      if (res.status !== 200) {
        throw new BlobsInternalError(res);
      }
      const data = await res.json();
      if (typeof data.blobs_deleted !== "number") {
        throw new BlobsInternalError(res);
      }
      totalDeletedBlobs += data.blobs_deleted;
      hasMore = typeof data.has_more === "boolean" && data.has_more;
    }
    return {
      deletedBlobs: totalDeletedBlobs
    };
  }
  async get(key, options) {
    return withSpan(options?.span, "blobs.get", async (span) => {
      const { consistency, type } = options ?? {};
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.type": type,
        "blobs.method": "GET",
        "blobs.consistency": consistency
      });
      const res = await this.client.makeRequest({
        consistency,
        key,
        method: "get",
        storeName: this.name
      });
      span?.setAttributes({
        "blobs.response.body.size": res.headers.get("content-length") ?? void 0,
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        return null;
      }
      if (res.status !== 200) {
        throw new BlobsInternalError(res);
      }
      if (type === void 0 || type === "text") {
        return res.text();
      }
      if (type === "arrayBuffer") {
        return res.arrayBuffer();
      }
      if (type === "blob") {
        return res.blob();
      }
      if (type === "json") {
        return res.json();
      }
      if (type === "stream") {
        return res.body;
      }
      throw new BlobsInternalError(res);
    });
  }
  async getMetadata(key, options = {}) {
    return withSpan(options?.span, "blobs.getMetadata", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "HEAD",
        "blobs.consistency": options.consistency
      });
      const res = await this.client.makeRequest({
        consistency: options.consistency,
        key,
        method: "head",
        storeName: this.name
      });
      span?.setAttributes({
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        return null;
      }
      if (res.status !== 200 && res.status !== 304) {
        throw new BlobsInternalError(res);
      }
      const etag = res?.headers.get("etag") ?? void 0;
      const metadata = getMetadataFromResponse(res);
      const result = {
        etag,
        metadata
      };
      return result;
    });
  }
  async getWithMetadata(key, options) {
    return withSpan(options?.span, "blobs.getWithMetadata", async (span) => {
      const { consistency, etag: requestETag, type } = options ?? {};
      const headers = requestETag ? { "if-none-match": requestETag } : void 0;
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "GET",
        "blobs.consistency": options?.consistency,
        "blobs.type": type,
        "blobs.request.etag": requestETag
      });
      const res = await this.client.makeRequest({
        consistency,
        headers,
        key,
        method: "get",
        storeName: this.name
      });
      const responseETag = res?.headers.get("etag") ?? void 0;
      span?.setAttributes({
        "blobs.response.body.size": res.headers.get("content-length") ?? void 0,
        "blobs.response.etag": responseETag,
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        return null;
      }
      if (res.status !== 200 && res.status !== 304) {
        throw new BlobsInternalError(res);
      }
      const metadata = getMetadataFromResponse(res);
      const result = {
        etag: responseETag,
        metadata
      };
      if (res.status === 304 && requestETag) {
        return { data: null, ...result };
      }
      if (type === void 0 || type === "text") {
        return { data: await res.text(), ...result };
      }
      if (type === "arrayBuffer") {
        return { data: await res.arrayBuffer(), ...result };
      }
      if (type === "blob") {
        return { data: await res.blob(), ...result };
      }
      if (type === "json") {
        return { data: await res.json(), ...result };
      }
      if (type === "stream") {
        return { data: res.body, ...result };
      }
      throw new Error(`Invalid 'type' property: ${type}. Expected: arrayBuffer, blob, json, stream, or text.`);
    });
  }
  list(options = {}) {
    return withSpan(options.span, "blobs.list", (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.method": "GET",
        "blobs.list.paginate": options.paginate ?? false
      });
      const iterator = this.getListIterator(options);
      if (options.paginate) {
        return iterator;
      }
      return collectIterator(iterator).then(
        (items) => items.reduce(
          (acc, item) => ({
            blobs: [...acc.blobs, ...item.blobs],
            directories: [...acc.directories, ...item.directories]
          }),
          { blobs: [], directories: [] }
        )
      );
    });
  }
  async set(key, data, options = {}) {
    return withSpan(options.span, "blobs.set", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "PUT",
        "blobs.data.size": typeof data == "string" ? data.length : data instanceof Blob ? data.size : data.byteLength,
        "blobs.data.type": typeof data == "string" ? "string" : data instanceof Blob ? "blob" : "arrayBuffer",
        "blobs.atomic": Boolean(options.onlyIfMatch ?? options.onlyIfNew)
      });
      _Store.validateKey(key);
      const conditions = _Store.getConditions(options);
      const res = await this.client.makeRequest({
        conditions,
        body: data,
        key,
        metadata: options.metadata,
        method: "put",
        storeName: this.name
      });
      const etag = res.headers.get("etag") ?? "";
      span?.setAttributes({
        "blobs.response.etag": etag,
        "blobs.response.status": res.status
      });
      if (conditions) {
        return res.status === STATUS_PRE_CONDITION_FAILED ? { modified: false } : { etag, modified: true };
      }
      if (res.status === STATUS_OK) {
        return {
          etag,
          modified: true
        };
      }
      throw new BlobsInternalError(res);
    });
  }
  async setJSON(key, data, options = {}) {
    return withSpan(options.span, "blobs.setJSON", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "PUT",
        "blobs.data.type": "json",
        "blobs.atomic": Boolean(options.onlyIfMatch ?? options.onlyIfNew)
      });
      _Store.validateKey(key);
      const conditions = _Store.getConditions(options);
      const payload = JSON.stringify(data);
      const headers = {
        "content-type": "application/json"
      };
      const res = await this.client.makeRequest({
        conditions,
        body: payload,
        headers,
        key,
        metadata: options.metadata,
        method: "put",
        storeName: this.name
      });
      const etag = res.headers.get("etag") ?? "";
      span?.setAttributes({
        "blobs.response.etag": etag,
        "blobs.response.status": res.status
      });
      if (conditions) {
        return res.status === STATUS_PRE_CONDITION_FAILED ? { modified: false } : { etag, modified: true };
      }
      if (res.status === STATUS_OK) {
        return {
          etag,
          modified: true
        };
      }
      throw new BlobsInternalError(res);
    });
  }
  static formatListResultBlob(result) {
    if (!result.key) {
      return null;
    }
    return {
      etag: result.etag,
      key: result.key
    };
  }
  static getConditions(options) {
    if ("onlyIfMatch" in options && "onlyIfNew" in options) {
      throw new Error(
        `The 'onlyIfMatch' and 'onlyIfNew' options are mutually exclusive. Using 'onlyIfMatch' will make the write succeed only if there is an entry for the key with the given content, while 'onlyIfNew' will make the write succeed only if there is no entry for the key.`
      );
    }
    if ("onlyIfMatch" in options && options.onlyIfMatch) {
      if (typeof options.onlyIfMatch !== "string") {
        throw new Error(`The 'onlyIfMatch' property expects a string representing an ETag.`);
      }
      return {
        onlyIfMatch: options.onlyIfMatch
      };
    }
    if ("onlyIfNew" in options && options.onlyIfNew) {
      if (typeof options.onlyIfNew !== "boolean") {
        throw new Error(
          `The 'onlyIfNew' property expects a boolean indicating whether the write should fail if an entry for the key already exists.`
        );
      }
      return {
        onlyIfNew: true
      };
    }
  }
  static validateKey(key) {
    if (key === "") {
      throw new Error("Blob key must not be empty.");
    }
    if (key.startsWith("/") || key.startsWith("%2F")) {
      throw new Error("Blob key must not start with forward slash (/).");
    }
    if (new TextEncoder().encode(key).length > 600) {
      throw new Error(
        "Blob key must be a sequence of Unicode characters whose UTF-8 encoding is at most 600 bytes long."
      );
    }
  }
  static validateDeployID(deployID) {
    if (!/^\w{1,24}$/.test(deployID)) {
      throw new Error(`'${deployID}' is not a valid Netlify deploy ID.`);
    }
  }
  static validateStoreName(name) {
    if (name.includes("/") || name.includes("%2F")) {
      throw new Error("Store name must not contain forward slashes (/).");
    }
    if (new TextEncoder().encode(name).length > 64) {
      throw new Error(
        "Store name must be a sequence of Unicode characters whose UTF-8 encoding is at most 64 bytes long."
      );
    }
  }
  getListIterator(options) {
    const { client, name: storeName } = this;
    const parameters = {};
    if (options?.prefix) {
      parameters.prefix = options.prefix;
    }
    if (options?.directories) {
      parameters.directories = "true";
    }
    return {
      [Symbol.asyncIterator]() {
        let currentCursor = null;
        let done = false;
        return {
          async next() {
            return withSpan(options?.span, "blobs.list.next", async (span) => {
              span?.setAttributes({
                "blobs.store": storeName,
                "blobs.method": "GET",
                "blobs.list.paginate": options?.paginate ?? false,
                "blobs.list.done": done,
                "blobs.list.cursor": currentCursor ?? void 0
              });
              if (done) {
                return { done: true, value: void 0 };
              }
              const nextParameters = { ...parameters };
              if (currentCursor !== null) {
                nextParameters.cursor = currentCursor;
              }
              const res = await client.makeRequest({
                method: "get",
                parameters: nextParameters,
                storeName
              });
              span?.setAttributes({
                "blobs.response.status": res.status
              });
              let blobs = [];
              let directories = [];
              if (![200, 204, 404].includes(res.status)) {
                throw new BlobsInternalError(res);
              }
              if (res.status === 404) {
                done = true;
              } else {
                const page = await res.json();
                if (page.next_cursor) {
                  currentCursor = page.next_cursor;
                } else {
                  done = true;
                }
                blobs = (page.blobs ?? []).map(_Store.formatListResultBlob).filter(Boolean);
                directories = page.directories ?? [];
              }
              return {
                done: false,
                value: {
                  blobs,
                  directories
                }
              };
            });
          }
        };
      }
    };
  }
};
var getStore = (input, options) => {
  if (typeof input === "string") {
    const contextOverride = options?.siteID && options?.token ? { siteID: options?.siteID, token: options?.token } : void 0;
    const clientOptions = getClientOptions(options ?? {}, contextOverride);
    const client = new Client(clientOptions);
    return new Store({ client, name: input });
  }
  if (typeof input?.name === "string") {
    const { name } = input;
    const contextOverride = input?.siteID && input?.token ? { siteID: input?.siteID, token: input?.token } : void 0;
    const clientOptions = getClientOptions(input, contextOverride);
    if (!name) {
      throw new MissingBlobsEnvironmentError(["name"]);
    }
    const client = new Client(clientOptions);
    return new Store({ client, name });
  }
  if (typeof input?.deployID === "string") {
    const clientOptions = getClientOptions(input);
    const { deployID } = input;
    if (!deployID) {
      throw new MissingBlobsEnvironmentError(["deployID"]);
    }
    const client = new Client(clientOptions);
    return new Store({ client, deployID });
  }
  throw new Error(
    "The `getStore` method requires the name of the store as a string or as the `name` property of an options object"
  );
};

// sync-src.mjs — v12 append-only per-record storage
//
// DESIGN
//   Every record revision is its own immutable blob:  e{N}/r/{id}!{updated}
//   Every photo is its own immutable blob:            e{N}/p/{id}!{photoAt}
//   Deletes are tombstone blobs:                      e{N}/d/{id}!{at}
//   Nothing is ever overwritten or destroyed. Writes cannot conflict, so
//   there is no compare-and-swap on data, no retries, no "busy".
//   The key listing IS the sync manifest: same keys = same data, exactly.
//   "Fresh register" increments the epoch; the old epoch's keys remain
//   untouched forever — that is the archive.
//   The legacy "state" blob is never modified or deleted; it is migrated
//   into per-record keys in background slices.
var sync_src_default = async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  try {
    const store = (function() {
      try { return getStore("trice-shared"); } catch (e) {
        const env = (k) => (globalThis.Netlify && Netlify.env && Netlify.env.get(k)) || (globalThis.process && process.env && process.env[k]) || "";
        const siteID = env("NETLIFY_SITE_ID") || env("SITE_ID");
        const token = env("NETLIFY_BLOBS_TOKEN") || env("NETLIFY_API_TOKEN");
        if (siteID && token) return getStore({ name: "trice-shared", siteID, token });
        const err = new Error("blobs_not_configured"); err.hint = "Netlify Blobs is not active on this site. Add env vars NETLIFY_SITE_ID and NETLIFY_BLOBS_TOKEN then redeploy."; throw err;
      }
    })();
    const V = "12.0";
    const T0 = Date.now();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const safeGetJSON = async (k) => { try { return await store.get(k, { type: "json", consistency: "strong" }); } catch (e) { return null; } };
    const safeGetText = async (k) => { try { return await store.get(k, { consistency: "strong" }); } catch (e) { return null; } };

    // ---- epoch ----
    const getEpoch = async () => (await safeGetJSON("meta/epoch")) || { n: 1, at: 0 };
    const EP = await getEpoch();
    const PRE = "e" + EP.n + "/";

    // ---- tiny LWW meta maps (parents, users, projects) with light CAS ----
    const metaMerge = async (key, mergeFn) => {
      for (let a = 0; a < 5; a++) {
        let res = null;
        try { res = await store.getWithMetadata(key, { type: "json", consistency: "strong" }); } catch (e) { res = null; }
        const cur = (res && res.data) || {};
        const { next, changed } = mergeFn(JSON.parse(JSON.stringify(cur)));
        if (!changed) return cur;
        const opts = res && res.etag ? { onlyIfMatch: res.etag } : { onlyIfNew: true };
        let w = null;
        try { w = await store.setJSON(key, next, opts); } catch (e) { w = { modified: false }; }
        if (!w || w.modified !== false) return next;
        await sleep(40 * (a + 1) + Math.floor(Math.random() * 60));
      }
      return null;
    };

    // ---- key listing: newest revision per id, tombstones, counts ----
    const listAll = async () => {
      const recs = {};   // id -> {u: newest updated, k: key}
      const dels = {};   // id -> at
      const photos = {}; // id -> newest photo key
      const { blobs } = await store.list({ prefix: PRE });
      for (const b of blobs) {
        const k = b.key;
        const rest = k.slice(PRE.length);
        const bang = rest.lastIndexOf("!");
        if (bang < 2) continue;
        const kind = rest.slice(0, 2);
        const id = rest.slice(2, bang);
        const st = parseInt(rest.slice(bang + 1), 10) || 0;
        if (kind === "r/") { if (!recs[id] || st > recs[id].u) recs[id] = { u: st, k }; }
        else if (kind === "d/") { if (!dels[id] || st > dels[id]) dels[id] = st; }
        else if (kind === "p/") { if (!photos[id] || st > (parseInt(photos[id].slice(photos[id].lastIndexOf("!") + 1), 10) || 0)) photos[id] = k; }
      }
      // a tombstone newer than the newest revision hides the record
      const live = {};
      for (const [id, r] of Object.entries(recs)) { if (!dels[id] || dels[id] < r.u) live[id] = r; }
      return { live, dels, photos, all: recs };
    };

    // ---- background migration of the legacy single-blob state (never deletes it) ----
    const migrateSlice = async () => {
      const mig = (await safeGetJSON("meta/mig")) || { done: false, i: 0 };
      if (mig.done) return;
      const state = await safeGetJSON("state");
      if (!state || !state.trees) { await store.setJSON("meta/mig", { done: true, i: 0, at: Date.now(), note: "no legacy state" }); return; }
      const entries = Object.entries(state.trees);
      let i = mig.i, moved = 0;
      while (i < entries.length && moved < 6 && Date.now() - T0 < 6000) {
        const [id, t] = entries[i];
        const u = t.updated || t.syncedAt || 1;
        const meta = Object.assign({}, t); delete meta.photo;
        meta.photoAt = meta.photoAt || (t.photo ? u : 0);
        try {
          await store.setJSON(PRE + "r/" + id + "!" + u, meta);
          if (t.photo) { try { const has = await store.get(PRE + "p/" + id + "!" + meta.photoAt); if (!has) await store.set(PRE + "p/" + id + "!" + meta.photoAt, t.photo); } catch (e) { await store.set(PRE + "p/" + id + "!" + meta.photoAt, t.photo); } }
        } catch (e) { break; }
        i++; moved++;
      }
      if (i >= entries.length) {
        for (const [id, at] of Object.entries(state.deletes || {})) { try { await store.setJSON(PRE + "d/" + id + "!" + (at || 1), { at: at || 1 }); } catch (e) {} }
        await metaMerge("meta/parents", (cur) => {
          let changed = false;
          const src = state.projectParents2 || {};
          for (const [c, e] of Object.entries(src)) { if (!cur[c] || (e.at || 0) > (cur[c].at || 0)) { cur[c] = e; changed = true; } }
          for (const [c, p] of Object.entries(state.projectParents || {})) { if (!cur[c]) { cur[c] = { p, at: 1 }; changed = true; } }
          return { next: cur, changed };
        });
        await metaMerge("meta/users", (cur) => { let ch = false; for (const [n, u] of Object.entries(state.users || {})) { if (!cur[n]) { cur[n] = u; ch = true; } } return { next: cur, changed: ch }; });
        await metaMerge("meta/projects", (cur) => {
          cur.names = cur.names || {}; cur.deleted = cur.deleted || {};
          let ch = false;
          for (const [n, ts] of Object.entries(state.projects || {})) { if (!cur.names[n]) { cur.names[n] = ts || 1; ch = true; } }
          for (const [n, ts] of Object.entries(state.projectDeletes || {})) { if (!cur.deleted[n]) { cur.deleted[n] = ts || 1; ch = true; } }
          return { next: cur, changed: ch };
        });
        if (!EP.at && state.resetAt) { try { await store.setJSON("meta/epoch", { n: EP.n, at: state.resetAt }); } catch (e) {} }
        await store.setJSON("meta/mig", { done: true, i, at: Date.now(), migrated: entries.length });
      } else {
        await store.setJSON("meta/mig", { done: false, i, at: Date.now() });
      }
    };

    const metaBundle = async (live) => {
      const parents = (await safeGetJSON("meta/parents")) || {};
      const users = (await safeGetJSON("meta/users")) || {};
      const proj = (await safeGetJSON("meta/projects")) || { names: {}, deleted: {} };
      const names = new Set(Object.keys(proj.names || {}));
      const flat = {}; for (const [c, e] of Object.entries(parents)) { if (e && e.p) flat[c] = e.p; }
      return {
        projects: [...names].filter((n) => !(proj.deleted || {})[n]),
        deletedProjects: Object.keys(proj.deleted || {}),
        archivedProjects: Object.keys(proj.archived || {}),
        projectParents: flat, projectParents2: parents,
        users: Object.keys(users), usersMeta: Object.values(users)
      };
    };

    // =================== GET ===================
    if (req.method !== "POST") {
      const url = new URL(req.url);
      const ph = url.searchParams.get("photo");
      if (ph && /^e\d+\/p\/[A-Za-z0-9_.:-]+![0-9]+$/.test(ph)) {
        const data = await safeGetText(ph);
        if (data == null) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: cors });
        return new Response(JSON.stringify({ key: ph, photo: data }), { headers: cors });
      }
      if (url.searchParams.get("list") === "backups") {
        const out = [];
        for (let n = 1; n < EP.n; n++) out.push("epoch-" + n);
        try { const { blobs } = await store.list(); for (const bb of blobs) { if (/^(backup|archive)-/.test(bb.key)) out.push(bb.key); } } catch (e) {}
        return new Response(JSON.stringify({ v: V, backups: out, epoch: EP.n }), { headers: cors });
      }
      const dl = url.searchParams.get("download");
      if (dl && /^epoch-\d+$/.test(dl)) {
        const n = parseInt(dl.slice(6), 10);
        const pre2 = "e" + n + "/";
        const { blobs } = await store.list({ prefix: pre2 });
        const newest = {};
        for (const b of blobs) { const rest = b.key.slice(pre2.length); if (!rest.startsWith("r/")) continue; const bang = rest.lastIndexOf("!"); const id = rest.slice(2, bang); const st = parseInt(rest.slice(bang + 1), 10) || 0; if (!newest[id] || st > newest[id].u) newest[id] = { u: st, k: b.key }; }
        const trees = {};
        for (const [id, r] of Object.entries(newest)) { const t = await safeGetJSON(r.k); if (t) trees[id] = t; if (Date.now() - T0 > 8000) break; }
        return new Response(JSON.stringify({ at: Date.now(), epoch: n, trees, note: "Metadata register for this archived epoch. Photos remain stored and fetchable individually." }), { headers: cors });
      }
      if (dl && /^(backup|archive)-[A-Za-z0-9_.-]+$/.test(dl)) {
        const snap2 = await safeGetJSON(dl);
        if (!snap2) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: cors });
        return new Response(JSON.stringify(snap2), { headers: cors });
      }
      await migrateSlice();
      const { live } = await listAll();
      const meta = await metaBundle(live);
      return new Response(JSON.stringify({ ok: true, v: V, epoch: EP.n, resetAt: EP.at || 0, assets: Object.keys(live).length, projects: meta.projects, users: meta.users }, null, 1), { headers: cors });
    }

    // =================== POST ===================
    const b = await req.json().catch(() => ({}));

    // fresh register: bump the epoch — the old epoch's keys are the archive
    if (b.reset === true) {
      if (b.resetKey !== "trice-reset-2026") return new Response(JSON.stringify({ error: "refused" }), { status: 403, headers: cors });
      const stamp = Date.now();
      await store.setJSON("meta/epoch", { n: EP.n + 1, at: stamp });
      return new Response(JSON.stringify({ v: V, now: stamp, resetAt: stamp, archived: true, epoch: EP.n + 1, trees: [], deletes: [], projects: [], users: [], usersMeta: [] }), { headers: cors });
    }

    await migrateSlice();

    // shared meta updates ride along with any op
    const applyMeta = async () => {
      if (b.parentsLWW && Object.keys(b.parentsLWW).length) {
        await metaMerge("meta/parents", (cur) => {
          let ch = false;
          for (const [c, e] of Object.entries(b.parentsLWW)) {
            const cn = String(c || "").trim().slice(0, 80);
            if (!cn || !e || typeof e !== "object") continue;
            const pn = e.p ? String(e.p).trim().slice(0, 80) : null;
            const at = +e.at || 0;
            if (!cur[cn] || at > (cur[cn].at || 0)) { cur[cn] = { p: pn, at }; ch = true; }
          }
          return { next: cur, changed: ch };
        });
      }
      if ((b.projects && b.projects.length) || b.dropProject || b.reviveProject || b.archiveProject || b.unarchiveProject) {
        await metaMerge("meta/projects", (cur) => {
          cur.names = cur.names || {}; cur.deleted = cur.deleted || {};
          let ch = false;
          for (const p of b.projects || []) { const n = String(p || "").trim().slice(0, 80); if (n && !cur.names[n] && !cur.deleted[n]) { cur.names[n] = Date.now(); ch = true; } }
          cur.archived = cur.archived || {};
          if (b.reviveProject) { const rn = String(b.reviveProject).trim().slice(0, 80); if (rn && cur.deleted[rn]) { delete cur.deleted[rn]; ch = true; } }
          if (b.dropProject) { const dn = String(b.dropProject).trim().slice(0, 80); if (dn && cur.names[dn]) { delete cur.names[dn]; cur.deleted[dn] = Date.now(); delete cur.archived[dn]; ch = true; } }
          if (b.archiveProject) { const an = String(b.archiveProject).trim().slice(0, 80); if (an && cur.names[an] && !cur.archived[an]) { cur.archived[an] = Date.now(); ch = true; } }
          if (b.unarchiveProject) { const un2 = String(b.unarchiveProject).trim().slice(0, 80); if (un2 && cur.archived[un2]) { delete cur.archived[un2]; ch = true; } }
          return { next: cur, changed: ch };
        });
      }
      const lwwMap = async (key, incoming, mapEntry) => {
        if (!incoming || !Object.keys(incoming).length) return;
        await metaMerge(key, (cur) => {
          let ch = false;
          for (const [k0, e0] of Object.entries(incoming)) {
            const kk = String(k0 || "").trim().slice(0, 120);
            if (!kk || !e0 || typeof e0 !== "object") continue;
            const at = +e0.at || 0;
            if (!cur[kk] || at > (cur[kk].at || 0)) { cur[kk] = mapEntry(e0, cur[kk]); cur[kk].at = at; ch = true; }
          }
          return { next: cur, changed: ch };
        });
      };
      await lwwMap("meta/users", b.empLWW, (e, cur) => Object.assign({}, cur || {}, {
        name: String(e.name || "").slice(0, 60), role: String(e.role || "").slice(0, 60),
        cert: String(e.cert || "").slice(0, 40), phone: String(e.phone || "").slice(0, 30),
        email: String(e.email || "").slice(0, 80), rate: +e.rate || 0, active: e.active !== false
      }));
      await lwwMap("meta/assign", b.assignLWW, (e) => ({
        user: String(e.user || "").slice(0, 60), project: String(e.project || "").slice(0, 80),
        date: String(e.date || "").slice(0, 10), note: String(e.note || "").slice(0, 200), del: e.del === true
      }));
      await lwwMap("meta/hours", b.hoursLWW, (e) => ({
        user: String(e.user || "").slice(0, 60), project: String(e.project || "").slice(0, 80),
        date: String(e.date || "").slice(0, 10), hours: Math.max(0, Math.min(24, +e.hours || 0)),
        note: String(e.note || "").slice(0, 200), approved: e.approved === true, del: e.del === true
      }));
      if (b.user && typeof b.user === "string") {
        const un = b.user.trim().slice(0, 60);
        if (un) await metaMerge("meta/users", (cur) => { const u = cur[un] || { name: un, created: Date.now() }; const stale = !cur[un] || Date.now() - (u.lastSeen || 0) > 30000; u.lastSeen = Date.now(); cur[un] = u; return { next: cur, changed: stale }; });
      }
      if (b.dropUser && typeof b.dropUser === "string") {
        const dn = b.dropUser.trim().slice(0, 60);
        if (dn) await metaMerge("meta/users", (cur) => { if (cur[dn]) { delete cur[dn]; return { next: cur, changed: true }; } return { next: cur, changed: false }; });
      }
    };

    // ---- put: append-only writes, no read-modify-write, cannot conflict ----
    if (b.op === "put") {
      await applyMeta();
      const saved = [], savedPhotos = [];
      for (const t of b.recs || []) {
        if (!t || !t.id || !/^[A-Za-z0-9_.:-]{1,64}$/.test(String(t.id))) continue;
        const u = +t.updated || Date.now();
        const meta = Object.assign({}, t); delete meta.photo;
        try { await store.setJSON(PRE + "r/" + t.id + "!" + u, meta); saved.push(t.id); } catch (e) {}
      }
      for (const [id, obj] of Object.entries(b.photos || {})) {
        if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(String(id)) || !obj || typeof obj.data !== "string") continue;
        const at = +obj.at || Date.now();
        try { await store.set(PRE + "p/" + id + "!" + at, obj.data); savedPhotos.push(id); } catch (e) {}
      }
      for (const d of b.dels || []) {
        const id = typeof d === "string" ? d : d && d.id;
        if (!id || !/^[A-Za-z0-9_.:-]{1,64}$/.test(String(id))) continue;
        try { await store.setJSON(PRE + "d/" + id + "!" + Date.now(), { at: Date.now() }); } catch (e) {}
      }
      return new Response(JSON.stringify({ v: V, now: Date.now(), ok: true, saved, savedPhotos }), { headers: cors });
    }

    // ---- list: the manifest — same keys on two devices means identical data ----
    if (b.op === "list" || b.push !== void 0 || b.since !== void 0) {
      await applyMeta();
      // legacy v11 clients: accept their pushed records so nothing waits on the app update
      if (Array.isArray(b.push) && b.push.length) {
        for (const t of b.push) {
          if (!t || !t.id || !/^[A-Za-z0-9_.:-]{1,64}$/.test(String(t.id))) continue;
          const u = +t.updated || Date.now();
          const meta = Object.assign({}, t); delete meta.photo;
          meta.photoAt = meta.photoAt || (t.photo ? u : 0);
          try {
            await store.setJSON(PRE + "r/" + t.id + "!" + u, meta);
            if (t.photo) await store.set(PRE + "p/" + t.id + "!" + meta.photoAt, t.photo);
          } catch (e) {}
        }
        for (const d of b.deletes || []) { const id = typeof d === "string" ? d : d && d.id; if (id && /^[A-Za-z0-9_.:-]{1,64}$/.test(String(id))) { try { await store.setJSON(PRE + "d/" + id + "!" + Date.now(), { at: Date.now() }); } catch (e) {} } }
      }
      const { live, dels, photos } = await listAll();
      const meta = await metaBundle(live);
      const mig = (await safeGetJSON("meta/mig")) || { done: false };
      const ids = Object.entries(live).map(([id, r]) => [id, r.u, photos[id] || null]);
      const assign = (await safeGetJSON("meta/assign")) || {};
      const hours = (await safeGetJSON("meta/hours")) || {};
      return new Response(JSON.stringify(Object.assign({ assign, hours,
        v: V, now: Date.now(), epoch: EP.n, resetAt: EP.at || 0,
        assets: ids.length, ids, dels: Object.entries(dels).map(([id, at]) => [id, at]),
        migrating: !mig.done,
        trees: [], deletes: [], more: false
      }, meta)), { headers: cors });
    }

    // ---- get: fetch record metadata by key, size-capped with a pending remainder ----
    if (b.op === "get" && Array.isArray(b.keys)) {
      const CAP = 3500000;
      const out = []; let sz = 0; let cut = b.keys.length;
      for (let i = 0; i < b.keys.length; i++) {
        const k = String(b.keys[i] || "");
        if (!/^e\d+\/r\/[A-Za-z0-9_.:-]+![0-9]+$/.test(k)) continue;
        const t = await safeGetJSON(k);
        if (!t) continue;
        const len = JSON.stringify(t).length;
        if (out.length && sz + len > CAP) { cut = i; break; }
        t.__key = k; out.push(t); sz += len;
        if (Date.now() - T0 > 8000) { cut = i + 1; break; }
      }
      const pending = b.keys.slice(cut === b.keys.length ? b.keys.length : cut);
      return new Response(JSON.stringify({ v: V, now: Date.now(), trees: out, pending }), { headers: cors });
    }

    return new Response(JSON.stringify({ v: V, error: "unknown op" }), { status: 400, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: "store unavailable", reason: String((e && e.message) || e), hint: (e && e.hint) || "If reason mentions environment/credentials: add NETLIFY_SITE_ID and NETLIFY_BLOBS_TOKEN env vars in Netlify, then redeploy." }), { status: 503, headers: cors });
  }
};
export {
  sync_src_default as default
};
