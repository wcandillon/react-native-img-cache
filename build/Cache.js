import RNFetchBlob from "react-native-fetch-blob";
const SHA1 = require("crypto-js/sha1");
const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
const BASE_DIR = RNFetchBlob.fs.dirs.CacheDir + "/image-cache/files";
const QUEUE_DIR = RNFetchBlob.fs.dirs.CacheDir + "/image-cache";
const CACHE_LIMIT_FILE_COUNT = 10;
const FILE_PREFIX = Platform.OS === "ios" ? "" : "file://";

export class ImageCache {

    readInQueue() {
      return new Promise((resolve, reject) => {
        RNFetchBlob.fs.readFile(QUEUE_DIR, 'base64')
        .then((data) => {
            if (exists) {
                this.notify(dbPath);
            }
            else {
                this.download(cache);
            }
        })
        .catch((err) => {
         console.log(err);
        });
      })
    }
    constructor() {
        this.cache = {};
    }
    getPath(dbPath, immutable) {
        let path = dbPath.substring(dbPath.lastIndexOf("/"));
        const terms = dbPath.split("/");
        const toEncode = terms[terms.length - 2];
        const ext = path.indexOf(".") === -1 ? ".jpg" : path.substring(path.indexOf("."));
        if (immutable === true) {
            return BASE_DIR + "/" + SHA1(toEncode) + ext;
        }
        else {
            return BASE_DIR + "/" + s4() + s4() + "-" + s4() + "-" + s4() + "-" + s4() + "-" + s4() + s4() + s4() + ext;
        }
    }
    static load() {
      return new Promise((resolve, reject) => {
        readInQueue
        .then((data) => resolve(data))
        .catch((err) => reject(err))
      })
    }
    static get() {
        if (!ImageCache.instance) {
            ImageCache.instance = new ImageCache();
        }
        return ImageCache.instance;
    }
    clear() {
        this.cache = {};
        return RNFetchBlob.fs.unlink(BASE_DIR);
    }
    on(source, handler, immutable) {
        console.log('ImageCache Operations on...');
        const { dbPath, dbProvider } = source;
        if (!this.cache[dbPath]) {
            console.log('Entry not in application cache');
            this.cache[dbPath] = {
                source: source,
                downloading: false,
                handlers: [handler],
                immutable: immutable === true,
                path: immutable === true ? this.getPath(dbPath, immutable) : undefined
            };
            this.get(dbPath);
        }
        else {

            this.cache[dbPath].handlers.push(handler);
            this.get(dbPath);
        }
    }
    dispose(dbPath, handler) {
        const cache = this.cache[dbPath];
        if (cache) {
            cache.handlers.forEach((h, index) => {
                if (h === handler) {
                    cache.handlers.splice(index, 1);
                }
            });
        }
    }
    // bust(uri: string) {
    //     const cache = this.cache[uri];
    //     if (cache !== undefined && !cache.immutable) {
    //         cache.path = undefined;
    //         this.get(uri);
    //     }
    // }
    //
    // cancel(uri: string) {
    //     const cache = this.cache[uri];
    //     if (cache && cache.downloading) {
    //         cache.task.cancel();
    //     }
    // }
    download(cache) {
        const { source } = cache;
        const { dbPath, dbProvider } = source;
        dbProvider.getInstance().firebase.storage()
            .ref(dbPath)
            .getDownloadURL().then((uri) => {
            if (!cache.downloading) {
                console.log('downloading...', source);
                const path = this.getPath(dbPath, cache.immutable);
                cache.downloading = true;
                const method = source.method ? source.method : "GET";
                cache.task = RNFetchBlob.config({ path }).fetch(method, uri, source.headers);
                cache.task.then(() => {
                    console.log('download finished...');
                    cache.downloading = false;
                    cache.path = path;
                    this.notify(source.dbPath);
                }).catch(() => {
                    cache.downloading = false;
                    // Parts of the image may have been downloaded already, (see https://github.com/wkh237/react-native-fetch-blob/issues/331)
                    RNFetchBlob.fs.unlink(path);
                });
            }
        }).catch(err => {
            console.log('Error retriveing download URL : ', err);
        });
    }
    get(dbPath) {
        const cache = this.cache[dbPath];
        if (cache.path) {
            // We check here if IOS didn't delete the cache content
            RNFetchBlob.fs.exists(cache.path).then((exists) => {
                if (exists) {
                    this.notify(dbPath);
                }
                else {
                    this.download(cache);
                }
            });
        }
        else {
            this.download(cache);
        }
    }
    notify(dbPath) {
        const handlers = this.cache[dbPath].handlers;
        handlers.forEach(handler => {
            handler(this.cache[dbPath].path);
        });
    }
}
