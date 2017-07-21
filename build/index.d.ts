/// <reference types="react-native" />
/// <reference types="react" />
import { Component } from "react";
import { ImageProperties, ImageURISource } from "react-native";
export declare type CacheHandler = (path: string) => void;
export interface CachedImageURISource extends ImageURISource {
    uri: string;
    dbPath: string;
    dbProvider: () => {};
}
export declare class ImageCache {
    private getPath(dbPath, immutable?);
    private static instance;
    private constructor();
    static get(): ImageCache;
    private cache;
    clear(): any;
    on(source: CachedImageURISource, handler: CacheHandler, immutable?: boolean): void;
    dispose(dbPath: string, handler: CacheHandler): void;
    private download(cache);
    private get(dbPath);
    private notify(dbPath);
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
export declare abstract class BaseCachedImage<P extends CachedImageProps> extends Component<P, CachedImageState> {
    private dbPath;
    private handler;
    constructor();
    private dispose();
    private observe(source, mutable);
    protected getProps(): any;
    private checkSource(source);
    componentWillMount(): void;
    componentWillReceiveProps(nextProps: P): void;
    componentWillUnmount(): void;
}
export declare class CachedImage extends BaseCachedImage<CachedImageProps> {
    constructor();
    render(): JSX.Element;
}
export declare class CustomCachedImage<P extends CustomCachedImageProps> extends BaseCachedImage<P> {
    constructor();
    render(): JSX.Element;
}
