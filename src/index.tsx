import React, {Component} from "react";
import {Image, ImageProperties, ImageURISource, Platform} from "react-native";
import RNFetchBlob from "react-native-fetch-blob";
const SHA1 = require("crypto-js/sha1");

const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
const BASE_DIR = RNFetchBlob.fs.dirs.CacheDir + "/react-native-img-cache";
const FILE_PREFIX = Platform.OS === "ios" ? "" : "file://";
export type CacheHandler = (path: string) => void;

export interface CachedImageURISource extends ImageURISource {
    uri: string;
    dbPath: string;
    dbProvider: () => {};
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

    private getPath(dbPath: string, immutable?: boolean): string {
      let path = dbPath.substring(dbPath.lastIndexOf("/"));
      const terms = dbPath.split("/");
      const toEncode = terms[terms.length-2];
      const ext = path.indexOf(".") === -1 ? ".jpg" : path.substring(path.indexOf("."));
      if (immutable === true) {
          return BASE_DIR + "/" + SHA1(toEncode) + ext;
      }
      else {
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

    private cache: { [dbPath: string]: CacheEntry } = {};

    clear() {
        this.cache = {};
        return RNFetchBlob.fs.unlink(BASE_DIR);
    }

    on(source: CachedImageURISource, handler: CacheHandler, immutable?: boolean) {
        console.log('ImageCache Operations on...')
        const {dbPath, dbProvider} = source;
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
        } else {
          this.cache[dbPath].handlers.push(handler);
          this.get(dbPath);
        }
    }

    dispose(dbPath: string, handler: CacheHandler) {
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

    private download(cache: CacheEntry) {
        const { source } = cache;
        const { dbPath, dbProvider } = source;
        dbProvider.getInstance().firebase.storage()
        .ref(dbPath)
        .getDownloadURL().then((uri : string) => {
          if (!cache.downloading) {
              console.log('downloading...', source)
              const path = this.getPath(dbPath, cache.immutable);
              cache.downloading = true;
              const method = source.method ? source.method : "GET";
              cache.task = RNFetchBlob.config({ path }).fetch(method, uri, source.headers);
              cache.task.then(() => {
                  console.log('download finished...')
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
          console.log('Error retriveing download URL : ', err)
        })

    }

    private get(dbPath: string) {
        const cache = this.cache[dbPath];
        if (cache.path) {
            // We check here if IOS didn't delete the cache content
            RNFetchBlob.fs.exists(cache.path).then((exists: boolean) => {
                if (exists) {
                    this.notify(dbPath);
                } else {
                    this.download(cache);
                }
            });
        } else {
            this.download(cache);
        }

    }

    private notify(dbPath: string) {
        const handlers = this.cache[dbPath].handlers;
        handlers.forEach(handler => {
            handler(this.cache[dbPath].path as string);
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

    private dbPath: string;

    private handler: CacheHandler = (path: string) => {
        this.setState({ path });
    }

    constructor() {
        super();
        this.state = { path: undefined };
    }

    private dispose() {
        if (this.dbPath) {
            ImageCache.get().dispose(this.dbPath, this.handler);
        }
    }

    private observe(source: CachedImageURISource, mutable: boolean) {
        if (source.dbPath !== this.dbPath) {
            this.dispose();
            this.dbPath = source.dbPath;
            ImageCache.get().on(source, this.handler, !mutable);
        }
    }

    protected getProps() {
        const props: any = {};
        Object.keys(this.props).forEach(prop => {
            if (prop === "source" && (this.props as any).source.dbPath) {
                props["source"] = this.state.path ? { dbPath: this.props.source.dbPath, dbProvider: this.props.source.dbProvider, uri: FILE_PREFIX + this.state.path } : {};
            }
            else if (["mutable", "component"].indexOf(prop) === -1) {
                props[prop] = (this.props as any)[prop];
            }
        });
        return props;
    }


    private checkSource(source: ImageURISource | ImageURISource[]): ImageURISource {
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
        if (source.dbPath) {
            this.observe(source as CachedImageURISource, mutable === true);
        }
    }

    componentWillReceiveProps(nextProps: P) {
        const {mutable} = nextProps;
        const source = this.checkSource(nextProps.source);
        if (source.dbPath) {
            this.observe(source as CachedImageURISource, mutable === true);
        }
    }

    componentWillUnmount() {
        this.dispose();
    }
}

export class CachedImage extends BaseCachedImage<CachedImageProps> {

    constructor() {
        super();
    }

    render() {
        const props = this.getProps();
        return <Image {...props}>{this.props.children}</Image>;
    }
}

export class CustomCachedImage<P extends CustomCachedImageProps> extends BaseCachedImage<P> {

    constructor() {
        super();
    }

    render() {
        const {component} = this.props;
        const props = this.getProps();
        const Component = component;
        return <Component {...props}>{this.props.children}</Component>;
    }
}
