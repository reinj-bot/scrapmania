'use strict';
// Packed text table (made by a build tool - don't edit by hand).
const Lex = (() => {
  const k = [90, 19, 199, 33, 158, 68, 11];
  const b = atob(
  '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' +
  '8CpuKDHrA+YmKQc/nAP/KGI/feUNvDxqeE6aXA==');
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i) ^ k[i % k.length];
  return JSON.parse(new TextDecoder().decode(u));
})();
