import { Component } from 'react';
import { ImageProperties, ImageURISource } from 'react-native';
export declare type CacheHandler = (path: string) => void;
export interface CachedImageURISource extends ImageURISource {
    uri: string;
}
export declare class ImageCache {
    private getPath;
    private static instance;
    private constructor();
    static get(): ImageCache;
    private cache;
    clear(): any;
    on(source: CachedImageURISource, handler: CacheHandler, immutable?: boolean): void;
    dispose(uri: string, handler: CacheHandler): void;
    bust(uri: string): void;
    cancel(uri: string): void;
    private download;
    private get;
    private notify;
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
    private uri;
    private handler;
    private dispose;
    private observe;
    protected getProps(): any;
    private checkSource;
    componentWillMount(): void;
    componentWillReceiveProps(nextProps: P): void;
    componentWillUnmount(): void;
}
export declare class CachedImage extends BaseCachedImage<CachedImageProps> {
    render(): JSX.Element;
}
export declare class CachedImageBackground extends BaseCachedImage<CachedImageProps> {
    render(): JSX.Element;
}
export declare class CustomCachedImage<P extends CustomCachedImageProps> extends BaseCachedImage<P> {
    render(): JSX.Element;
}
