import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: Number(__ENV.VUS || 50),
  duration: __ENV.DURATION || '30s',
};

export default function () {
  const target = `${__ENV.TARGET_URL}/api/orders?userId=1`;
  const res = http.get(target);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(0.1);
}
