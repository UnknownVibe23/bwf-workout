import assert from 'node:assert/strict';

// Minimal DOM stub: each element records its appended children
function makeEl() {
  return {
    nodeType: 1,
    children: [],
    set className(v) {},
    addEventListener() {},
    setAttribute() {},
    append(c) { this.children.push(c.text ?? c); },
  };
}
global.document = {
  createElement: () => makeEl(),
  createTextNode: (t) => ({ nodeType: 1, text: t }),
};

const { h, appendAll } = await import('../js/util.js');

// h() must skip null/undefined/false children
const el = h('div', {}, 'a', null, undefined, false, 'b');
assert.deepEqual(el.children, ['a', 'b']);

// appendAll (native-append replacement) must skip null placeholders —
// regression test: a null child used to render as the literal text "null"
const target = makeEl();
appendAll(target, h('span', {}, 'x'), null, undefined, false, 'tail');
assert.deepEqual(
  target.children.map((c) => (typeof c === 'object' ? c.children : c)),
  [['x'], 'tail'],
  'null children are not rendered as "null"',
);

console.log('Util tests passed.');
