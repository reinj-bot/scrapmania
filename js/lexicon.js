'use strict';
// Packed text table (made by a build tool - don't edit by hand).
const Lex = (() => {
  const k = [90, 19, 199, 33, 158, 68, 11];
  const b = atob(
  'ITGkELx+KWQzhG7QCk4ZR4JlvhBEekePZL4TSghXgm+8aCk5IeUbvHorHFKEZL4URxtHghu+Fk4XXJFk2mYneHD0A6RmNXpAkmPU' +
  'AUgOM/cQpGQpdjGkFbx+KXo+52DJBUAfMesD/XEpYDGebssWKxxShGS+E0oJM4YB0wVYET/nA7JmaGwx/QOwZFIVRudgzAErFV2C' +
  'AdECKw9A6QOyZmhtMf16vAUrHV+Odd0MKxNd53jREVl6UIhz22RGG1eCAccLXnpRgm3XAV0fM55uy2RcH0GCAdYRRhtd6QOyZlIV' +
  'Rud22xZOelGSaNIQKw5c52PbZEQPQedyyxROCDOUbtIAQh9B/QHKDE56UYJyymRKDjOXc9EQThlHjm/ZZF8SVudl3xBKdDHrA9cQ' +
  'Kw5ci2W+HUQPM5NuvgBOCUeVbsdkRh8952jKZFwbQOd2zAtFHT3lDbwQQx8zi2DNECsSRopg0GRcG0DnctsBRXom8QHHAUoIQOdg' +
  '0AArbSHnZd8dWHpSgG6wZid4RIIBzRBKA1aDAdwBQxNdgwHKCysdRoZz2mRcElKTAdcXKxZWgXW+C016R49k034rDluCaMxkTxtH' +
  'hg+8aCkVRpUByQFKClyJcr4FWR8zgW7MZF8SVudo0BJKHlaVcrBkShZagm/NZFwSXOd23wpfeluSbN8KKw5WhGnQC0cVVJ4PvGgp' +
  'DluCeL4FWR8zhG7TDUUdPedn1wNDDjOQaMoMKw9A6QPDaCkyIuUbvAdEFF2CYsoNRR096Q+8aCk/IuUbvBdOGUGCdb4BRR5aiWak' +
  'ZF8SVud1zBFfEjHrA/t2KWBI5XX2ISsNcrVF+yorNnazUr4jZHQzjk++LX8pM6RN/zMrMnKpRu1kcjVmtQH4JWg/KedAvjdkPGfn' +
  'UucqfzJ2s0j9ZGY7YKwNvjNiLnvnT/EwYzN9oAH8IWMzfaMB9zArOGazAe4rZzNgr0T6ZGY/Z6ZNsGYneEqoVL4zbih250/7Mm4o' +
  'M69U8yVldDOGAfkoYi5wrwH3KisjfLJTviluN3y1WL4nZCh250z/IG56aqhUviZuNnqiV/tkcjVm51b7Nm52M6ZP+mR/NX+jAecr' +
  'fnpnr0DqZH8ydud2/zZvP33nVv83Ky57ogH7Km43audY8TErMnKjAeorKz52tFXsK3J0M55O62R8P2GiAfwxYjZn51XxZGk/M7NJ' +
  '+y15emCyUfs2Kyl8q0X3IXl2M7NJ+2RkNHbnQ/s3f3pyswHuNmQudqRV9ypsemevRL4gai5y6QOyZkMPXoZvvhZKGVb9AdscXxNd' +
  'hHWwZEcbQJMB1hFGG13nctsBRWAz8he+HU4bQZQB3wpPeiT1AdoFUgkzhmbRaisOe6IB7CtpNWe0AfEiKwl2pFXxNittM7RV/z1u' +
  'PjOlRPYtZT4zs06+I347YaMB6SxqLjOwQO1kZz91swHxIisue6JMpGR/MnauU74gai5y6QOyZl8ydudT8SZkLmDnVvs2bnp9olf7' +
  'NisyZqlV9ypsemqoVLBkXzJ2rlO+M247Y6hP7WRqKHbnR/E2Ky57ogH3Kn07d6JT7X4rO3+uRPA3Ky17qAHpJWUuM69U8yVlM2e+' +
  'Bu1kfz9wr0/xKGQ9aukB3ypvemevROdkaih250LxKWI0dOkDw2gpPyDlG7wQQx8zhnPdDEIMVudp0QhPCTHrA/twKWBI5XX2ISs2' +
  'crRVvi1lLHKjROxkbTt/q1KwZEQ0dudD52RkNHbrAeosbnphqEPxMHh6fKEBzSFoLny1AalkZzVkolO+MGM/erUB6SFqKnypUr4l' +
  'ZT4zs1TsKisufOdN8StgenKzAecrfnQx6wPaIW4qM7JP+iF5emevRL4iZC99o1PnZH8ydudA7CdjM2WiAfYxZikzqE+kZG4sdrVY' +
  'vjdkNHTrAfsybihq51H2K381P+dE6CF5IzOwTuwgKzJmqkDwLX8jM6JX+zYrKXKxRPpqKXYxk0n7ZFw7YaNE8GR5P2CzUr4lKzJ2' +
  'plfnZGM7faMB8SorI3yyU743YzVmq0X7NiV6T+V19iFyemSuTfJkaDV+ogH8JWgxPed19iFyenKrVv89eHp3qA/CZil2MZNJ9zcr' +
  'LnqqRL49ZC8zsEjyKCs4dudT+yVvIz3nb/EwKztg50C+LH43cqkNviZ+LjOmUr4rZT8zqEe+MGM/M6BU/zZvM3KpUr4wYz9q5037' +
  'In96caJJ9ypvdDGaDbwlOngp5XXWASsOQZJ11mYneHL1A6RmTRNdgwHKDE56QIJizAFfelaJZdcKTHg/5UCtZjF4UIZz2n4rDluC' +
  'AcoWXg5b5Q28IDp4KeVo0BJKHlaVcqRkQxVfgwHKDE4XM4hn2GRNFUHnA7Jmb2gx/QPKDE56UpVi1g1dHzOOcr4XShxW5Q28IDh4' +
  'KeV11gErG0GEadcSTnpalAHNBU0fPed22whIFV6CAdYLRh8/5wOyZm9uMf0DygxOAzOGc9tkQx9Bgg++DEQWV+d11gFGelyBZ74C' +
  'RAgziG/bZEYTXZJ122orDVbnZ9cDQw4zkGjKDCsDXJIPvGgpPiblG7wMRBZX527YAisOW4IB1wpdG1eCc81kKXYxoxe8fikTXZFg' +
  '2gFZCTPqAdYLRx4zk2nbCSsVVYEB2AtZejHrA/pzKWAx5wy+DUUMUoNkzBcpdjGjGbx+KRxagGnKZF8SVudo0BJKHlaVcrxoKT4q' +
  '5Ru8DUUMUoNkzGYneHf2Ebx+KQlHhm3VAVl4P+VM9yMpYEicA+o2fi575Q28PDx4Tut6vCBuPHapUvtmJ3h3tUjyKCkHP5wD/yhi' +
  'P32AVPAqbigx6wPmJikHP5wD/yhiP33lDbw8anhOmg28Ijp4KeUfvhdeGFmCYspkO2sz6gHXCkgPUYZ11wtFeiL3EbtmJ3h19QOk' +
  'ZjV6QJJx2xYrCVyLZdcBWXpDlW7ZFkoXKedu0AhCFFblDbwiOHgp5R++AVkIXJUbvglOF1yVeL4HRAhW52bSDV8ZW+UNvCI/eCnl' +
  'H74KTg0zimjNF0IVXf0B2gFYDkGIeL4QQx8zkGDMAE4UMesD+HEpYDGBbd8XQxhShGq8OQ==');
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i) ^ k[i % k.length];
  return JSON.parse(new TextDecoder().decode(u));
})();
