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

// sync-src.mjs
var sync_src_default = async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  try {
    const store = (function() {
      try { return getStore("trice-shared"); } catch (e) {
        const env = (k) => (globalThis.Netlify && Netlify.env && Netlify.env.get(k)) || (globalThis.process && process.env && process.env[k]) || "";
        const siteID = env("NETLIFY_SITE_ID") || env("SITE_ID");
        const token = env("NETLIFY_BLOBS_TOKEN") || env("NETLIFY_API_TOKEN");
        if (siteID && token) return getStore({ name: "trice-shared", siteID, token });
        const err = new Error("blobs_not_configured"); err.hint = "Netlify Blobs is not active on this site. Add env vars NETLIFY_SITE_ID (Site settings → General → Site ID) and NETLIFY_BLOBS_TOKEN (a personal access token from app.netlify.com/user/applications) then redeploy."; throw err;
      }
    })();
    const freshState = () => ({ trees: {}, deletes: {}, projects: {}, users: {}, resetAt: 0 });
    const T0 = Date.now();
    const BUDGET = 6500;
    const overBudget = () => Date.now() - T0 > BUDGET;
    const busyNow = () => new Response(JSON.stringify({ error: "busy", where: "storage-slow", elapsed: Date.now() - T0 }), { status: 503, headers: cors });
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const jitter = (a) => 60 * (a + 1) + Math.floor(Math.random() * 120);
    const read = async () => {
      let res = null;
      for (let ra = 0; ra < 2 && !res && !overBudget(); ra++) {
        try { res = await store.getWithMetadata("state", { type: "json", consistency: "strong" }); } catch (e) { res = null; if (ra < 2) await sleep(jitter(ra)); }
      }
      const state = (res && res.data) || freshState();
      state.trees = state.trees || {}; state.deletes = state.deletes || {}; state.projects = state.projects || {}; state.users = state.users || {};
      return { state, etag: res && res.etag };
    };
    const write = async (state, etag) => {
      const opts = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
      let r = null;
      try { r = await store.setJSON("state", state, opts); } catch (e) { return false; }
      return !r || r.modified !== false;
    };
    if (req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      if (b.reset === true && b.resetKey !== "trice-reset-2026") { /* legacy client reset attempt — refused */ }
      else if (b.reset === true) {
        const stamp = Date.now();
        for (let a = 0; a < 6; a++) {
          if (overBudget()) return busyNow();
          if (a > 0) await sleep(jitter(a));
          const { state, etag } = await read();
          if (Object.keys(state.trees).length) await store.setJSON("archive-" + stamp, state);
          const next = { trees: {}, deletes: {}, projects: {}, users: state.users, resetAt: stamp };
          if (await write(next, etag)) return new Response(JSON.stringify({ now: stamp, resetAt: stamp, trees: [], deletes: [], projects: [], users: Object.keys(next.users), usersMeta: Object.values(next.users), archived: true }), { headers: cors });
        }
        return new Response(JSON.stringify({ error: "busy" }), { status: 503, headers: cors });
      }
      if (b.op === "manifest") {
        const { state: st } = await read();
        const ids = Object.values(st.trees).map((t) => [t.id, t.updated || 0]);
        return new Response(JSON.stringify({ v: "11.7", now: Date.now(), resetAt: st.resetAt || 0, assets: ids.length, ids, deletes: Object.keys(st.deletes || {}) }), { headers: cors });
      }
      if (Array.isArray(b.need)) {
        const { state: st } = await read();
        const CAPN = 3500000;
        const out = []; let sz = 0; let cut = b.need.length;
        for (let i = 0; i < b.need.length; i++) {
          const t = st.trees[b.need[i]];
          if (!t) continue;
          const len = JSON.stringify(t).length;
          if (out.length && sz + len > CAPN) { cut = i; break; }
          out.push(t); sz += len;
        }
        const pending = b.need.slice(cut === b.need.length ? b.need.length : cut);
        return new Response(JSON.stringify({ v: "11.7", now: Date.now(), trees: out, pending, assets: Object.keys(st.trees).length }), { headers: cors });
      }
      let state = freshState();
      for (let a = 0; a < 10; a++) {
        if (overBudget()) return busyNow();
        if (a > 0) await sleep(jitter(a));
        const r0 = await read();
        state = r0.state;
        let changed = false;
        for (const t0 of Object.values(state.trees)) { if (!t0.syncedAt) { t0.syncedAt = Date.now(); changed = true; } }
        for (const t of b.push || []) {
          if (!t || !t.id) continue;
          const cur = state.trees[t.id];
          if (!cur || (t.updated || 0) >= (cur.updated || 0)) { t.syncedAt = Date.now(); state.trees[t.id] = t; changed = true; }
          if (state.deletes[t.id]) { delete state.deletes[t.id]; changed = true; }
        }
        for (const d of b.deletes || []) {
          const id = typeof d === "string" ? d : d && d.id;
          if (!id) continue;
          if (!state.deletes[id]) changed = true;
          state.deletes[id] = Date.now();
          if (state.trees[id]) { delete state.trees[id]; changed = true; }
        }
        state.projectDeletes = state.projectDeletes || {};
        if (b.reviveProject) { const rn = String(b.reviveProject).trim().slice(0, 80); if (rn && state.projectDeletes[rn]) { delete state.projectDeletes[rn]; changed = true; } }
        for (const p of b.projects || []) {
          const n = String(p || "").trim().slice(0, 80);
          if (n && !state.projects[n] && !state.projectDeletes[n]) { state.projects[n] = Date.now(); changed = true; }
        }
        state.projectParents = state.projectParents || {};
        if (!state.projectParents2) {
          state.projectParents2 = {};
          for (const [c0, p0] of Object.entries(state.projectParents)) state.projectParents2[c0] = { p: p0, at: 1 };
          if (Object.keys(state.projectParents2).length) changed = true;
        }
        for (const [c1, e1] of Object.entries(b.parentsLWW || {})) {
          const cn1 = String(c1 || "").trim().slice(0, 80);
          if (!cn1 || !e1 || typeof e1 !== "object") continue;
          const pn1 = e1.p ? String(e1.p).trim().slice(0, 80) : null;
          const at1 = +e1.at || 0;
          const cur1 = state.projectParents2[cn1];
          if (!cur1 || at1 > (cur1.at || 0)) { state.projectParents2[cn1] = { p: pn1, at: at1 }; changed = true; }
        }
        if (b.setParent && b.setParent.child) {
          const ch = String(b.setParent.child).trim().slice(0, 80);
          const pa = b.setParent.parent ? String(b.setParent.parent).trim().slice(0, 80) : null;
          if (state.projects[ch] === void 0) return new Response(JSON.stringify({ error: "unknown project", reason: "The server does not know a project named \"" + ch + "\" — sync first, then retry" }), { status: 409, headers: cors });
          if (pa !== null && state.projects[pa] === void 0) return new Response(JSON.stringify({ error: "unknown project", reason: "The server does not know a main project named \"" + pa + "\"" }), { status: 409, headers: cors });
          if (state.projects[ch] !== void 0) {
            if (pa === null) { if (state.projectParents[ch]) { delete state.projectParents[ch]; changed = true; } }
            else if (state.projects[pa] !== void 0 && pa !== ch) {
              let cur = pa, guard = 0, cycle = false;
              while (cur && guard++ < 12) { if (cur === ch) { cycle = true; break; } cur = state.projectParents[cur] || null; }
              if (cycle) return new Response(JSON.stringify({ error: "cycle", reason: "That would nest a project under its own sub-project" }), { status: 409, headers: cors });
              if (state.projectParents[ch] !== pa) { state.projectParents[ch] = pa; changed = true; }
            }
          }
        }
        if (b.dropProject) {
          const dn = String(b.dropProject).trim().slice(0, 80);
          if (dn && state.projects[dn] !== void 0) {
            const inUse = Object.values(state.trees).filter((t) => (t.site || "") === dn || (t.project || "") === dn).length;
            if (inUse > 0) return new Response(JSON.stringify({ error: "in use", trees: inUse }), { status: 409, headers: cors });
            if (Object.values(state.projectParents || {}).includes(dn)) return new Response(JSON.stringify({ error: "has subs" }), { status: 409, headers: cors });
            delete state.projects[dn]; if ((state.projectParents || {})[dn]) delete state.projectParents[dn]; state.projectDeletes[dn] = Date.now(); changed = true;
          }
        }
        if (b.user && typeof b.user === "string") {
          const un = b.user.trim().slice(0, 60);
          if (un) { const u = state.users[un] || { name: un, created: Date.now() }; if (!state.users[un] || (Date.now() - (u.lastSeen || 0)) > 3e4) changed = true; u.lastSeen = Date.now(); state.users[un] = u; }
        }
        if (b.dropUser && typeof b.dropUser === "string") {
          const dn = b.dropUser.trim().slice(0, 60);
          if (dn && state.users[dn]) { delete state.users[dn]; changed = true; }
        }
        if (!changed) break;
        const __day = new Date().toISOString().slice(0, 10);
        if (state._backupDay !== __day) {
          state._backupDay = __day;
          try { await store.setJSON("backup-" + __day, { at: Date.now(), trees: state.trees, deletes: state.deletes, projects: state.projects }); } catch (e) {}
        }
        if (await write(state, r0.etag)) break;
        if (a === 9) return new Response(JSON.stringify({ error: "busy", where: "write-contention", attempts: 10 }), { status: 503, headers: cors });
      }
      const since = b.since || 0;
      const sinceId = typeof b.sinceId === "string" ? b.sinceId : "";
      const stamp2 = (t) => t.syncedAt || t.updated || 0;
      const all2 = Object.values(state.trees).filter((t) => stamp2(t) > since || (sinceId && stamp2(t) === since && String(t.id) > sinceId));
      all2.sort((x, y) => (stamp2(x) - stamp2(y)) || (String(x.id) < String(y.id) ? -1 : 1));
      const CAP2 = 3500000;
      const trees = []; let sz2 = 0; let more = false; let next = since; let nextId = sinceId;
      for (const t of all2) {
        const len = JSON.stringify(t).length;
        if (trees.length && sz2 + len > CAP2) { more = true; break; }
        trees.push(t); sz2 += len; next = stamp2(t); nextId = String(t.id);
      }
      const deletes = Object.entries(state.deletes).filter(([, ts]) => ts > since).map(([id]) => id);
      const pp2 = state.projectParents2 || {};
      const ppFlat = {}; for (const [c9, e9] of Object.entries(pp2)) { if (e9 && e9.p) ppFlat[c9] = e9.p; }
      return new Response(JSON.stringify({ v: "11.7", now: Date.now(), resetAt: state.resetAt || 0, trees, deletes, more, next, nextId, assets: Object.keys(state.trees).length, projects: Object.keys(state.projects), deletedProjects: Object.keys(state.projectDeletes || {}), projectParents: ppFlat, projectParents2: pp2, users: Object.keys(state.users), usersMeta: Object.values(state.users) }), { headers: cors });
    }
    const { state } = await read();
    const __url = new URL(req.url);
    if (__url.searchParams.get("list") === "backups") {
      const out = [];
      try { const { blobs } = await store.list(); for (const bb of blobs) { if (/^(backup|archive)-/.test(bb.key)) out.push(bb.key); } } catch (e) {}
      out.sort().reverse();
      return new Response(JSON.stringify({ backups: out }), { headers: cors });
    }
    const __dl = __url.searchParams.get("download");
    if (__dl && /^(backup|archive)-[A-Za-z0-9_.-]+$/.test(__dl)) {
      const snap2 = await store.get(__dl, { type: "json" });
      if (!snap2) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: cors });
      return new Response(JSON.stringify(snap2), { headers: cors });
    }
    return new Response(JSON.stringify((() => { const trees = Object.values(state.trees); const byProject = {}; for (const t of trees) { const s = t.site || "Unassigned"; byProject[s] = (byProject[s] || 0) + 1; } const assessors = [...new Set(trees.map((t) => t.surveyor).filter(Boolean))]; const last = trees.reduce((m, t) => Math.max(m, t.updated || 0), 0); return { ok: true, v: "11.7", assets: trees.length, projects: Object.keys(state.projects), users: Object.keys(state.users), byProject, assessors, lastActivity: last ? new Date(last).toISOString() : null, resetAt: state.resetAt || 0 }; })(), null, 1), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: "store unavailable", reason: String((e && e.message) || e), hint: (e && e.hint) || "If reason mentions environment/credentials: add NETLIFY_SITE_ID and NETLIFY_BLOBS_TOKEN env vars in Netlify, then redeploy." }), { status: 503, headers: cors });
  }
};
export {
  sync_src_default as default
};
