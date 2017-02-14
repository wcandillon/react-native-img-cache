import React, {Component} from "react";
import {Image} from "react-native";
import {observable, computed} from "mobx";
import {observer} from "mobx-react/native";

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

class CachedImageStore {

    private handler: CacheHandler = (path: string) => {
        this.path = path;
    }

    // Remote URI
    @observable private _uri: string;
    // Local Path
    @observable private _path: string;
    @observable private _mutable: boolean;

    @computed get uri() {
        return this._uri;
    }

    set uri(uri: string) {
        this._uri = uri;
    }

    @computed get path() {
        return this._path;
    }

    set path(path) {
        this._path = path;
    }

    @computed get mutable() {
        return this._mutable;
    }

    set mutable(mutable) {
        this._mutable = mutable;
    }

    setNewImage(uri: string, mutable?: boolean) {
        this.mutable = mutable === true;
        if (uri !== this.uri) {
            this.dispose();
            this.uri = uri;
            ImageCache.getCache().on(uri, this.handler, !this.mutable);
        }
    }

    dispose() {
        if (this.uri) {
            ImageCache.getCache().dispose(this.uri, this.handler);
        }
    }
}

export interface CachedImageProps {
    uri: string;
    style?: React.ImageStyle;
    blurRadius?: number;
    mutable?: boolean;
}

@observer
export class CachedImage extends Component<CachedImageProps, void>  {

    private store: CachedImageStore = new CachedImageStore();

    componentWillMount() {
        const {uri, mutable} = this.props;
        this.store.setNewImage(uri, mutable);
    }

    componentWillReceiveProps(nextProps: CachedImageProps) {
        const {uri, mutable} = nextProps;
        this.store.setNewImage(uri, mutable);
    }

    componentWillUnmount() {
        this.store.dispose();
    }

    render() {
        const {style, blurRadius} = this.props;
        return <Image style={style}
        blurRadius={blurRadius}
        source={{ uri: this.store.path }}>{this.props.children}</Image>;
    }
}

export interface CachedThumbnailProps {
    size?: number;
    style?: React.ImageStyle;
    uri: string;
    mutable?: boolean;
}

@observer
export class CachedThumbnail  extends Component<CachedThumbnailProps, void>  {

    render() {
        const {size, style, uri, mutable} = this.props;
        const thumbnailStyle = {
            width: size ? size : 36,
            height: (this.props.size) ? size : 36,
            borderRadius: this.props.size ? (this.props.size / 2) : 18
        };
        return <CachedImage
            uri={uri}
        style={[thumbnailStyle, style]}
        mutable={mutable} />;
    }
}