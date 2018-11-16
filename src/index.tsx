import React, {Component} from "react";
import {Image, ImageBackground, ImageProperties, ImageURISource, Platform} from "react-native";
import RNFetchBlob from "rn-fetch-blob";
const SHA1 = require("crypto-js/sha1");

const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
const BASE_DIR = RNFetchBlob.fs.dirs.CacheDir + "/react-native-img-cache";
const FILE_PREFIX = Platform.OS === "ios" ? "" : "file://";
export type CacheHandler = (path: string) => void;

export interface CachedImageURISource extends ImageURISource {
    uri: string;
}

type CacheEntry = {
    source: CachedImageURISource;
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

    private cache: { [uri: string]: CacheEntry } = {};

    clear() {
        this.cache = {};
        return RNFetchBlob.fs.unlink(BASE_DIR);
    }

    on(source: CachedImageURISource, handler: CacheHandler, immutable?: boolean) {
        const {uri} = source;
        if (!this.cache[uri]) {
            this.cache[uri] = {
                source,
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

    private download(cache: CacheEntry) {
        const {source} = cache;
        const {uri} = source;
        if (!cache.downloading) {
            const path = this.getPath(uri, cache.immutable);
            cache.downloading = true;
            const method = source.method ? source.method : "GET";
            cache.task = RNFetchBlob.config({ path }).fetch(method, uri, source.headers);
            cache.task.then(() => {
                cache.downloading = false;
                cache.path = path;
                this.notify(uri);
            }).catch(() => {
                cache.downloading = false;
                // Parts of the image may have been downloaded already, (see https://github.com/wkh237/react-native-fetch-blob/issues/331)
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
                    this.download(cache);
                }
            });
        } else {
            this.download(cache);
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

export interface CustomCachedImageProps extends CachedImageProps {
    component: new () => Component<any, any>;
}

export interface CachedImageState {
    path: string | undefined;
}

export abstract class BaseCachedImage<P extends CachedImageProps> extends Component<P, CachedImageState>  {

    private uri: string;

    private handler: CacheHandler = (path: string) => {
        this.setState({ path });
    }

    private dispose() {
        if (this.uri) {
            ImageCache.get().dispose(this.uri, this.handler);
        }
    }

    private observe(source: CachedImageURISource, mutable: boolean) {
        if (source.uri !== this.uri) {
            this.dispose();
            this.uri = source.uri;
            ImageCache.get().on(source, this.handler, !mutable);
        }
    }

    protected getProps() {
        const props: any = {};
        Object.keys(this.props).forEach(prop => {
            if (prop === "source" && (this.props as any).source.uri) {
                props["source"] = this.state.path ? {uri: FILE_PREFIX + this.state.path} : {};
            } else if (["mutable", "component"].indexOf(prop) === -1) {
                props[prop] = (this.props as any)[prop];
            }
        });
        return props;
    }


    private checkSource(source: number | ImageURISource | ImageURISource[]): ImageURISource | number {
        if (Array.isArray(source)) {
            throw new Error(`Giving multiple URIs to CachedImage is not yet supported.
            If you want to see this feature supported, please file and issue at
             https://github.com/wcandillon/react-native-img-cache`);
        }
        return source;
    }

    componentWillMount() {
        const {mutable} = this.props;
        const source = this.checkSource(this.props.source);
        this.setState({ path: undefined });
        if (typeof(source) !== "number" && source.uri) {
            this.observe(source as CachedImageURISource, mutable === true);
        }
    }

    componentWillReceiveProps(nextProps: P) {
        const {mutable} = nextProps;
        const source = this.checkSource(nextProps.source);
        if (typeof(source) !== "number" && source.uri) {
            this.observe(source as CachedImageURISource, mutable === true);
        }
    }

    componentWillUnmount() {
        this.dispose();
    }
}

export class CachedImage extends BaseCachedImage<CachedImageProps> {

    render() {
        const props = this.getProps();
        if (React.Children.count(this.props.children) > 0) {
            console.warn("Using <CachedImage> with children is deprecated, use <CachedImageBackground> instead.");
        }
        return <Image {...props}>{this.props.children}</Image>;
    }
}

export class CachedImageBackground extends BaseCachedImage<CachedImageProps> {

    render() {
        const props = this.getProps();
        return <ImageBackground {...props}>{this.props.children}</ImageBackground>;
    }
}

export class CustomCachedImage<P extends CustomCachedImageProps> extends BaseCachedImage<P> {

    render() {
        const {component} = this.props;
        const props = this.getProps();
        const Component = component;
        return <Component {...props}>{this.props.children}</Component>;
    }
}
