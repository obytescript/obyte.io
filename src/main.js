import Vue from 'vue';
import VueI18n from 'vue-i18n';
import infiniteScroll from 'vue-infinite-scroll';
import moment from 'moment';
import upperFirst from 'lodash/upperFirst';
import camelCase from 'lodash/camelCase';
import makeBlockie from 'ethereum-blockies-base64';
import api from '@/helpers/api';
import client from '@/helpers/client';
import App from '@/App.vue';
import router from '@/router';
import store from '@/store';
import utils from '@/helpers/utils';
import 'primer/index.scss';
import '@/styles.less';

const requireComponent = require.context('./components', true, /[\w-]+\.vue$/);
requireComponent.keys().forEach((fileName) => {
  const componentConfig = requireComponent(fileName);
  const componentName = upperFirst(camelCase(fileName.replace(/^\.\//, '').replace(/\.\w+$/, '')));
  Vue.component(componentName, componentConfig.default || componentConfig);
});

setInterval(() => api.request('heartbeat', null), 10 * 1000);
setInterval(() => client.api.heartbeat(), 10 * 1000);

Vue.config.productionTip = false;

Vue.filter('truncate', (text, stop, clamp) => text.slice(0, stop) + (stop < text.length ? clamp || '...' : ''));

Vue.filter('date', (value, format) => {
  if (format) {
    return moment(new Date(value).getTime()).format(format);
  }

  return moment(new Date(value).getTime()).fromNow();
});

Vue.filter('niceAsset', (x, y) => {
  const n = parseInt(x, 10) || 0;
  const d = parseInt(y, 10) || 0;
  if (d) {
    return Number(n / (10 ** d)).toFixed(d);
  }
  return Number(n).toString();
});

Vue.filter('niceBytes', (x) => {
  const units = ['Bytes', 'Kilobytes', 'Megabytes', 'Gigabytes'];
  let l = 0;
  let n = parseInt(x, 10) || 0;
  // eslint-disable-next-line no-plusplus
  while (n >= 1000 && ++l) {
    n /= 1000;
    if (l >= units.length - 1) break;
  }
  let amount;
  if (x < 1000) {
    amount = `${n.toFixed(0)} ${units[l]} (${Number(parseInt(x, 10) / 1000000000).toFixed(9)} $GBYTE)`;
  } else if (x < 1000000000) {
    amount = `${n < 1000 ? n.toPrecision(3) : n.toFixed(0)} ${units[l]} (${Number(parseInt(x, 10) / 1000000000).toPrecision(3)} $GBYTE)`;
  } else {
    amount = `${n < 1000 ? n.toPrecision(3) : n.toFixed(0)} ${units[l]} ($GBYTE)`;
  }
  return amount;
});

Vue.filter('name', (value, type, fallback) => utils.getAddressName(value, type, fallback));

Vue.filter('blockie', value => makeBlockie(value));

Vue.use(VueI18n);
Vue.use(infiniteScroll);

const messages = {
  en: {
    message: {
      hello: 'hello world',
    },
  },
  ja: {
    message: {
      hello: 'こんにちは、世界',
    },
  },
};

const numberFormats = {
  'en-US': {
    currency: {
      style: 'currency', currency: 'USD',
    },
  },
  'ja-JP': {
    currency: {
      style: 'currency', currency: 'JPY', currencyDisplay: 'symbol',
    },
  },
};

// Create VueI18n instance with options
const i18n = new VueI18n({
  locale: 'ja', // set locale
  messages, // set locale messages
  numberFormats,
});

new Vue({
  i18n,
  router,
  store,
  render: h => h(App),
}).$mount('#app');
