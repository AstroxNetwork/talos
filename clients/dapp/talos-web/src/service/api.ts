import { nextId, RequestOptions, ToResult } from '@wizz-btc/api';
import to from 'await-to-js';

export class BaseApi {
  endpoint: string;
  options?: RequestInit;
  jwt?: string;

  constructor(endpoint: string, options?: RequestInit) {
    this.endpoint = endpoint;
    this.options = options;
  }

  public setJWT(jwt?: string) {
    this.jwt = jwt;
    return this;
  }

  _fetch<T>(path: string, options?: RequestOptions<any>): Promise<ToResult<T>> {
    options = {
      ...this.options,
      ...options,
    };
    if (!options.headers) {
      options.headers = {};
    }
    options.headers['Content-Type'] = 'application/json';
    if (this.jwt) {
      options.headers['Authorization'] = `Bearer ${this.jwt}`;
    }
    const query = new URLSearchParams({
      ...options.params,
      _: nextId().toString(),
    }).toString();
    let url: string;
    if (/.+\?.*/.test(path)) {
      url = `${path}&${query}`;
    } else {
      url = `${path}?${query}`;
    }
    if (!path.startsWith('http')) {
      url = `${this.endpoint}${url}`;
    }
    return to(
      fetch(url, {
        ...options,
        body: options.data
          ? typeof options.data === 'string'
            ? options.data
            : JSON.stringify(options.data)
          : undefined,
      }).then(async (res) => {
        if (res.status != 200) {
          throw Error(await res.text());
        }
        if (res.headers.get('Content-Type')?.includes('application/json')) {
          return res.json();
        }
        return res.text();
      }),
    );
  }
}
