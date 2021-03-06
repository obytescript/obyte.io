const axios = require('axios');
const db = require('./db');

const indexJoints = (joints) => {
  const arrQueries = [];
  joints.forEach((joint) => {
    const objUnit = joint.joint.unit;
    const authors = objUnit.authors.map(author => author.address);
    if (objUnit.messages) {
      objUnit.messages.forEach((message, i) => {
        if (!['payment'].includes(message.app)) {
          arrQueries.push([
            'INSERT INTO messages (unit, message_index, unit_main_chain_index, unit_is_stable, ' +
            'unit_creation_date, unit_authors, app, payload_hash, payload_location, payload, ' +
            'payload_uri, payload_uri_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ' +
            'ON CONFLICT ON CONSTRAINT messages_pkey DO UPDATE SET unit_main_chain_index = $3, unit_is_stable = $4',
            [
              objUnit.unit, i, objUnit.main_chain_index, joint.joint.ball ? 1 : 0,
              new Date(objUnit.timestamp * 1000), JSON.stringify(authors), message.app,
              message.payload_hash, message.payload_location, JSON.stringify(message.payload),
              message.payload_uri, message.payload_uri_hash,
            ],
          ]);
          if (message.app === 'definition' && message.payload.definition && message.payload.definition[1] && message.payload.definition[1].doc_url) {
            const docUrl = String(message.payload.definition[1].doc_url).replace(/{{aa_address}}/g, message.payload.address);
            axios.get(docUrl, { timeout: 1000 }).then((response) => {
              if (typeof response.data !== 'object') throw Error('not JSON');
              let source = { doc_url: response.request.res.responseUrl };
              if (['1.0'].includes(response.data.version)) {
                source = ['description', 'homepage_url', 'source_url', 'field_descriptions'].reduce((accum, currentVal) => {
                  const newArray = accum;
                  if (response.data[currentVal]) {
                    newArray[currentVal] = (typeof response.data[currentVal] === 'object') ? response.data[currentVal] : response.data[currentVal].toString().slice(0, 1000);
                  }
                  return newArray;
                }, source);
              }
              db.query('INSERT INTO doc_urls (unit, source, fetch_date) VALUES($1,$2,$3) ON CONFLICT ON CONSTRAINT doc_urls_pkey DO UPDATE SET source = $2, fetch_date = $3', [objUnit.unit, JSON.stringify(source), new Date()]);
            }).catch((err) => {
              console.error('fetch docUrl', err.message || err, docUrl);
              db.query('INSERT INTO doc_urls (unit, source, fetch_date) VALUES($1,$2,$3) ON CONFLICT ON CONSTRAINT doc_urls_pkey DO UPDATE SET source = $2, fetch_date = $3', [objUnit.unit, null, new Date()]);
            });
          }
        }
      });
    }
  });
  const lastKnownMci = joints.slice().reverse()[0].joint.unit.main_chain_index;
  arrQueries.push([
    'UPDATE last_known_mci SET mci = $1 WHERE mci < $2',
    [lastKnownMci, lastKnownMci],
  ]);
  console.log('indexJoints queries', arrQueries.length);
  return db.tx(t => t.batch(arrQueries.map(query => t.none(query[0], query[1]))));
};

const indexUnstableUnit = (unit) => {
  const arrQueries = [];
  const authors = unit.authors.map(author => author.address);
  if (unit.messages) {
    unit.messages.forEach((message, i) => {
      if (!['payment'].includes(message.app)) {
        arrQueries.push([
          'INSERT INTO messages (unit, message_index, unit_main_chain_index, unit_is_stable, ' +
          'unit_creation_date, unit_authors, app, payload_hash, payload_location, payload, ' +
          'payload_uri, payload_uri_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ' +
          'ON CONFLICT DO NOTHING',
          [
            unit.unit, i, unit.main_chain_index, 0,
            new Date(unit.timestamp * 1000), JSON.stringify(authors), message.app,
            message.payload_hash, message.payload_location, JSON.stringify(message.payload),
            message.payload_uri, message.payload_uri_hash,
          ],
        ]);
      }
    });
  }
  console.log('indexUnstableUnit queries', arrQueries.length);
  return db.tx(t => t.batch(arrQueries.map(query => t.none(query[0], query[1]))));
};

module.exports = {
  indexJoints,
  indexUnstableUnit,
};
