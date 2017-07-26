
import { Node } from './Node';
import { PriorityQueue } from './Queue';

const RNFetchBlob = require("react-native-fetch-blob").default;
const SHA1 = require("crypto-js/sha1");
const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
const BASE_DIR = RNFetchBlob.fs.dirs.DocumentDir + "/react-native-img-cache/files";
const QUEUE_DIR = RNFetchBlob.fs.dirs.DocumentDir + "/react-native-img-cache/";
const CACHE_LIMIT_FILE_COUNT = 5;

export class ImageCache {

    static readInQueue(file) {
      return new Promise((resolve, reject) => {
        RNFetchBlob.fs.readFile(QUEUE_DIR + file, 'utf8')
        .then((data) => resolve(JSON.parse(data)))
        .catch((err) => {
          console.log('No Queue File Found: ', err);
          RNFetchBlob.fs.exists(QUEUE_DIR + file).then((exists) => {
             if (exists) {
               RNFetchBlob.fs.writeFile(QUEUE_DIR + file, '[]', 'utf8')
               .then((result) => resolve([]))
               .catch((err) => reject(err))
             }
             else {
               RNFetchBlob.fs.createFile(QUEUE_DIR + file, '[]', 'utf8')
               .then((result) => resolve([]))
               .catch((err) => reject(err))
             }
         });
        });
      })
    }

    static save(file, queueData) {
      return new Promise((resolve, reject) => {
        const data = JSON.stringify(queueData)
        RNFetchBlob.fs.writeFile(QUEUE_DIR + file, data, 'utf8')
        .then((result) => (process.env.NODE_ENV === "TEST") ? console.log("") : console.log('Queue successfully saved!') )
        .catch((err) => reject(err))
      })
    }

    prepareMem(data){
      let queue = new PriorityQueue();
      const map = {};
      data.forEach((d) => {
        let n = new Node(d)
        queue.enqueue(n)
        map[d] = n;
      })
      return {queue, map}
    }

    constructor(data) {
        this.cache = {};
        const { queue, map } = this.prepareMem(data)
        this.queue = queue;
        this.map = map;
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
    // static load(file) {
    //   return new Promise((resolve, reject) => {
    //     this.readInQueue(file)
    //     .then((data) => resolve(data))
    //     .catch((err) => reject(err))
    //   })
    // }
    static get() {
      return new Promise((resolve, reject) => {
        if (!ImageCache.instance) {
          this.readInQueue('queue.js')
          .then((data) => {
            ImageCache.instance = new ImageCache(data);
            resolve(ImageCache.instance);
          })
          .catch((err) => reject(err))
        } else {
          resolve(ImageCache.instance);
        }
      })
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
                console.log('downloading...');
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
        //Cache eviction update
        this.update(dbPath)
    }
    update(fileKey){

      let updateNode;
      if (this.map[fileKey]){
        updateNode = this.map[fileKey]
        //remove from queue
        this.queue.remove(updateNode)
      } else {
        //if cache is full
        if (this.queue.getSize() >= CACHE_LIMIT_FILE_COUNT){
          console.log('Cache full! currentSize: ', this.queue.getSize())
          //remove from queue
          const toRemove = this.queue.dequeue();
          //remove from map
          delete this.map[toRemove.val]
          //remove from disk
          const path = this.getPath(toRemove.val, true)
          RNFetchBlob.fs.unlink(path);
          //ToDo: delete from this.cache
        }
        //make new node
        updateNode = new Node(fileKey);
        //add new to map
        this.map[fileKey] = updateNode;
      }
      //enqueue new to queue
      this.queue.enqueue(updateNode)
      //save queue to disk
      ImageCache.save('queue.js', this.queue.save());
    }
}
