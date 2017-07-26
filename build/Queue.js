const Node = require('./Node').Node;

export class PriorityQueue {

  constructor() {
      this.currentSize = 0;
      this.head = new Node();
      this.tail = new Node();
  }

  remove(entry){
    entry.prev.next = entry.next;
    entry.next.prev = entry.prev;
    entry.next = null;
    entry.prev = null;
    this.currentSize--;
  }

  enqueue(entry){
    if (this.currentSize == 0){
      this.head.next = entry;
      this.tail.prev = entry;
      entry.next = this.tail;
      entry.prev = this.head;
    } else {
      entry.next = this.head.next;
      this.head.next.prev = entry;
      this.head.next = entry;
      entry.prev = this.head;
    }
    this.currentSize++;
  }

  dequeue(){
    let toRemove = this.tail.prev;
    this.tail.prev = toRemove.prev;
    toRemove.prev.next = this.tail;
    toRemove.prev = null;
    toRemove.next = null;
    this.currentSize--;
    return toRemove;
  }

  getSize(){
    return this.currentSize;
  }

  print(){
    let curr = this.head.next;
    let str = "";
    if (this.currentSize != 0){
      while (curr != this.tail){
        str += curr.val + "->"
        curr = curr.next;
      }
    }
    console.log('Q: ', str);
    return str;
  }
  save(){
    let curr = this.head.next;
    let res = [];
    if (this.currentSize != 0){
        while (curr != this.tail){
          res.push(curr.val)
          curr = curr.next;
        }
      }
    return res;
  }

}
