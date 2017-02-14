# React Native Image Cache

[![CircleCI](https://circleci.com/gh/wcandillon/react-native-image-cache.svg?style=svg)](https://circleci.com/gh/wcandillon/react-native-image-cache)
[![npm version](https://badge.fury.io/js/react-native-img-cache.svg)](https://badge.fury.io/js/react-native-img-cache)

CachedImage component and Cache image manager for React Native. Based on [this article](https://hackernoon.com/image-caching-in-react-native-96d8df33ca84).

## Installation

```bash
npm install react-native-image-cache --save
```

### react-native-fetch-blob
This package has a dependency with [react-native-fetch-blob](https://github.com/wkh237/react-native-fetch-blob).
If your project doesn't have a dependency with this package already, please refer to [their installation instructions](https://github.com/wkh237/react-native-fetch-blob#user-content-installation).

## Usage

### CachedImage

The `CachedImage` component assumes that the image URI will never change. The image is stored and served from the application cache.

```jsx
import {CachedImage} from "react-native-image-cache";

<CachedImage source={{ uri: "https://i.ytimg.com/vi/yaqe1qesQ8c/maxresdefault.jpg" }} />
```

The `mutable` property implies assumes that the image URI can change over time. The lifetime of this cache is the one of the running application and it can be manually busted using `ImageCache`.

```jsx
import {CachedImage} from "react-native-image-cache";

<CachedImage source={{ uri: "https://i.ytimg.com/vi/yaqe1qesQ8c/maxresdefault.jpg" }} mutable />
```

### ImageCache

The `ImageCache` class can register observers to the cache.

```js
const immutable = true;
const observer = (path: string) => {
    console.log(`path of the image in the cache: ${path}`);
};
ImageCache.getCache().on(uri, observer, immutable);
```

We use the observer pattern instead of a promise because a mutable image might have different version with different paths in the cache.

Observers can be deregistered using `dispose`:

```js
ImageCache.getCache().dispose(uri, observer);
```
