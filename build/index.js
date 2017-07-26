import React, { Component } from "react";
import { Image, Platform } from "react-native";
import RNFetchBlob from "react-native-fetch-blob";

import { ImageCache } from './Cache'

const SHA1 = require("crypto-js/sha1");
const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
const FILE_PREFIX = Platform.OS === "ios" ? "" : "file://";

export class BaseCachedImage extends Component {
    constructor() {
        super();
        this.handler = (path) => {
            this.setState({ path });
        };
        this.state = { path: undefined };
    }
    dispose() {
        if (this.dbPath) {
            ImageCache
            .get()
            .then((cacheInstance) => {
              cacheInstance.dispose(this.dbPath, this.handler);
            })
            .catch((err) => console.log('Error observing- ', err))
        }
    }
    observe(source, mutable) {
        if (source.dbPath !== this.dbPath) {
            this.dispose();
            this.dbPath = source.dbPath;

            ImageCache
            .get()
            .then((cacheInstance) => {
              cacheInstance.on(source, this.handler, !mutable);
            })
            .catch((err) => console.log('Error observing- ', err))
        }
    }
    getProps() {
        const props = {};
        Object.keys(this.props).forEach(prop => {
            if (prop === "source" && this.props.source.dbPath) {
                props["source"] = this.state.path ? { dbPath: this.props.source.dbPath, dbProvider: this.props.source.dbProvider, uri: FILE_PREFIX + this.state.path } : {};
            }
            else if (["mutable", "component"].indexOf(prop) === -1) {
                props[prop] = this.props[prop];
            }
        });
        return props;
    }
    checkSource(source) {
        if (Array.isArray(source)) {
            throw new Error(`Giving multiple URIs to CachedImage is not yet supported.
            If you want to see this feature supported, please file and issue at
             https://github.com/wcandillon/react-native-img-cache`);
        }
        return source;
    }
    componentWillMount() {
        const { mutable } = this.props;
        const source = this.checkSource(this.props.source);
        if (source.dbPath) {
            this.observe(source, mutable === true);
        }
    }
    componentWillReceiveProps(nextProps) {
        const { mutable } = nextProps;
        const source = this.checkSource(nextProps.source);
        if (source.dbPath) {
            this.observe(source, mutable === true);
        }
    }
    componentWillUnmount() {
        this.dispose();
    }
}
export class CachedImage extends BaseCachedImage {
    constructor() {
        super();
    }
    render() {
        const props = this.getProps();
        return React.createElement(Image, Object.assign({}, props), this.props.children);
    }
}
export class CustomCachedImage extends BaseCachedImage {
    constructor() {
        super();
    }
    render() {
        const { component } = this.props;
        const props = this.getProps();
        const Component = component;
        return React.createElement(Component, Object.assign({}, props), this.props.children);
    }
}
//# sourceMappingURL=index.js.map
