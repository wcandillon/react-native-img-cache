import React, {Component} from "react";
import {Image, ImageProperties, ImageURISource, Platform} from "react-native";
import RNFetchBlob from "react-native-fetch-blob";
const SHA1 = require("crypto-js/sha1");

const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
const BASE_DIR = RNFetchBlob.fs.dirs.CacheDir + "/react-native-img-cache";
const FILE_PREFIX = Platform.OS === "ios" ? "" : "file://";
export type CacheHandler = (path: string) => void;

type CacheEntry = {
    downloading: boolean;
    handlers: CacheHandler[];
    path: string | undefined;
    immutable: boolean;
    task?: any;
};

export class ImageCache {

    private getPath(uri: string, immutable?: boolean): string {
        let path = uri.substring(uri.lastIndexOf("/"));
        path = path.indexOf("?") === -1 ? path : path.substring(path.lastIndexOf("."), path.indexOf("?"));
        const ext = path.indexOf(".") === -1 ? ".jpg" : path.substring(path.indexOf("."));
        if (immutable === true) {
            return BASE_DIR + "/" + SHA1(uri) + ext;
        } else {
            return BASE_DIR + "/" + s4() + s4() + "-" + s4() + "-" + s4() + "-" + s4() + "-" + s4() + s4() + s4() + ext;
        }
    }

    private static instance: ImageCache;

    private constructor() {}

    static get(): ImageCache {
        if (!ImageCache.instance) {
            ImageCache.instance = new ImageCache();
        }
        return ImageCache.instance;
    }

    static getCache(): ImageCache {
        return ImageCache.get();
    }

    private cache: { [uri: string]: CacheEntry } = {};

    clear() {
        this.cache = {};
        return RNFetchBlob.fs.unlink(BASE_DIR);
    }

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

    cancel(uri: string) {
        const cache = this.cache[uri];
        if (cache && cache.downloading) {
            cache.task.cancel();
        }
    }

    private download(uri: string, cache: CacheEntry) {
        if (!cache.downloading) {
            const path = this.getPath(uri, cache.immutable);
            cache.downloading = true;
            cache.task = RNFetchBlob.config({ path }).fetch("GET", uri, {});
            cache.task.then(() => {
                cache.downloading = false;
                cache.path = path;
                this.notify(uri);
            }).catch(() => {
                cache.downloading = false;
                // Because of this bug: https://github.com/wkh237/react-native-fetch-blob/issues/331
                RNFetchBlob.fs.unlink(path);
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

export interface CachedImageProps extends ImageProperties {
    mutable?: boolean;
}

export interface CachedImageState {
    path: string | undefined;
}

export class CachedImage extends Component<CachedImageProps, CachedImageState>  {

    private uri: string;

    private handler: CacheHandler = (path: string) => {
        this.setState({ path });
    }

    constructor() {
        super();
        this.state = { path: undefined };
    }

    private dispose() {
        if (this.uri) {
            ImageCache.get().dispose(this.uri, this.handler);
        }
    }

    private observe(uri: string, mutable: boolean) {
        if (uri !== this.uri) {
            this.dispose();
            this.uri = uri;
            ImageCache.get().on(uri, this.handler, !mutable);
        }
    }

    componentWillMount() {
        const {mutable} = this.props;
        const source = this.props.source as ImageURISource;
        this.observe(source.uri as string, mutable === true);
    }

    componentWillReceiveProps(nextProps: CachedImageProps) {
        const {source, mutable} = nextProps;
        this.observe((source as ImageURISource).uri as string, mutable === true);
    }

    componentWillUnmount() {
        this.dispose();
    }

    render() {
        const props: any = {};
        Object.keys(this.props).forEach(prop => {
            if (prop === "source") {
                props.source = this.state.path ? { uri: FILE_PREFIX + this.state.path } : {};
            } else {
                props[prop] = (this.props as any)[prop];
            }
        });
        return <Image {...props}>{this.props.children}</Image>;
    }
}
