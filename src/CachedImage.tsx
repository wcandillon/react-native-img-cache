import React, {Component} from "react";
import {Image} from "react-native";
import {observable, computed} from "mobx";
import {observer} from "mobx-react/native";
import {CacheHandler, ImageCache} from "./ImageCache";

class SmartImageStore {

    private handler: CacheHandler = (path: string) => {
        this.path = path;
    };

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

    private store: SmartImageStore = new SmartImageStore();

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
            style={[thumbnailStyle ,style]}
            mutable={mutable} />;
    }
}