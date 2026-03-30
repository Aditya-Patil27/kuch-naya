import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: Number(__ENV.VUS || 50),
  duration: __ENV.DURATION || '30s',
};

export default function () {
  const path = __ENV.TARGET_PATH || '/api/health';
  const method = (__ENV.TARGET_METHOD || 'GET').toUpperCase();
  const target = `${__ENV.TARGET_URL}${path}`;
  const res = http.request(method, target);

  check(res, {
    'status is success': (r) => r.status >= 200 && r.status < 300,
  });

  sleep(0.1);
}
