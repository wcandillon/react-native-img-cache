import RNFetchBlob from "react-native-fetch-blob";
const SHA1 = require("crypto-js/sha1");

const dirs = RNFetchBlob.fs.dirs;
const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);

export type CacheHandler = (path: string) => void;

type CacheEntry = {
    downloading: boolean;
    handlers: CacheHandler[];
    path: string | undefined;
    immutable: boolean;
};

export class ImageCache {

    private getPath(uri: string, immutable?: boolean): string {
        if (immutable === true) {
            return dirs.CacheDir + "_immutable_images/" + SHA1(uri) + ".jpg";
        } else {
            return dirs.CacheDir + "/_images" + "/" + s4() + s4() + "-" + s4() + "-" + s4() + "-" + s4() + "-" + s4() + s4() + s4() + ".jpg";
        }
    }

    private static instance: ImageCache;

    private constructor() {}

    static getCache(): ImageCache {
        if (!ImageCache.instance) {
            ImageCache.instance = new ImageCache();
        }
        return ImageCache.instance;
    }

    private cache: { [uri: string]: CacheEntry } = {};

    on(uri: string, handler: CacheHandler, immutable?: boolean) {
        if (!this.cache[uri]) {
            this.cache[uri] = {
                downloading: false,
                handlers: [handler],
                immutable: immutable === true,
                path: immutable === true ? this.getPath(uri, immutable) : undefined
            };
        } else {
            this.cache[uri].handlers.push(handler);
        }
        this.get(uri);
    }

    dispose(uri: string, handler: CacheHandler) {
        const cache = this.cache[uri];
        if (cache) {
            cache.handlers.forEach((h, index) => {
                if (h === handler) {
                    cache.handlers.splice(index, 1);
                }
            });
        }
    }

    bust(uri: string) {
        const cache = this.cache[uri];
        if (cache !== undefined && !cache.immutable) {
            cache.path = undefined;
            this.get(uri);
        }
    }

    private download(uri: string, cache: CacheEntry) {
        if (!cache.downloading) {
            const path = this.getPath(uri, cache.immutable);
            cache.downloading = true;
            RNFetchBlob.config({ path })
                .fetch("GET", uri, {})
                .then(() => {
                    cache.downloading = false;
                    cache.path = path;
                    this.notify(uri);
                });
        }
    }

    private get(uri: string) {
        const cache = this.cache[uri];
        if (cache.path) {
            // We check here if IOS didn't delete the cache content
            RNFetchBlob.fs.exists(cache.path).then((exists: boolean) => {
                if (exists) {
                    this.notify(uri);
                } else {
                    this.download(uri, cache);
                }
            });
        } else {
            this.download(uri, cache);
        }
    }

    private notify(uri: string) {
        const handlers = this.cache[uri].handlers;
        handlers.forEach(handler => {
            handler(this.cache[uri].path as string);
        });
    }
}
